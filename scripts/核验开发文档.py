"""Check developer documents and proposed contracts, not an implemented product."""
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit

sys.dont_write_bytecode = True
from jsonschema import Draft202012Validator, FormatChecker  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "assets/development/v1.1"
FORMATS = FormatChecker()


@FORMATS.checks("date-time", raises=(ValueError, TypeError))
def datetime_format(value: object) -> bool:
    # Optional jsonschema format extras are not installed here. Check the project's UTC timestamp subset explicitly.
    if not isinstance(value, str):
        return True
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)", value):
        return False
    datetime.fromisoformat(value.replace("Z", "+00:00"))
    return True


@FORMATS.checks("uri", raises=ValueError)
def uri_format(value: object) -> bool:
    if not isinstance(value, str):
        return True
    parsed = urlsplit(value)
    if parsed.scheme in ("http", "https"):
        return bool(parsed.hostname) and parsed.username is None and parsed.password is None and not any(c.isspace() for c in value)
    return bool(parsed.scheme)


def read(relative: str) -> dict:
    # Existing checks also cover the preserved contracts now extended by v1.1.
    relative = relative.replace("assets/development/v1.0/", "assets/development/v1.1/")
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def walk(value: object):
    yield value
    if isinstance(value, dict):
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def execution_semantics(value: dict) -> list[str]:
    """Validate cross-field examples only; production must also check ownership, evidence and transactions."""
    errors = []
    timeline = value["timeline"]
    cursor = 0
    ids = set()
    for i, shot in enumerate(timeline["shots"]):
        if shot["shot_id"] in ids:
            errors.append("duplicate shot id")
        ids.add(shot["shot_id"])
        if shot["start_frame"] != cursor - shot["overlap_frames"] or (i == 0 and shot["overlap_frames"] != 0):
            errors.append("timeline discontinuity")
        if shot["end_frame"] <= shot["start_frame"] or shot["overlap_frames"] >= shot["end_frame"] - shot["start_frame"]:
            errors.append("invalid shot length/overlap")
        if shot["spoken_text"] and not shot["evidence_ids"]:
            errors.append("spoken facts lack evidence references")
        cursor = shot["end_frame"]
    if cursor != timeline["target_frames"]:
        errors.append("timeline does not match target")
    videos = [slot for slot in value["outputs"] if slot["kind"] == "video"]
    if not videos or len({slot["slot_id"] for slot in value["outputs"]}) != len(value["outputs"]):
        errors.append("missing video or duplicate slots")
    for slot in videos:
        if (slot["width"], slot["height"], slot["fps"], slot["duration_frames"], slot["format"]) != (
                1080, 1920, 30, timeline["target_frames"], "mp4-h264-yuv420p"):
            errors.append("video output violates frozen specification")
    if value["budget"]["repair_ceiling_micro"] > value["budget"]["ceiling_micro"]:
        errors.append("repair budget exceeds total")
    if value.get("codex_contract", {}).get("agent_cost_ceiling_micro", 0) > value["budget"]["ceiling_micro"]:
        errors.append("Codex budget exceeds total order budget")
    start = datetime.fromisoformat(value["fulfillable_at"].replace("Z", "+00:00"))
    end = datetime.fromisoformat(value["deadline_at"].replace("Z", "+00:00"))
    if end <= start:
        errors.append("invalid deadline")
    roles = {role for model in value["model_versions"] for role in model["roles"]}
    if "VISION_ANALYSIS" not in roles:
        errors.append("no frozen real vision model")
    if value["engine"] != "PHOTO_LAYOUT" and "VIDEO" not in roles:
        errors.append("generative route lacks video model")
    return errors


def main() -> int:
    checks: list[dict] = []
    (BASE / "verification-report.json").write_text('{"status":"CHECKING","product_tests_executed":false}\n', encoding="utf-8")

    def check(condition: bool, name: str, detail: str = "") -> None:
        checks.append({"check": name, "status": "PASS" if condition else "FAIL", "detail": detail})

    baseline = read("assets/development/v1.0/development-baseline.json")
    spec = read("assets/development/v1.0/contracts/openapi.json")
    states = read("assets/development/v1.0/state-machines.json")
    entities = read("assets/development/v1.0/data-model.json")
    work = read("assets/development/v1.0/work-packages.json")
    reqs = read("assets/requirements/requirements.v3.1.json")["requirements"]
    pages = read("assets/design/柚子创作社/v1.0/page-registry.json")["pages"]
    page_ids = {p["id"] for p in pages}
    expected_reqs = {r["id"] for r in reqs}
    check(baseline["status"] == "DESIGN_NOT_IMPLEMENTED", "development_is_design_only")
    check(baseline["business_policies"]["sale_enabled"] is False and baseline["business_policies"]["price_fen"] is None,
          "unknown_capabilities_remain_unsold")
    check(baseline["requirements_version"] == "3.1" and baseline["design_baseline"] == "YPCC-DS-C-1.0.0", "baseline_versions")
    check(len(baseline["engineering_constraints"]) == 21, "engineering_constraints_21")
    check(all(v.startswith("NOT_") for v in baseline["product_verification"].values()), "no_product_verification_claim")

    vendor_file = BASE / "contracts/vendor/openapi-3.1-schema.json"
    source = read("assets/development/v1.0/contracts/vendor/source-record.json")
    check(hashlib.sha256(vendor_file.read_bytes()).hexdigest() == source["sha256"], "official_openapi_schema_source_hash")
    vendor_schema = json.loads(vendor_file.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(vendor_schema)
    oas_errors = list(Draft202012Validator(vendor_schema).iter_errors(spec))
    check(not oas_errors, "official_openapi_3_1_structure", "; ".join(e.message[:200] for e in oas_errors[:5]))
    check(spec["openapi"] == "3.1.1" and spec["servers"] == [{"url": "/v1/p01", "description": "相对基路径；未指定生产域名"}], "openapi_version_and_base_path")
    schemas = spec["components"]["schemas"]
    for name, schema in schemas.items():
        try:
            Draft202012Validator.check_schema(schema)
            check(True, "json_schema_2020_12:" + name)
        except Exception as exc:
            check(False, "json_schema_2020_12:" + name, str(exc)[:300])
    for node in walk(spec):
        if not isinstance(node, dict) or "$ref" not in node:
            continue
        target = node["$ref"]
        exists = target.startswith("#/")
        cursor: object = spec
        if exists:
            try:
                for part in target[2:].split("/"):
                    cursor = cursor[part.replace("~1", "/").replace("~0", "~")]
            except (KeyError, TypeError):
                exists = False
        check(exists, "local_openapi_ref:" + target)

    endpoints = read("assets/development/v1.0/contracts/endpoints.json")["endpoints"]
    actual_ops = [op for path in spec["paths"].values() for method, op in path.items() if method in {"get", "post", "put", "patch", "delete"}]
    ids = [op["operationId"] for op in actual_ops]
    check(len(ids) == len(set(ids)) == len(endpoints) == baseline["counts"]["api_operations"], "unique_complete_operation_inventory")
    catalog = (BASE / "contracts/endpoint-catalog.md").read_text(encoding="utf-8")
    for endpoint in endpoints:
        op = spec["paths"][endpoint["path"]][endpoint["method"].lower()]
        name = endpoint["operation_id"]
        check(op["operationId"] == name and name in catalog, "operation_catalog:" + name)
        path_params = set(re.findall(r"\{([^}]+)\}", endpoint["path"]))
        declared = {p["name"] for p in op["parameters"] if p.get("in") == "path" and p.get("required") is True}
        check(path_params == declared, "required_path_parameters:" + name)
        check(set(op["x-requirements"]) <= expected_reqs and bool(op["x-requirements"]), "operation_requirements:" + name)
        check(set(op["x-design-pages"]) <= page_ids, "operation_design_pages:" + name)
        idempotency = any(p.get("$ref", "").endswith("/IdempotencyKey") for p in op["parameters"])
        check(idempotency == op["x-idempotency-required"], "operation_idempotency:" + name)
        callback = name == "receivePaymentEvent"
        check(bool(op["security"]) or op["x-auth-policy"] in {"public-rate-limited", "provider-native-signature-and-server-reconciliation"}, "explicit_auth_boundary:" + name)
        if callback:
            check(op["security"] == [] and op["x-response-adapter-required"] is True and "原始字节" in op["requestBody"]["description"], "native_callback_not_fake_bearer")
        else:
            success = op["responses"][str(endpoint["success_status"])]
            check("application/json" in success["content"], "typed_success_response:" + name)
        check(op["x-implementation-status"] == "DESIGN_NOT_IMPLEMENTED", "operation_not_implemented:" + name)

    management = read("assets/development/v1.0/contracts/management-openapi.json")
    management_endpoints = read("assets/development/v1.0/contracts/management-endpoints.json")["endpoints"]
    management_errors = list(Draft202012Validator(vendor_schema).iter_errors(management))
    check(not management_errors, "official_management_openapi_structure", "; ".join(e.message[:200] for e in management_errors[:5]))
    management_ids = [op["operationId"] for item in management["paths"].values() for op in item.values()]
    check(len(management_ids) == len(set(management_ids)) == len(management_endpoints) == baseline["counts"]["management_api_operations"]
          and not set(management_ids) & set(ids), "unique_management_operations")
    check(management["servers"][0]["url"] == "/v1/internal/p01" and set(management["components"]["securitySchemes"]) == {"managementSession"}, "independent_management_identity")
    for endpoint in management_endpoints:
        op = management["paths"][endpoint["path"]][endpoint["method"].lower()]
        check(op["security"] == [{"managementSession": []}] and bool(op["x-required-permission"]), "management_permission:" + endpoint["operation_id"])
        check(set(op["x-requirements"]) <= expected_reqs and op["x-implementation-status"] == "DESIGN_NOT_IMPLEMENTED", "management_scope:" + endpoint["operation_id"])
        path_params = set(re.findall(r"\{([^}]+)\}", endpoint["path"]))
        check(path_params == {p["name"] for p in op["parameters"] if p.get("in") == "path" and p.get("required")}, "management_path_params:" + endpoint["operation_id"])
        check(op["x-idempotency-required"] == (endpoint["method"] == "POST"), "management_idempotency:" + endpoint["operation_id"])
        check(endpoint["operation_id"] in catalog, "management_readable_inventory:" + endpoint["operation_id"])
    for node in walk(management):
        if isinstance(node, dict) and "$ref" in node:
            cursor: object = management
            exists = node["$ref"].startswith("#/")
            try:
                for part in node["$ref"][2:].split("/"):
                    cursor = cursor[part.replace("~1", "/").replace("~0", "~")]
            except (KeyError, TypeError):
                exists = False
            check(exists, "management_local_ref:" + node["$ref"])

    internal = {}
    for name in ["product-identity-lock", "execution-snapshot", "provider-submission"]:
        schema = read(f"assets/development/v1.0/contracts/{name}.schema.json")
        Draft202012Validator.check_schema(schema)
        internal[name] = schema
        check(schema["additionalProperties"] is False, "strict_internal_contract:" + name)
    fixtures = read("assets/development/v1.0/contracts/contract-fixtures.json")["cases"]
    for fixture in fixtures:
        if fixture["schema"] in internal:
            schema = internal[fixture["schema"]]
        else:
            schema = {"$schema": "https://json-schema.org/draft/2020-12/schema", "$ref": "#/components/schemas/" + fixture["schema"],
                      "components": spec["components"]}
        errors = list(Draft202012Validator(schema, format_checker=FORMATS).iter_errors(fixture["value"]))
        semantic_errors = []
        if not errors and fixture["semantic_rule"] == "execution_snapshot":
            semantic_errors = execution_semantics(fixture["value"])
        valid = not errors and not semantic_errors
        check(valid == fixture["expected_valid"], "synthetic_contract_fixture:" + fixture["name"],
              "expected_valid=" + str(fixture["expected_valid"]) + "; observed_valid=" + str(valid))

    machine_ids = [m["id"] for m in states["machines"]]
    check(len(machine_ids) == len(set(machine_ids)) == baseline["counts"]["state_machines"], "unique_state_machine_inventory")
    machine_map = {m["id"]: m for m in states["machines"]}
    for machine in states["machines"]:
        name = machine["id"]
        nodes = machine["states"]
        edges = [(t["from"], t["to"]) for t in machine["transitions"]]
        check(len(nodes) == len(set(nodes)) and machine["initial"] in nodes, "state_nodes:" + name)
        check(all(a in nodes and b in nodes and a != b for a, b in edges) and len(edges) == len(set(edges)), "state_edges:" + name)
        check(set(machine["terminal_states"]) <= set(nodes) and not any(a in machine["terminal_states"] for a, b in edges), "terminal_has_no_outgoing:" + name)
        reachable = {machine["initial"]}
        previous = set()
        while previous != reachable:
            previous = set(reachable)
            reachable.update(b for a, b in edges if a in previous)
        check(reachable == set(nodes), "all_states_reachable:" + name)
        check(bool(machine["guards"]) and schemas[name + "State"]["enum"] == nodes, "state_contract_and_guards:" + name)
    p_edges = {(e["from"], e["to"]) for e in machine_map["ProviderSubmission"]["transitions"]}
    check(("UNKNOWN", "SUBMITTING") not in p_edges and ("UNKNOWN", "INTENT") not in p_edges, "unknown_does_not_repurchase")
    pay_edges = {(e["from"], e["to"]) for e in machine_map["Payment"]["transitions"]}
    check(("CANCELLED", "CONFIRMED") in pay_edges and ("FAILED", "CONFIRMED") in pay_edges, "late_confirmed_money_not_discarded")
    check({"Payment", "Fulfillment", "Refund", "RenderJob", "AlbumSaveItem"} <= set(machine_ids), "financial_generation_album_states_separate")

    entity_map = {e["table"]: e for e in entities["entities"]}
    check(len(entity_map) == len(entities["entities"]), "unique_data_entities")
    for e in entities["entities"]:
        check(e["primary_key"] in e["fields"] and set(e["unique_key"]) <= set(e["fields"]), "entity_keys:" + e["table"])
        check(e["scope"] != "tenant" or "tenant_id" in e["fields"], "private_entity_tenant:" + e["table"])
        check(e["scope"] != "tenant" or e["ownership_unique_key"] == ["tenant_id", e["primary_key"]], "private_entity_composite_key:" + e["table"])
    for rel in entities["critical_composite_relations"]:
        check(set(rel["fields"]) <= set(entity_map[rel["from"]]["fields"]) and set(rel["fields"]) <= set(entity_map[rel["to"]]["fields"])
              and "tenant_id" in rel["fields"], "composite_tenant_relation:" + rel["from"] + "->" + rel["to"])

    package_ids = {p["id"] for p in work["packages"]}
    check(len(package_ids) == 20, "twenty_work_packages")
    check(all(set(p["dependencies"]) <= package_ids and p["id"] not in p["dependencies"] for p in work["packages"]), "work_package_dependencies_exist")
    remaining = {p["id"]: set(p["dependencies"]) for p in work["packages"]}
    ordered = []
    while remaining:
        ready = [key for key, deps in remaining.items() if not deps]
        if not ready:
            break
        ordered.extend(ready)
        remaining = {key: deps - set(ready) for key, deps in remaining.items() if key not in ready}
    check(not remaining, "work_package_dependency_dag")
    mapping = work["requirement_mapping"]
    check(len(mapping) == 58 and {r["requirement"] for r in mapping} == expected_reqs, "all_58_requirements_mapped")
    check(dict(Counter(r["priority"] for r in mapping)) == {"P0": 52, "P1": 4, "P2": 2}, "priority_distribution_52_4_2")
    design_mapping = {r["requirement"]: r["pages"] for r in read("assets/design/柚子创作社/v1.0/requirements-design-map.json")["requirements"]}
    design_mapping.update({r["requirement"]: r["pages"] for r in read("assets/development/v1.1/design-compatibility.json")["requirements"]})
    for item in mapping:
        check(bool(item["work_packages"]) and set(item["work_packages"]) <= package_ids, "requirement_implementation_owner:" + item["requirement"])
        check(item["test_case"] == item["requirement"].replace("-F", "-T"), "requirement_acceptance_case:" + item["requirement"])
        check(item["design_pages"] == design_mapping[item["requirement"]], "requirement_design_alignment:" + item["requirement"])
        expected_components = sorted({component for page in pages if page["id"] in item["design_pages"] for component in page["components"]})
        check(item["design_components"] == expected_components, "requirement_component_alignment:" + item["requirement"])
        check(item["scope"] == ("REQUIRED_P0" if item["priority"] == "P0" else "FUTURE_" + item["priority"]), "requirement_scope:" + item["requirement"])
    check(len(work["future_backlog"]) == 6 and work["estimate"]["calendar_weeks"] is None, "future_scope_and_no_fake_schedule")

    presets = read("assets/presets/presets.v3.1.json")["presets"]
    variants = [v for p in presets for v in p["execution_variants"]]
    check(len(presets) == 10 and len(variants) == 14, "official_content_scope_preserved")
    id_validator = Draft202012Validator(schemas["ResourceId"])
    check(all(id_validator.is_valid(v["variant_id"]) for v in variants), "official_variant_ids_accepted_by_contract")
    check(all(v["sale_enabled"] is False and v["price_fen"] is None and v["provider_model_snapshot"] is None for v in variants), "official_variants_no_fake_model_or_price")
    frozen = read("assets/design/柚子创作社/v1.0/baseline-manifest.json")
    for record in frozen["files"]:
        path = ROOT / record["path"]
        check(path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == record["sha256"], "frozen_c_reference_unchanged:" + record["path"])

    dev_docs = sorted((ROOT / "docs/开发").glob("*.md"))
    check(len(dev_docs) == 20, "twenty_development_documents")
    files = dev_docs + [ROOT / p for p in ["README.md", "AGENTS.md", "CONTRIBUTING.md", "SECURITY.md", ".github/pull_request_template.md"]]
    files.extend([BASE / "README.md", BASE / "contracts/endpoint-catalog.md"])
    for path in files:
        content = path.read_text(encoding="utf-8")
        check("\ufffd" not in content and (content.startswith("# ") or path.name == "pull_request_template.md"), "markdown_encoding_title:" + path.name)
        check(sum(line.startswith("```") for line in content.splitlines()) % 2 == 0, "balanced_fences:" + path.name)
        for match in re.finditer(r"!?\[[^\]]*\]\(([^)\n]+)\)", content):
            target = match.group(1).strip("<>")
            if re.match(r"(?:https?://|mailto:|#|codex:|app:)", target):
                continue
            target = unquote(target.split("#")[0])
            resolved = (path.parent / target).resolve()
            inside = resolved == ROOT or ROOT in resolved.parents
            # Existing README has explicitly authorized links to its parent workspace documentation.
            allowed_parent = path == ROOT / "README.md" and target.startswith("../")
            check(resolved.exists() and (inside or allowed_parent), "local_link:" + str(path.relative_to(ROOT)) + "->" + target)
    env = (ROOT / ".env.example").read_text(encoding="utf-8")
    values = dict(line.split("=", 1) for line in env.splitlines() if line and not line.startswith("#"))
    check(all(values.get(k) == "false" for k in ["PAYMENTS_ENABLED", "PROVIDER_GENERATION_ENABLED", "COMMUNITY_PUBLISHING_ENABLED"]), "example_feature_flags_fail_closed")
    secret_keys = [key for key in values if re.search(r"(?:KEY|SECRET|TOKEN|DATABASE_URL)$", key)]
    check(all(values[k] == "" for k in secret_keys), "example_secrets_empty_without_reading_real_env")
    ignore = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    check({"runtime/", ".env", ".env.*", "!.env.example", "node_modules/"} <= set(ignore), "runtime_and_secret_gitignore")

    report = {"baseline_id": baseline["baseline_id"], "checked_at": datetime.now(timezone.utc).isoformat(),
              "status": "PASS" if all(c["status"] == "PASS" for c in checks) else "FAIL",
              "scope": "开发文档、官方OpenAPI结构、JSON Schema/合成正负例、状态图、实体/需求/设计/工作包追踪及C留存一致性",
              "counts": {"development_documents": len(dev_docs), "api_operations": len(ids), "openapi_schemas": len(schemas),
                         "management_api_operations": len(management_ids), "total_api_operations": len(ids) + len(management_ids),
                         "internal_schemas": len(internal), "synthetic_contract_examples": len(fixtures), "state_machines": len(machine_ids),
                         "logical_data_entities": len(entity_map), "requirements": len(mapping), "work_packages": len(package_ids),
                         "frozen_design_files": len(frozen["files"]), "checks": len(checks)},
              "passed": sum(c["status"] == "PASS" for c in checks), "failed": sum(c["status"] == "FAIL" for c in checks),
              "limitations": ["本检查仅核验文档与契约，不运行应用测试；已实现源码和局部测试证据另见 assets/implementation/current.json。", "真实供应商/支付原生协议、账户/价格与生产依赖准入仍待G0，开发版本锁定不代表生产验证通过。",
                              "合成契约例只证明指定设计约束，不能替代真实模型/媒体/支付/真机或420次基准。"],
              "product_tests_executed": False, "real_model_calls_executed": False, "real_payments_executed": False,
              "cloud_deployed": False, "checks": checks,
              "errors": [c for c in checks if c["status"] == "FAIL"]}
    (BASE / "verification-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ["status", "scope", "counts", "passed", "failed", "errors", "product_tests_executed"]}, ensure_ascii=False, indent=2))
    return int(report["status"] != "PASS")


if __name__ == "__main__":
    raise SystemExit(main())

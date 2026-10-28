"""Verify v3.1 documents/design contracts. Does not run Codex, media providers, or product tests."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

sys.dont_write_bytecode = True
from jsonschema import Draft202012Validator  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/development/v1.1"


def read(path: str | Path) -> dict:
    return json.loads((ROOT / path if isinstance(path, str) else path).read_text(encoding="utf-8"))


def save(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def canonical_hash(value: object) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def review_gate(v: dict) -> list[str]:
    """Design-level consistency of a synthetic sealed review, not a real authorization/publishing service."""
    if v["publication_decision"] != "ALLOW" and v["state"] != "PASSED":
        return []
    errors = []
    if v["state"] != "PASSED" or not v["deterministic_pass"] or not v["evidence_complete"] or v["unknown_paid_calls"]:
        errors.append("incomplete deterministic/evidence/state/paid-call gate")
    if canonical_hash(v["outputs"]) != v["output_set_hash"]:
        errors.append("candidate output hash changed")
    sealed_keys = ["packet_id", "tenant_id", "order_id", "snapshot_hash", "identity_lock_hash", "skill_bundle_hash", "qc_policy_version",
                   "original_assets", "evidence_assets", "required_slot_ids", "outputs", "output_set_hash",
                   "production_run_ids", "production_thread_ids", "production_process_refs"]
    if canonical_hash({k: v[k] for k in sealed_keys}) != v["packet_hash"]:
        errors.append("sealed packet hash changed")
    slots = [x["slot_id"] for x in v["outputs"]]
    if len(slots) != len(set(slots)) or set(slots) != set(v["required_slot_ids"]):
        errors.append("incomplete or duplicate slots")
    reports = v["reports"]
    if len(reports) != 2 or {r["role"] for r in reports} != {"REVIEW_FACTS", "REVIEW_STYLE"}:
        errors.append("two complementary reviews required")
    for key in ["run_id", "thread_id", "report_id", "runtime_process_ref", "isolation_evidence_id"]:
        values = [r[key] for r in reports]
        if len(values) != len(set(values)):
            errors.append("review identity reused: " + key)
    for r in reports:
        if (r["run_id"] in v["production_run_ids"] or r["thread_id"] in v["production_thread_ids"]
                or r["runtime_process_ref"] in v["production_process_refs"]):
            errors.append("creator context cannot sign review")
        for key in ["tenant_id", "order_id", "packet_hash", "snapshot_hash", "output_set_hash"]:
            if r[key] != v[key]:
                errors.append("review scope/hash mismatch: " + key)
        if r["verdict"] != "PASS" or not r["evidence_complete"]:
            errors.append("review failed or evidence incomplete")
        if r["policy_version"] != v["qc_policy_version"]:
            errors.append("review uses wrong frozen policy")
        if any(x["severity"] in {"BLOCKER", "MAJOR"} for x in r["findings"]):
            errors.append("unresolved critical finding")
    if len({r["policy_version"] for r in reports}) > 1:
        errors.append("review policy mismatch")
    return errors


def cleanup_gate(v: dict) -> list[str]:
    if v["state"] != "RELEASED":
        return []
    errors = []
    for key in ["processes_stopped", "capabilities_revoked", "temporary_files_removed", "runtime_history_removed",
                "durable_artifacts_preserved", "pending_submissions_detached"]:
        if v[key] is not True:
            errors.append("unverified cleanup: " + key)
    if v["verified_at"] is None or v["evidence_hash"] is None or v["error_codes"]:
        errors.append("cleanup lacks evidence or has errors")
    return errors


def main() -> int:
    checks = []

    def check(condition: bool, name: str, detail: str = "") -> None:
        checks.append({"name": name, "status": "PASS" if condition else "FAIL", "detail": detail})

    for path in [OUT / "codex-verification-report.json", ROOT / "assets/requirements/需求核验-v3.1.json"]:
        save(path, {"status": "CHECKING", "product_tests_executed": False})
    spec = importlib.util.spec_from_file_location("development_checks", ROOT / "scripts/核验开发文档.py")
    dev = importlib.util.module_from_spec(spec); spec.loader.exec_module(dev)
    check(dev.main() == 0, "existing_contract_and_development_checks")
    base_report = read(OUT / "verification-report.json")
    reqs = read("assets/requirements/requirements.v3.1.json")
    oldreqs = read("assets/requirements/requirements.v3.json")
    feature_text = (ROOT / "docs/02-功能需求与用户流程.md").read_text(encoding="utf-8")
    test_text = (ROOT / "docs/05-验收测试与实施计划.md").read_text(encoding="utf-8")
    features = re.findall(r"^### (P01-F\d{2}) (.+?)\n(.*?)(?=^### |\Z)", feature_text, re.M | re.S)
    cases = re.findall(r"^\| (P01-T\d{2}) \| (P01-F\d{2}) \| (.+?) \|$", test_text, re.M)
    expected = {f"P01-F{x:02d}" for x in range(1, 59)}
    check(len(features) == len(cases) == len(reqs["requirements"]) == 58 and {x[0] for x in features} == expected,
          "58_unique_continuous_features_and_cases")
    check(Counter(x["priority"] for x in reqs["requirements"]) == {"P0": 52, "P1": 4, "P2": 2}, "52_4_2_priorities")
    cmap = {r: (c, t) for c, r, t in cases}
    rmap = {r["id"]: r for r in reqs["requirements"]}
    for rid, title, body in features:
        r = rmap[rid]
        check(r["title"] == title and re.search(r"优先级：(P[012])。", body)[1] == r["priority"]
              and re.search(r"^验收：(.+)$", body, re.M)[1] == r["acceptance"]
              and cmap[rid] == (r["test_case"], r["test_specification"]), "live_primary_requirement:" + rid)
    for r in oldreqs["requirements"]:
        check(rmap[r["id"]]["title"] == r["title"] and rmap[r["id"]]["priority"] == r["priority"], "original_feature_preserved:" + r["id"])
    for path in (ROOT / "docs").glob("0*.md"):
        check("P01｜v3.1｜2026-10-27" in path.read_text(encoding="utf-8"), "primary_version:" + path.name)

    registry = read("assets/skills/ypcc/v1.0/registry.json")
    skill_map = {s["name"]: s for s in registry["skills"]}
    check(len(skill_map) == len(registry["skills"]) == 19, "19_unique_skills")
    check(Counter(s["layer"] for s in registry["skills"]) == {"CORE": 1, "STYLE": 10, "TARGET": 3, "ROLE": 5}, "skill_layer_counts")
    for name, s in skill_map.items():
        path = (ROOT / s["path"]).resolve()
        root = (ROOT / "assets/skills/ypcc/v1.0").resolve()
        check(root in path.parents and path.is_file() and not path.is_symlink(), "project_skill_path:" + name)
        text = path.read_text(encoding="utf-8")
        match = re.match(r"---\nname: ([a-z0-9-]+)\ndescription: ([^\n]+)\n---\n\n(.+)", text, re.S)
        check(bool(match) and match[1] == name and len(match[2]) <= 1024 and len(match[3].strip()) > 30, "skill_frontmatter_and_body:" + name)
        check(hashlib.sha256(path.read_bytes()).hexdigest() == s["sha256"], "skill_content_hash:" + name)
        check(s["trust"] == "OFFICIAL_DRAFT" and s["behavioral_evaluation"] == "NOT_RUN", "skill_no_fake_admission:" + name)
    presets = read("assets/presets/presets.v3.1.json")
    previous = read("assets/presets/presets.v3.json")
    oldpresets = {p["preset_id"]: p for p in previous["presets"]}
    variants = {v["variant_id"]: v for p in presets["presets"] for v in p["execution_variants"]}
    check(len(presets["presets"]) == 10 and len(variants) == len(registry["bundles"]) == 14, "10_styles_14_variants_bundles")
    check(presets["sale_enabled"] is False and presets["schema_version"] == "3.1", "new_preset_version_unsold")
    for p in presets["presets"]:
        check(p["name"] == oldpresets[p["preset_id"]]["name"] and p["output_slots"] == oldpresets[p["preset_id"]]["output_slots"], "preset_outputs_preserved:" + p["preset_id"])
    roles = {"CONTENT", "PRODUCTION", "POST", "REVIEW_FACTS", "REVIEW_STYLE"}
    for bundle in registry["bundles"]:
        payload = bundle["payload"]; variant = variants[payload["variant_id"]]
        check(canonical_hash(payload) == bundle["sha256"] and variant["skill_bundle"]["hash"] == bundle["sha256"], "bundle_hash_and_quote_binding:" + bundle["bundle_id"])
        check(set(payload["roles"]) == roles and payload["engine"] == variant["engine"], "bundle_roles_and_fixed_engine:" + bundle["bundle_id"])
        check(bundle["status"] == "DRAFT_NOT_ADMITTED" and bundle["release_signature"] is None and bundle["sale_enabled"] is False
              and variant["sale_enabled"] is False and variant["price_fen"] is None and variant["provider_model_snapshot"] is None, "bundle_model_price_admission_pending:" + bundle["bundle_id"])
        for role, entries in payload["roles"].items():
            styles = [x["name"] for x in entries if skill_map[x["name"]]["layer"] == "STYLE"]
            check(styles == ["ypcc-style-" + payload["preset_id"]], "one_matching_style:" + bundle["bundle_id"] + ":" + role)
            check(len(entries) == len({x["name"] for x in entries}) == 6 and all(skill_map[x["name"]]["sha256"] == x["sha256"] for x in entries), "role_skill_evidence_binding:" + bundle["bundle_id"] + ":" + role)
    check(not registry["installed_globally"] and not registry["production_admitted"], "no_global_install_or_production_claim")
    check(presets["engine_policies"] == previous["engine_policies"], "existing_slo_hard_deadlines_preserved")

    schemas = read(OUT / "contracts/openapi.json")["components"]["schemas"]
    internal = {}
    for slug in ["codex-contract", "codex-quote-binding", "agent-stage-result", "review-packet", "cleanup-receipt", "tool-call-intent"]:
        schema = read(OUT / f"contracts/{slug}.schema.json")
        Draft202012Validator.check_schema(schema)
        internal[slug] = schema
        check(schema["additionalProperties"] is False, "strict_codex_contract:" + slug)
    fixtures = read(OUT / "contracts/codex-fixtures.json")["cases"]
    for f in fixtures:
        if f["schema"] in internal:
            schema = internal[f["schema"]]
        else:
            schema = {"$ref": "#/components/schemas/" + f["schema"], "components": {"schemas": schemas}}
        errors = list(Draft202012Validator(schema, format_checker=dev.FORMATS).iter_errors(f["value"]))
        semantic = []
        if not errors and f["semantic_rule"] == "review_gate":
            semantic = review_gate(f["value"])
        if not errors and f["semantic_rule"] == "cleanup_gate":
            semantic = cleanup_gate(f["value"])
        if not errors and f["semantic_rule"] == "quote_binding":
            v = f["value"]
            if canonical_hash(v["codex_contract"]) != v["codex_contract_hash"] or v["skill_bundle_hash"] != v["codex_contract"]["skill_bundle_hash"]:
                semantic = ["Codex quote binding changed"]
        if not errors and f["semantic_rule"] == "tool_role":
            tool = next((t for t in read(OUT / "tool-policy.json")["tools"] if t["name"] == f["value"]["tool_name"]), None)
            if tool is None or f["value"]["role"] not in tool["allowed_roles"]:
                semantic = ["Tool forbidden for role"]
        check((not errors and not semantic) == f["expected_valid"], "codex_contract_example:" + f["name"],
              "; ".join([e.message[:180] for e in errors[:2]] + semantic[:2]) if (not errors and not semantic) != f["expected_valid"] else "")
    check(any(f["expected_valid"] for f in fixtures) and sum(not f["expected_valid"] for f in fixtures) >= 20, "meaningful_negative_contract_scenarios")
    policy = read(OUT / "tool-policy.json")
    check(policy["default_deny"] and policy["inference_requests_also_require_reservation_and_hard_limit"], "tool_and_inference_hard_budget_policy")
    tools = {t["name"]: t for t in policy["tools"]}
    check(all(set(t["allowed_roles"]) <= roles for t in tools.values()) and len(tools) == len(policy["tools"]), "unique_role_scoped_tools")
    check(not {"REVIEW_FACTS", "REVIEW_STYLE"} & set(tools["submit_video"]["allowed_roles"]), "reviewers_cannot_buy_video")
    check({"docker", "wsl", "virtual_machine", "arbitrary_shell", "publish_delivery", "payment", "refund"} <= set(policy["forbidden"]), "no_virtualization_or_agent_financial_publish_authority")
    implementation_path = ROOT / "assets/implementation/current.json"
    if list((ROOT / "src").rglob("*.ts")):
        implementation = read(implementation_path)
        check(implementation["status"] == "IN_PROGRESS" and not implementation["full_product_verified"]
              and not implementation["production_admitted"], "partial_implementation_not_full_product_claim")
    else:
        check(not implementation_path.exists(), "design_only_has_no_application_claim")
    baseline = read(OUT / "development-baseline.json")
    check(all(value.startswith("NOT_") for value in baseline["product_verification"].values()), "real_runtime_quality_isolation_cleanup_not_verified")
    env = dict(line.split("=", 1) for line in (ROOT / ".env.example").read_text(encoding="utf-8").splitlines() if line and not line.startswith("#"))
    check(env["CODEX_SERVICE_ENABLED"] == "false" and not env["CODEX_BINARY_PATH"] and not env["CODEX_MODEL_ID"] and not env["CODEX_CREDENTIAL_REF"], "codex_defaults_disabled_and_unconfigured")
    research = read("assets/research/agent-kernel/codex-research-20261027.json")
    for r in research["local_help_records"]:
        check(hashlib.sha256((ROOT / r["path"]).read_bytes()).hexdigest() == r["sha256"], "read_only_cli_help_record:" + r["path"])
    check(research["production_integration_verified"] is False, "research_not_a_live_integration")

    files = list((ROOT / "docs").rglob("*.md")) + list((ROOT / "assets/skills").rglob("*.md"))
    files += [ROOT / p for p in ["README.md", "AGENTS.md", "CONTRIBUTING.md", "SECURITY.md"]]
    for path in files:
        text = path.read_text(encoding="utf-8")
        check("\ufffd" not in text and sum(line.startswith("```") for line in text.splitlines()) % 2 == 0, "document_encoding_fences:" + path.relative_to(ROOT).as_posix())
        for link in re.finditer(r"!?\[[^\]]*\]\(([^)\n]+)\)", text):
            target = link[1].strip("<>")
            if re.match(r"(?:https?://|mailto:|#|codex:|app:)", target):
                continue
            resolved = (path.parent / unquote(target.split("#")[0])).resolve()
            # The primary billing document already links the shared hackathon payment requirements.
            shared_specs = (ROOT.parent / "需求文档/00-共用规范").resolve()
            allowed_parent = (path == ROOT / "README.md" and target.startswith("../")) or (
                path == ROOT / "docs/04-计费交易与运营.md" and shared_specs in resolved.parents)
            check(resolved.exists() and (ROOT in resolved.parents or allowed_parent), "document_link:" + path.relative_to(ROOT).as_posix() + "->" + target)
    # Validate preserved upstream evidence without modifying the clone.
    upstream = ROOT / "runtime/repository-review/one-tap-ads"
    import subprocess
    commit = subprocess.check_output(["git", "-C", str(upstream), "rev-parse", "HEAD"], text=True).strip()
    dirty = subprocess.check_output(["git", "-C", str(upstream), "status", "--porcelain"], text=True).strip()
    check(commit == "1aab133dd75f4db57c3f62e6da2fdd121c5d509b" and not dirty, "upstream_fixed_commit_remains_read_only")
    source = read("assets/research/one-tap-ads/方案完整目录-1aab133.json")
    for path, digest in source["source_sha256"].items():
        check(hashlib.sha256((upstream / path).read_bytes()).hexdigest() == digest, "upstream_source_hash:" + path)

    report = {"baseline_id": "YPCC-DEV-1.1.0", "requirements_version": "3.1", "checked_at": datetime.now(timezone.utc).isoformat(),
        "status": "PASS" if all(c["status"] == "PASS" for c in checks) else "FAIL",
        "scope": "文档、OpenAPI/JSON Schema、合成门禁例、需求/工作包/设计关联、Skill/Bundle摘要和历史留存；不执行产品验收",
        "counts": {"requirements": 58, "P0": 52, "skills": 19, "skill_bundles": 14, "development_documents": 20,
                   "base_contract_checks": base_report["counts"]["checks"], "codex_checks": len(checks),
                   "total_checks": base_report["counts"]["checks"] + len(checks), "codex_synthetic_examples": len(fixtures)},
        "product_tests_executed": False, "real_codex_runs_executed": False, "real_provider_calls_executed": False,
        "global_skills_installed": False, "cloud_deployed": False,
        "application_implementation_status": "IN_PROGRESS" if implementation_path.exists() else "NOT_STARTED",
        "implementation_evidence_manifest": "assets/implementation/current.json" if implementation_path.exists() else None,
        "limitations": ["本检查只执行设计 / 契约 / 留存核验；应用源码和局部测试范围另见实现证据，尚未完成完整产品验收。", "原生隔离、真实 Skill 行为、推理费用硬控制、独立质量与清理仍待G0实测。", "内容哈希/合成门禁不构成真实文件或安全效果证明。"],
        "checks": checks, "errors": [x for x in checks if x["status"] == "FAIL"]}
    save(OUT / "codex-verification-report.json", report)
    save(ROOT / "assets/requirements/需求核验-v3.1.json", {k: v for k, v in report.items() if k != "checks"})
    print(json.dumps({k: v for k, v in report.items() if k not in {"checks", "limitations"}}, ensure_ascii=False, indent=2))
    return int(report["status"] != "PASS")


if __name__ == "__main__":
    raise SystemExit(main())

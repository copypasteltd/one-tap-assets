"""Build v1.1 design contracts from preserved v1.0 artifacts and the v3.1 sources.

No runtime bootstrap, model/provider request, payment, or deployment occurs.
"""
from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / "assets/development/v1.0"
OUT = ROOT / "assets/development/v1.1"
STATUS = "DESIGN_NOT_IMPLEMENTED"
ROLES = ["CONTENT", "PRODUCTION", "POST", "REVIEW_FACTS", "REVIEW_STYLE"]


def read(path: str | Path) -> dict:
    return json.loads((ROOT / path if isinstance(path, str) else path).read_text(encoding="utf-8"))


def write(path: str | Path, text: str) -> None:
    dest = OUT / path if isinstance(path, str) else path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text.rstrip() + "\n", encoding="utf-8")


def save(path: str | Path, value: object) -> None:
    write(path, json.dumps(value, ensure_ascii=False, indent=2))


def canonical_hash(value: object) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


spec = importlib.util.spec_from_file_location("v10_generator", ROOT / "scripts/生成开发契约.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
obj, arr, enum, string, number, nullable, ref = base.obj, base.arr, base.enum, base.string, base.number, base.nullable, base.ref
ID, HASH, TIME, BOOL = base.ID, base.HASH, base.TIME, base.BOOL


def scope(properties: dict) -> dict:
    result = obj({"tenant_id": ID, "order_id": nullable(ID), "preview_session_id": nullable(ID), **properties})
    result["oneOf"] = [
        {"properties": {"order_id": ID, "preview_session_id": {"type": "null"}}},
        {"properties": {"order_id": {"type": "null"}, "preview_session_id": ID}},
    ]
    return result


def extend_creator_queries(api: dict, inventory: dict, design_map: dict) -> list[dict]:
    """Recover creator work from the server after leaving a page or losing a response."""
    schemas = api["components"]["schemas"]
    added = []
    for path, operation, title, item, requirements in [
        ("/rights-records", "listRightsRecords", "查询本人授权资料", "RightsRecord", [28, 30, 47]),
        ("/preset-drafts/{draft_id}/samples", "listPresetSamples", "恢复本人草稿的样例记录", "Sample", [28, 47]),
        ("/preset-publications", "listPresetPublications", "查询本人方案发布记录", "Publication", [28, 29]),
        ("/appeals", "listAppeals", "查询本人申诉记录", "Appeal", [31]),
        ("/creator/reports", "listAuthorReports", "查询涉及本人方案的治理状态", "Report", [28, 31]),
    ]:
        model = item + "List"
        schemas[model] = obj({"items": arr(ref(item), 0, 100), "next_cursor": nullable(string(2048))})
        wrapper = copy.deepcopy(schemas["PresetDraftListResponse"])
        wrapper["properties"]["data"] = ref(model)
        schemas[model + "Response"] = wrapper
        template = copy.deepcopy(api["paths"]["/preset-drafts"]["get"])
        reqids = [f"P01-F{n}" for n in requirements]
        pages = sorted({p for rid in reqids for p in design_map.get(rid, [])})
        template.update(operationId=operation, summary=title, description=title)
        template["parameters"] += [{"name": name, "in": "path", "required": True, "schema": ID}
                                   for name in re.findall(r"\{([^}]+)\}", path)]
        template["responses"]["200"]["content"]["application/json"]["schema"] = ref(model + "Response")
        template["x-requirements"] = reqids
        template["x-design-pages"] = pages
        api["paths"].setdefault(path, {})["get"] = template
        endpoint = {"method": "GET", "path": path, "operation_id": operation, "summary": title,
                    "request_schema": None, "response_schema": model, "success_status": 200,
                    "auth_policy": "product-session-and-resource-ownership", "idempotency_required": False,
                    "requirements": reqids, "design_pages": pages, "implementation_status": STATUS}
        inventory["endpoints"].append(endpoint)
        added.append(endpoint)
    return added


def extend_revision_query(api: dict, inventory: dict) -> dict:
    schemas = api["components"]["schemas"]
    schemas["RevisionList"] = obj({"items": arr(ref("Revision"), 0, 100), "next_cursor": nullable(string(2048))})
    wrapper = copy.deepcopy(schemas["RevisionResponse"])
    wrapper["properties"]["data"] = ref("RevisionList")
    schemas["RevisionListResponse"] = wrapper
    template = copy.deepcopy(api["paths"]["/preset-drafts"]["get"])
    template.update(operationId="listRevisions", summary="恢复本人订单的修改记录", description="按原订单恢复受限修改，分页游标绑定账户和订单")
    template["parameters"] += [{"name": "order_id", "in": "path", "required": True, "schema": ID}]
    template["responses"]["200"]["content"]["application/json"]["schema"] = ref("RevisionListResponse")
    template["x-requirements"] = ["P01-F12"]
    pages = api["paths"]["/orders/{order_id}/revisions"]["post"]["x-design-pages"]
    template["x-design-pages"] = pages
    api["paths"]["/orders/{order_id}/revisions"]["get"] = template
    endpoint = {"method": "GET", "path": "/orders/{order_id}/revisions", "operation_id": "listRevisions", "summary": template["summary"],
        "request_schema": None, "response_schema": "RevisionList", "success_status": 200,
        "auth_policy": "product-session-and-resource-ownership", "idempotency_required": False,
        "requirements": ["P01-F12"], "design_pages": pages, "implementation_status": STATUS}
    inventory["endpoints"].append(endpoint)
    return endpoint


def extend_publication_contract(api: dict, inventory: dict, design_map: dict) -> dict:
    schemas = api["components"]["schemas"]
    summary = {"license_id": ID, "version": string(40), "name": string(100),
               "state": enum("DRAFT", "ACTIVE", "RETIRED"), "content_hash": HASH,
               "fork_allowed": BOOL, "attribution_required": {"const": True}}
    definitions = {
        "PresetLicenseSummary": obj(summary),
        "PresetLicense": obj({**summary, "full_text": string(30000, 30)}),
        "PresetLicenseList": obj({"items": arr(ref("PresetLicenseSummary"), 0, 100), "next_cursor": nullable(string(2048))}),
        "PresetLicenseRegistration": obj({"license_id": ID, "version": string(40), "name": string(100),
            "full_text": string(30000, 30), "fork_allowed": BOOL, "attribution_required": {"const": True}}),
        "PresetLicenseDecision": obj({"expected_state": enum("DRAFT", "ACTIVE"), "expected_content_hash": HASH,
            "decision": enum("APPROVE", "RETIRE"), "review_reference": string(1000), "reason": string(3000)}),
    }
    for name in ("PresetLicense", "PresetLicenseList"):
        wrapper = copy.deepcopy(schemas["PresetDraftListResponse"])
        wrapper["properties"]["data"] = ref(name)
        definitions[name + "Response"] = wrapper
    schemas.update(definitions)
    schemas["PublicationRequest"]["properties"].update(license_content_hash=HASH, accept_license={"const": True},
        accept_sample_publication={"const": True}, public_sample_retention_days={"const": 30})
    schemas["PublicationRequest"]["required"] += ["license_content_hash", "accept_license", "accept_sample_publication", "public_sample_retention_days"]
    schemas["RightsRecordRequest"]["properties"]["product_id"] = ID
    schemas["RightsRecord"]["properties"].update(product_id=nullable(ID), photo_version=nullable(number()), resource_version_ids=arr(ID, 0, 30))
    schemas["Sample"]["properties"].update(product_id=ID, variant_blueprint_id=ID, draft_revision=number())
    schemas["Publication"]["properties"]["review_message"] = nullable(string(3000))
    schemas["Publication"]["properties"].update(public_sample_state=enum("NONE", "PREPARING", "READY", "PUBLISHED", "WITHDRAWN", "EXPIRED", "FAILED"),
        public_sample_expires_at=nullable(TIME), public_sample_ids=arr(ID, 0, 100))
    schemas["PublicSampleWithdrawalRequest"] = obj({"expected_revision": number(), "reason": string(1000)})
    withdrawal_path = "/preset-publications/{publication_id}/sample-withdrawals"
    template = copy.deepcopy(api["paths"]["/preset-drafts/{draft_id}/submit"]["post"])
    reqids = ["P01-F15", "P01-F28", "P01-F29", "P01-F30"]
    pages = sorted({p for rid in reqids for p in design_map[rid]})
    template.update(operationId="withdrawPublicSamples", summary="撤回本次发布的全部公开样例", description="立即停止公开分发并停售；私有源样例保持独立。")
    template["parameters"] = [p for p in template["parameters"] if p.get("in") != "path"] + [{"name": "publication_id", "in": "path", "required": True, "schema": ID}]
    template["requestBody"]["content"]["application/json"]["schema"] = ref("PublicSampleWithdrawalRequest")
    template["responses"]["200"] = copy.deepcopy(template["responses"].pop("202"))
    template["responses"]["200"]["content"]["application/json"]["schema"] = ref("PublicationResponse")
    template["x-requirements"] = reqids; template["x-design-pages"] = pages
    api["paths"][withdrawal_path] = {"post": template}
    inventory["endpoints"].append({"method": "POST", "path": withdrawal_path, "operation_id": "withdrawPublicSamples", "summary": template["summary"],
        "request_schema": "PublicSampleWithdrawalRequest", "response_schema": "Publication", "success_status": 200,
        "auth_policy": "product-session-and-resource-ownership", "idempotency_required": True,
        "requirements": reqids, "design_pages": pages, "implementation_status": STATUS})
    for path, operation, title, model in [
        ("/preset-licenses", "listPresetLicenses", "查询社区方案许可版本", "PresetLicenseList"),
        ("/preset-licenses/{license_id}", "getPresetLicense", "读取指定版本的完整许可", "PresetLicense"),
    ]:
        template = copy.deepcopy(api["paths"]["/preset-drafts"]["get"])
        template.update(operationId=operation, summary=title, description=title, security=[])
        template["x-auth-policy"] = "public-rate-limited"
        template["parameters"] = ([{"name": "license_id", "in": "path", "required": True, "schema": ID}]
            if "{license_id}" in path else template["parameters"])
        template["responses"]["200"]["content"]["application/json"]["schema"] = ref(model + "Response")
        reqids = ["P01-F28", "P01-F29", "P01-F30"]
        pages = sorted({p for rid in reqids for p in design_map[rid]})
        template["x-requirements"] = reqids; template["x-design-pages"] = pages
        api["paths"].setdefault(path, {})["get"] = template
        inventory["endpoints"].append({"method": "GET", "path": path, "operation_id": operation, "summary": title,
            "request_schema": None, "response_schema": model, "success_status": 200, "auth_policy": "public-rate-limited",
            "idempotency_required": False, "requirements": reqids, "design_pages": pages, "implementation_status": STATUS})
    definitions.update({name: copy.deepcopy(schemas[name]) for name in
        ("PublicationRequest", "RightsRecordRequest", "RightsRecord", "Sample", "Publication", "PublicSampleWithdrawalRequest")})
    return definitions


def add_machines(data: dict) -> None:
    def add(name: str, initial: str, terminals: list[str], edges: dict, guard: str) -> None:
        nodes = list(dict.fromkeys([initial, *edges, *[x for values in edges.values() for x in values]]))
        data["machines"].append({"id": name, "initial": initial, "states": nodes, "terminal_states": terminals,
                                 "transitions": [{"from": a, "to": b} for a, values in edges.items() for b in values],
                                 "guards": [guard], "implementation_status": STATUS})
    add("AgentInstance", "REQUESTED", ["RELEASED"], {
        "REQUESTED": ["PREPARING", "DRAINING"], "PREPARING": ["READY", "DRAINING"],
        "READY": ["ACTIVE", "DRAINING"], "ACTIVE": ["DRAINING"], "DRAINING": ["RELEASING"],
        "RELEASING": ["RELEASED", "CLEANUP_FAILED"], "CLEANUP_FAILED": ["RELEASING"]},
        "同单原生权限隔离；终态outbox触发回收；证据核实后才RELEASED，清理失败隔离重试；SUSPEND不取消外部任务。")
    add("AgentRun", "QUEUED", ["SUCCEEDED", "FAILED", "INTERRUPTED", "CHECKPOINTED"], {
        "QUEUED": ["LOADING_SKILLS", "FAILED", "INTERRUPTED"],
        "LOADING_SKILLS": ["RUNNING", "FAILED", "INTERRUPTED"],
        "RUNNING": ["SUCCEEDED", "FAILED", "INTERRUPTED", "CHECKPOINTED", "UNKNOWN"],
        "UNKNOWN": ["FAILED", "INTERRUPTED", "CHECKPOINTED", "SUCCEEDED"]},
        "显式Skill注入和严格结果校验；事件/工具副作用持久化；断连接不重新购买，恢复用新run及原预算。")
    add("ReviewPacket", "SEALED", ["FAILED", "INSUFFICIENT_EVIDENCE", "STALE"], {
        "SEALED": ["REVIEWING", "STALE"], "REVIEWING": ["PASSED", "FAILED", "INSUFFICIENT_EVIDENCE", "STALE"],
        "PASSED": ["STALE"]},
        "两份新上下文与确定性检测全通过；任何候选变动使旧包STALE，修复后新包重新复核，发布另受事务保护。")
    add("SkillBundle", "DRAFT_NOT_ADMITTED", ["REVOKED"], {
        "DRAFT_NOT_ADMITTED": ["VALIDATING", "REVOKED"], "VALIDATING": ["ADMITTED", "DRAFT_NOT_ADMITTED", "REVOKED"],
        "ADMITTED": ["REVOKED"]},
        "文件摘要/权利/行为/成本及正式批准缺一不准入；撤销不覆盖历史快照，已付不可履约按退款政策处置。")
    data["schema_version"] = "1.1.0"


def new_schemas(machines: dict) -> dict:
    s = {m["id"] + "State": enum(*m["states"]) for m in machines["machines"] if m["id"] in {"AgentInstance", "AgentRun", "ReviewPacket", "SkillBundle"}}
    s["AgentRole"] = enum(*ROLES)
    s["CodexContract"] = obj({
        "runtime_kind": {"const": "CODEX_APP_SERVER"}, "runtime_build_id": ID, "runtime_sha256": HASH,
        "protocol_version": string(100), "model_version_id": ID, "rate_version_id": ID,
        "skill_bundle_id": ID, "skill_bundle_version": string(40), "skill_bundle_hash": HASH,
        "role_prompt_version": ID, "tool_policy_version": ID, "qc_policy_version": ID,
        "required_roles": {**arr(enum(*ROLES), 5, 5), "uniqueItems": True},
        "max_turns_per_role": number(100, 1), "max_input_tokens": number(1000000000, 1),
        "max_output_tokens": number(1000000000, 1), "max_tool_calls": number(10000, 1),
        "agent_cost_ceiling_micro": number(9007199254740991, 1),
        "inference_spend_control": {"const": "PRE_REQUEST_RESERVATION_AND_HARD_LIMIT"},
        "independent_reviewers": {"const": 2}, "review_context_policy": {"const": "FRESH_THREADS_NO_CREATOR_HISTORY"},
        "isolation": {"const": "NATIVE_RESTRICTED_IDENTITY"}, "release_after_terminal": {"const": True},
        "release_grace_seconds": number(120, 1), "release_target_seconds": number(3600, 1),
        "repair_extends_deadline": {"const": False}})
    s["CodexQuoteBinding"] = obj({"tenant_id": ID, "quote_id": ID, "preview_session_id": ID,
        "plan_hash": HASH, "codex_contract": copy.deepcopy(s["CodexContract"]), "codex_contract_hash": HASH,
        "skill_bundle_hash": HASH, "expires_at": TIME})
    s["AgentInstance"] = scope({"instance_id": ID, "state": ref("AgentInstanceState"),
        "fencing_token": number(9007199254740991, 1), "os_identity_ref": ID, "workspace_ref": ID,
        "isolation_profile_id": ID, "skill_bundle_id": ID, "run_ids": arr(ID, 0, 100),
        "allocated_at": TIME, "lease_expires_at": TIME,
        "release_reason": nullable(enum("DELIVERED", "FAILED", "CANCELLED", "SUSPEND", "PREQUOTE_COMPLETE", "EXPIRED"))})
    s["AgentInstanceList"] = obj({"items": arr(ref("AgentInstance")), "next_cursor": nullable(string(500))})
    s["AgentReleaseRequest"] = obj({"reason": enum("TERMINAL_RECONCILIATION", "ORPHAN_RECOVERY", "SUSPEND"),
                                   "expected_fencing_token": number(9007199254740991, 1), "ticket_id": ID})
    s["AgentRun"] = scope({"run_id": ID, "instance_id": ID, "role": ref("AgentRole"),
        "thread_id": nullable(ID), "turn_id": nullable(ID), "state": ref("AgentRunState"),
        "runtime_process_ref": nullable(ID), "role_identity_ref": ID, "role_workspace_ref": ID,
        "input_hash": HASH, "output_hash": nullable(HASH), "checkpoint_hash": nullable(HASH),
        "skill_bundle_hash": HASH, "loaded_skill_hashes": {**arr(HASH, 0, 30), "uniqueItems": True},
        "spend_reserved_micro": number(9007199254740991), "spend_confirmed_micro": number(9007199254740991),
        "deadline_at": TIME, "fencing_token": number(9007199254740991, 1)})
    s["AgentStageResult"] = scope({"run_id": ID, "role": ref("AgentRole"), "input_hash": HASH,
        "snapshot_hash": nullable(HASH), "skill_bundle_hash": HASH, "output_asset_ids": arr(ID, 1, 100),
        "tool_receipt_ids": arr(ID, 1, 1000), "checkpoint_hash": HASH,
        "result": enum("READY", "BLOCKED", "FAILED"), "reason_codes": arr(ID, 0, 30)})
    finding = obj({"category": enum("PRODUCT", "FACT", "SPEC", "AUDIO", "CAPTION", "STYLE", "CONTINUITY", "EVIDENCE"),
                   "severity": enum("BLOCKER", "MAJOR", "MINOR"), "evidence_ids": arr(ID, 0, 50),
                   "time_ms": nullable(number(10000000)), "detail": string(2000)})
    report = obj({"report_id": ID, "tenant_id": ID, "order_id": ID, "run_id": ID, "thread_id": ID,
        "runtime_process_ref": ID, "isolation_evidence_id": ID,
        "role": enum("REVIEW_FACTS", "REVIEW_STYLE"), "packet_hash": HASH, "snapshot_hash": HASH,
        "output_set_hash": HASH, "verdict": enum("PASS", "FAIL", "INSUFFICIENT_EVIDENCE"),
        "evidence_complete": BOOL, "findings": arr(finding, 0, 100), "policy_version": ID})
    s["ReviewReport"] = report
    s["ReviewPacket"] = obj({"packet_id": ID, "tenant_id": ID, "order_id": ID,
        "state": ref("ReviewPacketState"), "packet_hash": HASH, "snapshot_hash": HASH,
        "identity_lock_hash": HASH, "skill_bundle_hash": HASH, "qc_policy_version": ID,
        "original_assets": arr(obj({"asset_id": ID, "sha256": HASH}), 3, 5),
        "evidence_assets": arr(obj({"asset_id": ID, "sha256": HASH}), 1, 1000),
        "output_set_hash": HASH, "required_slot_ids": {**arr(ID, 1, 100), "uniqueItems": True},
        "outputs": arr(obj({"slot_id": ID, "asset_id": ID, "sha256": HASH}), 1, 100),
        "production_run_ids": {**arr(ID, 1, 100), "uniqueItems": True},
        "production_thread_ids": {**arr(ID, 1, 100), "uniqueItems": True},
        "production_process_refs": {**arr(ID, 1, 100), "uniqueItems": True},
        "reports": arr(report, 0, 2), "deterministic_pass": BOOL, "evidence_complete": BOOL,
        "unknown_paid_calls": number(1000), "publication_decision": enum("PENDING", "ALLOW", "BLOCK")})
    s["CleanupReceipt"] = scope({"cleanup_receipt_id": ID, "instance_id": ID,
        "fencing_token": number(9007199254740991, 1), "state": enum("RELEASING", "RELEASED", "CLEANUP_FAILED"),
        "release_reason": enum("DELIVERED", "FAILED", "CANCELLED", "SUSPEND", "PREQUOTE_COMPLETE", "EXPIRED"),
        "processes_stopped": BOOL, "capabilities_revoked": BOOL, "temporary_files_removed": BOOL,
        "runtime_history_removed": BOOL, "durable_artifacts_preserved": BOOL, "pending_submissions_detached": BOOL,
        "pending_provider_submission_ids": {**arr(ID, 0, 1000), "uniqueItems": True}, "verified_at": nullable(TIME),
        "evidence_hash": nullable(HASH), "error_codes": arr(ID, 0, 30)})
    s["SkillBundleResource"] = obj({"bundle_id": ID, "version": string(40), "sha256": HASH,
        "state": ref("SkillBundleState"), "signature_ref": nullable(ID), "evaluation_id": nullable(ID),
        "skill_hashes": {**arr(HASH, 1, 30), "uniqueItems": True}})
    s["SkillBundleList"] = obj({"items": arr(ref("SkillBundleResource")), "next_cursor": nullable(string(500))})
    s["SkillBundleRevokeRequest"] = obj({"expected_bundle_hash": HASH, "reason_code": ID, "ticket_id": ID})
    s["ToolCallIntent"] = scope({"intent_id": ID, "instance_id": ID,
        "run_id": ID, "role": ref("AgentRole"), "tool_name": ID, "snapshot_hash": HASH, "request_hash": HASH,
        "idempotency_key": string(200), "fencing_token": number(9007199254740991, 1),
        "reservation_id": ID, "reserved_cost_micro": number(9007199254740991), "currency": {"const": "CNY"},
        "state": enum("INTENT", "SUBMITTING", "ACKNOWLEDGED", "UNKNOWN", "SUCCEEDED", "FAILED"),
        "provider_submission_id": nullable(ID), "capability_expires_at": TIME, "deadline_at": TIME})
    for name in ["AgentInstanceList", "AgentInstance", "AgentRun", "ReviewPacket", "CleanupReceipt", "SkillBundleList", "SkillBundleResource"]:
        s[name + "Response"] = obj({"data": ref(name), "trace_id": ID})
    return s


def standalone(name: str, schemas: dict) -> dict:
    needed = {}

    def convert(value: object):
        if isinstance(value, list):
            return [convert(x) for x in value]
        if not isinstance(value, dict):
            return value
        out = {}
        for key, child in value.items():
            if key == "$ref" and child.startswith("#/components/schemas/"):
                target = child.rsplit("/", 1)[1]
                if target not in needed:
                    needed[target] = {}
                    needed[target] = convert(schemas[target])
                out[key] = "#/$defs/" + target
            else:
                out[key] = convert(child)
        return out
    result = convert(schemas[name])
    result.update({"$schema": "https://json-schema.org/draft/2020-12/schema", "title": name,
                   "x-implementation-status": STATUS})
    if needed:
        result["$defs"] = needed
    return result


def contract_example(bundle: dict) -> dict:
    return {"runtime_kind": "CODEX_APP_SERVER", "runtime_build_id": "fixture_build", "runtime_sha256": "a" * 64,
            "protocol_version": "fixture-protocol", "model_version_id": "fixture_codex_model", "rate_version_id": "fixture_rate",
            "skill_bundle_id": bundle["bundle_id"], "skill_bundle_version": bundle["version"], "skill_bundle_hash": bundle["sha256"],
            "role_prompt_version": "fixture_prompts", "tool_policy_version": "fixture_tools", "qc_policy_version": "fixture_qc",
            "required_roles": ROLES, "max_turns_per_role": 4, "max_input_tokens": 100000, "max_output_tokens": 10000,
            "max_tool_calls": 30, "agent_cost_ceiling_micro": 100000,
            "inference_spend_control": "PRE_REQUEST_RESERVATION_AND_HARD_LIMIT", "independent_reviewers": 2,
            "review_context_policy": "FRESH_THREADS_NO_CREATOR_HISTORY", "isolation": "NATIVE_RESTRICTED_IDENTITY",
            "release_after_terminal": True, "release_grace_seconds": 30, "release_target_seconds": 300,
            "repair_extends_deadline": False}


def add_fixtures(contract: dict) -> dict:
    cases = []

    def add(name: str, schema: str, value: dict, valid: bool, semantic: str | None = None) -> None:
        cases.append({"name": name, "schema": schema, "value": copy.deepcopy(value), "expected_valid": valid, "semantic_rule": semantic})
    add("frozen_codex_contract", "codex-contract", contract, True)
    for name, key, value in [("cannot_disable_review", "independent_reviewers", 1),
                             ("cannot_reuse_creator_context", "review_context_policy", "FORK_CREATOR_HISTORY"),
                             ("cannot_use_virtualization", "isolation", "DOCKER"),
                             ("cannot_use_soft_budget_as_hard", "inference_spend_control", "USAGE_EVENT_ONLY"),
                             ("cannot_extend_deadline", "repair_extends_deadline", True)]:
        bad = copy.deepcopy(contract); bad[key] = value
        add(name, "codex-contract", bad, False)
    binding = {"tenant_id": "fixture_tenant", "quote_id": "fixture_quote", "preview_session_id": "fixture_preview",
        "plan_hash": "b" * 64, "codex_contract": contract, "codex_contract_hash": canonical_hash(contract),
        "skill_bundle_hash": contract["skill_bundle_hash"], "expires_at": "2026-10-27T00:15:00Z"}
    add("freeze_codex_before_order_exists", "codex-quote-binding", binding, True, "quote_binding")
    bad = copy.deepcopy(binding); bad["codex_contract"]["skill_bundle_hash"] = "f" * 64
    add("changed_codex_quote_contract_rejected", "codex-quote-binding", bad, False, "quote_binding")
    intent = {"tenant_id": "fixture_tenant", "order_id": None, "preview_session_id": "fixture_preview",
        "intent_id": "fixture_intent", "instance_id": "fixture_instance", "run_id": "fixture_content", "role": "CONTENT",
        "tool_name": "analyze_photos", "snapshot_hash": "b" * 64, "request_hash": "c" * 64,
        "idempotency_key": "fixture_original_analysis", "fencing_token": 1, "reservation_id": "fixture_preview_reservation",
        "reserved_cost_micro": 1, "currency": "CNY", "state": "INTENT", "provider_submission_id": None,
        "capability_expires_at": "2026-10-27T00:01:00Z", "deadline_at": "2026-10-27T00:02:00Z"}
    add("prequote_tool_has_preview_scope", "tool-call-intent", intent, True, "tool_role")
    bad = copy.deepcopy(intent); bad["order_id"] = "fixture_order"
    add("tool_cannot_mix_preview_order", "tool-call-intent", bad, False, "tool_role")
    bad = copy.deepcopy(intent); bad["role"] = "REVIEW_STYLE"
    add("style_reviewer_cannot_run_product_analysis", "tool-call-intent", bad, False, "tool_role")
    instance = {"instance_id": "fixture_instance", "tenant_id": "fixture_tenant", "order_id": "fixture_order", "preview_session_id": None,
                "state": "READY", "fencing_token": 1, "os_identity_ref": "fixture_identity", "workspace_ref": "fixture_workspace",
                "isolation_profile_id": "fixture_native_profile", "skill_bundle_id": contract["skill_bundle_id"], "run_ids": [],
                "allocated_at": "2026-10-27T00:00:00Z", "lease_expires_at": "2026-10-27T00:01:00Z", "release_reason": None}
    add("paid_scope", "AgentInstance", instance, True)
    preview = copy.deepcopy(instance); preview.update(order_id=None, preview_session_id="fixture_preview")
    add("prequote_scope", "AgentInstance", preview, True)
    bad = copy.deepcopy(instance); bad["preview_session_id"] = "fixture_preview"
    add("cannot_mix_order_preview", "AgentInstance", bad, False)
    outputs = [{"slot_id": "fixture_image_slot", "asset_id": "fixture_image", "sha256": "b" * 64},
               {"slot_id": "fixture_video_slot", "asset_id": "fixture_video", "sha256": "c" * 64}]
    packet = {"packet_id": "fixture_packet", "tenant_id": "fixture_tenant", "order_id": "fixture_order", "state": "PASSED",
              "packet_hash": "d" * 64, "snapshot_hash": "e" * 64, "output_set_hash": canonical_hash(outputs),
              "identity_lock_hash": "a" * 64, "skill_bundle_hash": contract["skill_bundle_hash"], "qc_policy_version": "fixture_qc",
              "original_assets": [{"asset_id": f"fixture_original_{i}", "sha256": str(i) * 64} for i in range(3)],
              "evidence_assets": [{"asset_id": "fixture_actual_media_evidence", "sha256": "f" * 64}],
              "required_slot_ids": ["fixture_image_slot", "fixture_video_slot"], "outputs": outputs,
              "production_run_ids": ["fixture_make", "fixture_post"], "production_thread_ids": ["fixture_make_thread", "fixture_post_thread"],
              "production_process_refs": ["fixture_make_process", "fixture_post_process"],
              "reports": [], "deterministic_pass": True, "evidence_complete": True, "unknown_paid_calls": 0, "publication_decision": "ALLOW"}
    sealed_keys = ["packet_id", "tenant_id", "order_id", "snapshot_hash", "identity_lock_hash", "skill_bundle_hash", "qc_policy_version",
                   "original_assets", "evidence_assets", "required_slot_ids", "outputs", "output_set_hash",
                   "production_run_ids", "production_thread_ids", "production_process_refs"]
    packet["packet_hash"] = canonical_hash({k: packet[k] for k in sealed_keys})
    for index, role in enumerate(["REVIEW_FACTS", "REVIEW_STYLE"]):
        packet["reports"].append({"report_id": f"fixture_report_{index}", "tenant_id": packet["tenant_id"], "order_id": packet["order_id"],
            "run_id": f"fixture_review_{index}", "thread_id": f"fixture_review_thread_{index}", "role": role,
            "runtime_process_ref": f"fixture_review_process_{index}", "isolation_evidence_id": f"fixture_isolation_evidence_{index}",
            "packet_hash": packet["packet_hash"], "snapshot_hash": packet["snapshot_hash"], "output_set_hash": packet["output_set_hash"],
            "verdict": "PASS", "evidence_complete": True, "findings": [], "policy_version": "fixture_qc"})
    add("two_fresh_reviews_allow_delivery", "review-packet", packet, True, "review_gate")
    for name, mutate in [
        ("creator_cannot_sign_review", lambda v: v["reports"][0].update(run_id="fixture_make")),
        ("creator_thread_cannot_review", lambda v: v["reports"][0].update(thread_id="fixture_make_thread")),
        ("two_reviews_cannot_share_thread", lambda v: v["reports"][1].update(thread_id=v["reports"][0]["thread_id"])),
        ("two_reviews_cannot_share_run", lambda v: v["reports"][1].update(run_id=v["reports"][0]["run_id"])),
        ("two_reviews_cannot_share_process", lambda v: v["reports"][1].update(runtime_process_ref=v["reports"][0]["runtime_process_ref"])),
        ("producer_process_cannot_review", lambda v: v["reports"][0].update(runtime_process_ref="fixture_make_process")),
        ("wrong_qc_policy_rejected", lambda v: v["reports"][0].update(policy_version="other_policy")),
        ("original_evidence_changed_rejected", lambda v: v["original_assets"][0].update(sha256="f" * 64)),
        ("old_output_review_rejected", lambda v: v["reports"][0].update(output_set_hash="f" * 64)),
        ("cross_tenant_review_rejected", lambda v: v["reports"][0].update(tenant_id="other_tenant")),
        ("changed_asset_invalidates_review", lambda v: v["outputs"][0].update(sha256="f" * 64)),
        ("missing_slot_rejected", lambda v: v["required_slot_ids"].append("fixture_missing")),
        ("unknown_paid_task_blocks_publish", lambda v: v.update(unknown_paid_calls=1)),
        ("detector_failure_blocks_publish", lambda v: v.update(deterministic_pass=False)),
        ("insufficient_audio_blocks_publish", lambda v: v["reports"][0].update(evidence_complete=False)),
        ("review_disagreement_blocks_publish", lambda v: v["reports"][1].update(verdict="FAIL")),
        ("single_review_not_enough", lambda v: v["reports"].pop()),
    ]:
        bad = copy.deepcopy(packet); mutate(bad)
        add(name, "review-packet", bad, False, "review_gate")
    receipt = {"tenant_id": "fixture_tenant", "order_id": "fixture_order", "preview_session_id": None,
        "cleanup_receipt_id": "fixture_cleanup", "instance_id": "fixture_instance", "fencing_token": 1,
        "state": "RELEASED", "release_reason": "DELIVERED", "processes_stopped": True, "capabilities_revoked": True,
        "temporary_files_removed": True, "runtime_history_removed": True, "durable_artifacts_preserved": True,
        "pending_submissions_detached": True, "pending_provider_submission_ids": ["fixture_unresolved_intent"],
        "verified_at": "2026-10-27T00:00:00Z", "evidence_hash": "f" * 64, "error_codes": []}
    add("release_preserves_delivery_and_reconciliation", "cleanup-receipt", receipt, True, "cleanup_gate")
    for name, key, value in [("live_process_not_released", "processes_stopped", False),
                             ("live_capability_not_released", "capabilities_revoked", False),
                             ("private_history_not_released", "runtime_history_removed", False),
                             ("delivery_deleted_not_released", "durable_artifacts_preserved", False),
                             ("unknown_intent_lost_not_released", "pending_submissions_detached", False),
                             ("no_cleanup_evidence_not_released", "evidence_hash", None)]:
        bad = copy.deepcopy(receipt); bad[key] = value
        add(name, "cleanup-receipt", bad, False, "cleanup_gate")
    return {"status": "SYNTHETIC_CONTRACT_EXAMPLES_ONLY", "product_tests_executed": False, "cases": cases}


def extend_data(data: dict) -> None:
    definitions = [
        ("skill_versions", "skill_version_id", "platform", ["name", "version", "content_hash", "trust_state", "license_ref"], ["name", "version"], "不可变内容摘要；未准入指令包无生产执行权"),
        ("skill_bundles", "bundle_id", "platform", ["version", "bundle_hash", "skill_versions", "state", "evaluation_id", "signature_ref"], ["bundle_id", "version"], "冻结实际Skill/角色/工具策略；撤销不覆盖旧单"),
        ("agent_instances", "instance_id", "tenant", ["order_id", "preview_session_id", "state", "fencing_token", "os_identity_ref", "workspace_ref", "lease_expires_at"], ["instance_id"], "订单或preview二选一；原生身份/ACL，终态回收不删成品"),
        ("agent_runs", "run_id", "tenant", ["instance_id", "role", "thread_id", "turn_id", "runtime_process_ref", "role_identity_ref", "role_workspace_ref", "state", "input_hash", "output_hash", "checkpoint_hash", "spent_micro"], ["run_id"], "角色上下文/进程及目录权限隔离；检查点恢复不清零预算"),
        ("skill_load_evidence", "load_id", "tenant", ["run_id", "bundle_hash", "skill_hashes", "injection_request_hash", "runtime_receipt_hash"], ["run_id", "bundle_hash"], "发现与全文注入分别记录，非行为服从证明"),
        ("agent_tool_intents", "intent_id", "tenant", ["order_id", "run_id", "idempotency_key", "request_hash", "reservation_id", "state", "provider_submission_id"], ["order_id", "idempotency_key"], "网关每次鉴权/原子预留，UNKNOWN查原任务"),
        ("agent_cost_reservations", "reservation_id", "tenant", ["order_id", "preview_session_id", "subject_ref", "run_id", "idempotency_key", "amount_micro", "rate_snapshot", "state", "provider_reservation_id"], ["subject_ref", "idempotency_key"], "订单或preview成本域；重启沿同一意图，供应商包装预留关联后只计一次"),
        ("review_packets", "packet_id", "tenant", ["order_id", "snapshot_hash", "output_set_hash", "packet_hash", "state"], ["order_id", "packet_hash"], "输入/候选封存，变动使旧报告失效"),
        ("review_reports", "report_id", "tenant", ["packet_id", "run_id", "thread_id", "role", "verdict", "evidence_hash"], ["packet_id", "role", "run_id"], "事实与风格新上下文，制作方不可自签"),
        ("cleanup_receipts", "cleanup_receipt_id", "tenant", ["instance_id", "fencing_token", "state", "evidence_hash", "verified_at"], ["instance_id", "fencing_token"], "能力/进程/临时文件核验后才RELEASED，失败重试保留审计"),
        ("community_licenses", "license_id", "platform", ["version", "state", "content_hash", "full_text", "fork_allowed", "attribution_required", "review_reference"], ["license_id"], "全文/摘要/派生条件不可改写；独立审核启用，退役停止新发布和新交易"),
        ("authorized_samples", "public_sample_id", "tenant", ["owner_id", "publication_id", "source_sample_id", "source_product_id", "input_hash", "state", "expires_at", "media_hash"], ["publication_id", "source_sample_id"], "独立公开副本与30天单独授权；撤回立即停止分发和新销售，原图自然到期不延长"),
    ]
    definitions += [
        ("revision_budgets", "budget_id", "tenant", ["owner_id", "order_id", "policy_hash", "ceiling_micro", "spent_micro", "reserved_micro"], ["order_id"], "售前冻结原订单内修改成本；制作预留扣除该额度，失败重试不重置"),
        ("revision_cost_reservations", "reservation_id", "tenant", ["budget_id", "revision_id", "intent_key", "amount_micro", "settled_micro", "state", "rate_snapshot"], ["intent_key"], "UNKNOWN按原推理回执结算；所有修改尝试共享原订单账户"),
    ]
    for table, pk, scope_name, fields, unique, invariant in definitions:
        tenant = scope_name == "tenant"
        cols = list(dict.fromkeys([pk, *(["tenant_id"] if tenant else []), *fields]))
        unique_cols = list(dict.fromkeys([*(["tenant_id"] if tenant else []), *unique]))
        data["entities"].append({"table": table, "primary_key": pk, "scope": scope_name, "fields": cols,
            "unique_key": unique_cols, "ownership_unique_key": ["tenant_id", pk] if tenant else None,
            "invariant": invariant, "implementation_status": STATUS})
    for src, target, key in [("agent_runs", "agent_instances", "instance_id"), ("skill_load_evidence", "agent_runs", "run_id"),
                              ("agent_tool_intents", "agent_runs", "run_id"), ("review_reports", "review_packets", "packet_id"),
                              ("agent_tool_intents", "agent_cost_reservations", "reservation_id"),
                              ("cleanup_receipts", "agent_instances", "instance_id")]:
        data["critical_composite_relations"].append({"from": src, "to": target, "fields": ["tenant_id", key],
                                                      "target_fields": ["tenant_id", key]})
    data["schema_version"] = "1.1.0"
    for entity in data["entities"]:
        if entity["table"] == "agent_tool_intents":
            entity["fields"] += ["preview_session_id", "subject_ref"]
            entity["unique_key"] = ["tenant_id", "subject_ref", "idempotency_key"]
        if entity["table"] == "quotes":
            entity["fields"] += ["codex_contract_json", "codex_contract_hash", "skill_bundle_hash"]
        if entity["table"] == "execution_snapshots":
            entity["fields"] += ["codex_contract_hash", "skill_bundle_hash"]
        if entity["table"] == "optional_previews":
            entity["fields"] += ["private_frozen_input", "input_hash", "renderer_version", "original_output_checkpoint"]
            entity["invariant"] += "; 原计划/商品证据/资源及绝对到期冻结；先保存输出意图再登记一次性私有写入；UNKNOWN只核对原键；READY须实际字节校验；不延长输入或占用订单预算"
    data["transactions"] += ["freeze_codex_contract_with_quote", "reserve_agent_and_inference_cost_without_double_counting", "publish_reviews_manifest_and_release_outbox", "claim_release_and_verify_cleanup_receipt"]
    data["immutable_records"] += ["skill_versions", "review_reports"]
    data["immutable_payload_fields"] = {"skill_bundles": ["version", "bundle_hash", "skill_versions"],
                                         "review_packets": ["snapshot_hash", "output_set_hash", "packet_hash"]}


def extend_work(reqs: list, dmap: dict, pages: list) -> dict:
    work = read(OLD / "work-packages.json")
    definitions = [
        ("CX-01", "Codex原生运行时与每单实例/释放", [], "G0-CX→G2", [51, 53, 56, 57], "src/worker", "锁定协议、原生身份/ACL/进程树、检查点/回收与孤儿证据"),
        ("CX-02", "可信Skill供应与风格目标冻结", [], "G0-CX→G3", [52, 58], "assets/skills", "19份Skill行为验证、10风格/14绑定、摘要/签名/准入/撤销"),
        ("CX-03", "受控MCP工具与推理出口预算恢复", ["CX-01", "CX-02"], "G1→G2", [51, 54, 56], "src/worker", "每调用鉴权与推理出口硬限额、意图/原子预留/UNKNOWN/代次恢复"),
        ("CX-04", "独立双复核与Codex准入评测", ["CX-03"], "G1→G4", [55, 57, 58], "tests", "封存审查包/真实检测/双新会话、420次/专项40组、对照成本与回收"),
    ]
    for pid, name, deps, gate, numbers, target, evidence in definitions:
        work["packages"].append({"id": pid, "name": name, "dependencies": deps, "delivery_gate": gate,
            "requirements": [f"P01-F{x:02d}" for x in numbers], "target_path": target, "done_evidence": evidence,
            "implementation_status": STATUS, "test_execution_status": "NOT_RUN", "note": "G0原型与纵向集成分批交付；不是已完成。"})
    work["requirement_mapping"] = []
    old = {x["requirement"]: x for x in read(OLD / "work-packages.json")["requirement_mapping"]}
    for req in reqs:
        rid = req["id"]
        item = copy.deepcopy(old.get(rid, {"requirement": rid, "title": req["title"], "priority": req["priority"],
            "test_case": req["test_case"], "scope": "REQUIRED_P0", "implementation_status": STATUS, "test_execution_status": "NOT_RUN"}))
        item["work_packages"] = list(dict.fromkeys(item.get("work_packages", []) + [p["id"] for p in work["packages"] if p["id"].startswith("CX-") and rid in p["requirements"]]))
        item["design_pages"] = dmap[rid]
        item["design_components"] = sorted({c for page in pages if page["id"] in dmap[rid] for c in page["components"]})
        work["requirement_mapping"].append(item)
    for p in work["packages"]:
        p["design_pages"] = sorted({page for r in p["requirements"] for page in dmap[r]})
        p["design_components"] = sorted({c for page in pages if page["id"] in p["design_pages"] for c in page["components"]})
    work.update(version="1.1.0", requirements_version="3.1")
    work["estimate"]["codex_integration_included_in_old_estimate"] = False
    return work


def extend_admin(admin: dict, endpoints: dict, schemas: dict, dmap: dict) -> None:
    admin["components"]["schemas"].update(copy.deepcopy(schemas))
    defs = [
        ("GET", "/agent-instances", "listAgentInstances", "查询受限实例", "agent:read", None, "AgentInstanceList", [53, 57]),
        ("GET", "/agent-instances/{instance_id}", "getAgentInstance", "查询实例状态与代次", "agent:read", None, "AgentInstance", [53, 56, 57]),
        ("POST", "/agent-instances/{instance_id}/release", "requestAgentRelease", "核对状态后申请幂等回收", "agent:release", "AgentReleaseRequest", "AgentInstance", [53, 57]),
        ("GET", "/agent-runs/{run_id}", "getAgentRun", "查询角色运行的脱敏证据", "agent:read", None, "AgentRun", [51, 56]),
        ("GET", "/review-packets/{packet_id}", "getReviewPacket", "查询封存审查包和双报告", "quality:read", None, "ReviewPacket", [55, 58]),
        ("GET", "/skill-bundles", "listSkillBundles", "查询Skill包准入状态", "skills:read", None, "SkillBundleList", [52, 58]),
        ("POST", "/skill-bundles/{bundle_id}/revoke", "revokeSkillBundle", "撤销指定摘要版本并审计", "skills:revoke", "SkillBundleRevokeRequest", "SkillBundleResource", [52, 58]),
        ("GET", "/agent-instances/{instance_id}/cleanup-receipt", "getCleanupReceipt", "查询真实清理核验结果", "agent:read", None, "CleanupReceipt", [57]),
        ("POST", "/preset-licenses", "registerPresetLicense", "登记不可变社区许可草案", "moderator:review", "PresetLicenseRegistration", "PresetLicense", [28, 29, 30]),
        ("POST", "/preset-licenses/{license_id}/decision", "decidePresetLicense", "审核启用或退役指定许可版本", "moderator:publish", "PresetLicenseDecision", "PresetLicense", [28, 29, 30]),
    ]
    for method, path, oid, summary, permission, request, response, numbers in defs:
        requirements = [f"P01-F{x:02d}" for x in numbers]
        params = [{"name": key, "in": "path", "required": True, "schema": ID} for key in re.findall(r"\{([^}]+)\}", path)]
        if method == "POST":
            params.append({"$ref": "#/components/parameters/IdempotencyKey"})
        elif not re.findall(r"\{([^}]+)\}", path):
            params += [{"$ref": "#/components/parameters/Cursor"}, {"$ref": "#/components/parameters/Limit"}]
        op = {"operationId": oid, "summary": summary,
            "description": "独立管理权限/范围/审计。只返回受权脱敏证据；释放不得丢弃在途意图或耐久交付，不能凭管理请求绕过质量/预算/退款。",
            "security": [{"managementSession": []}], "parameters": params,
            "x-required-permission": permission, "x-requirements": requirements,
            "x-design-pages": sorted({p for r in requirements for p in dmap[r]}),
            "x-implementation-status": STATUS, "x-idempotency-required": method == "POST",
            "responses": {"200": {"description": "设计中的持久状态/脱敏工件结果，不代表已实现。", "content": {"application/json": {"schema": ref(response + "Response")}}},
                          "default": {"description": "权限/状态/证据错误", "content": {"application/json": {"schema": ref("Error")}}}}}
        if request:
            op["requestBody"] = {"required": True, "content": {"application/json": {"schema": ref(request)}}}
        admin["paths"].setdefault(path, {})[method.lower()] = op
        endpoints["endpoints"].append({"method": method, "path": path, "operation_id": oid, "summary": summary,
            "permission": permission, "request_schema": request, "response_schema": response,
            "requirements": requirements, "implementation_status": STATUS})
    admin["info"]["version"] = "1.1.0-design"


def main() -> None:
    reqs = read("assets/requirements/requirements.v3.1.json")["requirements"]
    registry = read("assets/skills/ypcc/v1.0/registry.json")
    pages = read("assets/design/柚子创作社/v1.0/page-registry.json")["pages"]
    dmap = {r["requirement"]: r["pages"] for r in read("assets/design/柚子创作社/v1.0/requirements-design-map.json")["requirements"]}
    new_map = {51: ["D03", "D07", "D09", "D11"], 52: ["D05", "D07", "D17", "D19"],
               53: ["D03", "D09", "D22"], 54: ["D07", "D09", "D14"], 55: ["D09", "D11", "D15"],
               56: ["D07", "D09", "D14"], 57: ["D09", "D11", "D13", "D22", "D23"], 58: ["D05", "D09", "D19"]}
    for n, ids in new_map.items():
        dmap[f"P01-F{n}"] = ids
    save("design-compatibility.json", {"requirements_version": "3.1", "design_baseline": "YPCC-DS-C-1.0.0",
        "frozen_files_modified": False, "status": STATUS,
        "requirements": [{"requirement": f"P01-F{n}", "pages": ids, "note": "复用既有业务交互，后台角色/释放不新增技术必经页"} for n, ids in new_map.items()]})
    # Preserve v1.0 as history. Current artifacts get an explicit v1.1 output root.
    for path in OLD.rglob("*"):
        if path.is_file() and path.name not in {"verification-report.json", "README.md"}:
            dest = OUT / path.relative_to(OLD)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(path.read_bytes())
    machines = read(OLD / "state-machines.json"); add_machines(machines)
    extra = new_schemas(machines)
    api = read(OLD / "contracts/openapi.json")
    api["components"]["schemas"].update(extra)
    api["components"]["schemas"]["Deliverables"]["properties"].update({
        "parent_manifest_id": ID, "revision_id": ID, "cover_deliverable_id": ID})
    revision_fields = {"COVER": "cover_deliverable_id", "ALLOWED_ORDER": "ordered_deliverable_ids", "DISPLAY_TEXT": "display_text"}
    for condition in api["components"]["schemas"]["RevisionRequest"]["allOf"]:
        selected = revision_fields[condition["if"]["properties"]["kind"]["const"]]
        condition["then"]["not"] = {"anyOf": [{"required": [field]} for field in revision_fields.values() if field != selected]}
    api["components"]["schemas"]["RevisionRequest"]["properties"]["ordered_deliverable_ids"]["uniqueItems"] = True
    api["info"]["version"] = "1.1.0-design"
    business_endpoints = read(OLD / "contracts/endpoints.json")
    creator_queries = extend_creator_queries(api, business_endpoints, dmap)
    creator_queries.append(extend_revision_query(api, business_endpoints))
    license_start = len(business_endpoints["endpoints"])
    extra.update(extend_publication_contract(api, business_endpoints, dmap))
    creator_queries += business_endpoints["endpoints"][license_start:]
    admin = read(OLD / "contracts/management-openapi.json")
    admin_endpoints = read(OLD / "contracts/management-endpoints.json")
    extend_admin(admin, admin_endpoints, extra, dmap)
    # UI intent keys contain ':' and '.', matching both runtime domains.
    # Normalize only the current contracts; v1.0 remains a preserved snapshot.
    for document in (api, admin):
        document["components"]["parameters"]["IdempotencyKey"]["schema"] = {
            "type": "string", "minLength": 8, "maxLength": 128,
            "pattern": "^[A-Za-z0-9._:-]+$"}
    entities = read(OLD / "data-model.json"); extend_data(entities)
    save("state-machines.json", machines); save("data-model.json", entities)
    save("work-packages.json", extend_work(reqs, dmap, pages))
    save("contracts/openapi.json", api); save("contracts/management-openapi.json", admin)
    save("contracts/endpoints.json", business_endpoints)
    save("contracts/management-endpoints.json", admin_endpoints)
    contract = contract_example(registry["bundles"][0])
    snapshot = read(OLD / "contracts/execution-snapshot.schema.json")
    snapshot["properties"]["schema_version"] = {"const": "1.1.0"}
    snapshot["properties"]["codex_contract"] = copy.deepcopy(extra["CodexContract"])
    snapshot["properties"]["revision_policy_hash"] = HASH
    snapshot["required"].append("codex_contract")
    save("contracts/execution-snapshot.schema.json", snapshot)
    fixtures = read(OLD / "contracts/contract-fixtures.json")
    for case in fixtures["cases"]:
        if case["schema"] == "execution-snapshot":
            case["value"]["schema_version"] = "1.1.0"
            case["value"]["codex_contract"] = copy.deepcopy(contract)
    bad = copy.deepcopy(next(c for c in fixtures["cases"] if c["name"] == "frozen_execution_snapshot"))
    bad["name"] = "codex_ceiling_cannot_exceed_order_total"
    bad["value"]["codex_contract"]["agent_cost_ceiling_micro"] = bad["value"]["budget"]["ceiling_micro"] + 1
    bad["expected_valid"] = False
    fixtures["cases"].append(bad)
    save("contracts/contract-fixtures.json", fixtures)
    for slug, name in [("codex-contract", "CodexContract"), ("codex-quote-binding", "CodexQuoteBinding"), ("agent-stage-result", "AgentStageResult"),
                       ("review-packet", "ReviewPacket"), ("cleanup-receipt", "CleanupReceipt"), ("tool-call-intent", "ToolCallIntent")]:
        save(f"contracts/{slug}.schema.json", standalone(name, api["components"]["schemas"]))
    save("contracts/codex-fixtures.json", add_fixtures(contract))
    tools = {
        "analyze_photos": ["CONTENT"], "validate_content_plan": ["CONTENT"],
        "render_photo_pack": ["PRODUCTION"], "generate_reference_frames": ["PRODUCTION"],
        "submit_video": ["PRODUCTION"], "query_original_submission": ["PRODUCTION", "POST"],
        "inspect_actual_media": ROLES, "extract_review_evidence": ["REVIEW_FACTS", "REVIEW_STYLE"],
        "transcribe_actual_audio": ["POST", "REVIEW_FACTS", "REVIEW_STYLE"],
        "execute_post_plan": ["POST"], "persist_stage_result": ROLES,
    }
    save("tool-policy.json", {"version": "YPCC-TOOL-POLICY-1.0.0", "status": STATUS,
        "transport": "PLATFORM_MCP_REQUIRED", "default_deny": True,
        "tools": [{"name": k, "allowed_roles": v, "checks": ["TENANT_ORDER_OR_PREVIEW_SCOPE", "ROLE_STAGE", "FENCING_TOKEN", "SNAPSHOT_HASH", "DEADLINE", "ATOMIC_COST_RESERVATION"]} for k, v in tools.items()],
        "forbidden": ["arbitrary_shell", "arbitrary_url", "sql", "payment", "refund", "publish_delivery", "install_skill", "browser", "docker", "wsl", "virtual_machine"],
        "inference_requests_also_require_reservation_and_hard_limit": True})
    baseline = read(OLD / "development-baseline.json")
    baseline.update(baseline_id="YPCC-DEV-1.1.0", requirements_version="3.1", generated_by="scripts/生成Codex开发契约.py")
    baseline["counts"].update(requirements=58, P0=52, api_operations=len(business_endpoints["endpoints"]), state_machines=len(machines["machines"]),
        management_api_operations=len(admin_endpoints["endpoints"]), work_packages=20, skills=19, skill_bundles=14)
    baseline["recommended_stack"]["agent_kernel"] = "Codex app-server via stdio + native per-order instance + platform MCP; exact production build pending G0"
    baseline["engineering_constraints"] += [{"id": f"EC-{n}", "title": title} for n, title in [
        (16, "四阶段Codex真实工具与证据"), (17, "可信Skill版本冻结与按角色显式注入"),
        (18, "原生身份与ACL隔离、每单不复用上下文"), (19, "新上下文双复核与封存hash"),
        (20, "交付终态outbox与清理回执"), (21, "推理出口与工具共同预算、重启不清零")]]
    baseline["product_verification"].update(codex_runtime="NOT_INTEGRATED", skill_behavior="NOT_RUN", instance_isolation="NOT_RUN", cleanup_runtime="NOT_RUN")
    baseline["codex_policy"] = {"required_roles": ROLES, "independent_reviewers": 2, "max_repair_rounds": 1,
        "exact_runtime_build": None, "actual_model": None, "model_rate": None, "global_personal_login_allowed": False,
        "release_grace_seconds": 30, "release_target_seconds": 300, "reaper_interval_seconds": 60, "cleanup_alert_seconds": 600}
    save("development-baseline.json", baseline)
    catalog = (OLD / "contracts/endpoint-catalog.md").read_text(encoding="utf-8")
    catalog += "\n## 社区恢复查询增补 v1.1\n\n| 方法/路径 | operationId | 返回 |\n| --- | --- | --- |\n"
    catalog += "\n".join(f"| {e['method']} {e['path']} | {e['operation_id']} | {e['response_schema']} |" for e in creator_queries)
    catalog += "\n## Codex管理增补 v1.1\n\n| 方法/路径 | operationId | 权限 |\n| --- | --- | --- |\n"
    legacy_admin_ids = {e["operation_id"] for e in read(OLD / "contracts/management-endpoints.json")["endpoints"]}
    catalog += "\n".join(f"| {e['method']} {e['path']} | {e['operation_id']} | {e['permission']} |" for e in admin_endpoints["endpoints"] if e["operation_id"] not in legacy_admin_ids)
    write("contracts/endpoint-catalog.md", catalog)
    write("README.md", """# 一品成片 · 开发契约 v1.1

对应需求v3.1/58项与C设计v1.0。源于保留的开发v1.0，新增Codex四阶段/Skill/每单隔离/工具/双复核/释放设计。全部DESIGN_NOT_IMPLEMENTED；无应用/云服务或真实调用。

[开发基线](development-baseline.json)｜[业务OpenAPI](contracts/openapi.json)｜[管理域OpenAPI](contracts/management-openapi.json)｜[接口目录](contracts/endpoint-catalog.md)

[数据目录](data-model.json)｜[状态机](state-machines.json)｜[58需求与20工作包](work-packages.json)｜[设计补充映射](design-compatibility.json)｜[工具策略](tool-policy.json)

[冻结执行快照](contracts/execution-snapshot.schema.json)｜[Codex合同](contracts/codex-contract.schema.json)｜[报价前冻结绑定](contracts/codex-quote-binding.schema.json)｜[阶段结果](contracts/agent-stage-result.schema.json)｜[审查包](contracts/review-packet.schema.json)｜[清理回执](contracts/cleanup-receipt.schema.json)｜[工具意图](contracts/tool-call-intent.schema.json)

[基础合成例](contracts/contract-fixtures.json)｜[Codex合成例](contracts/codex-fixtures.json)｜[开发核验](verification-report.json)｜[Codex总核验](codex-verification-report.json)

生成入口为scripts/生成Codex开发契约.py，总核验为scripts/核验Codex方案.py。合成例检验schema/指定交付语义；不能证明真实媒体、身份隔离、费用控制或实例已释放。生产CLI/protocol/模型/费率、准入签名与运行限额仍待G0，所有变体保持禁售。
""")
    help_files = []
    for path in (ROOT / "runtime/codex-research").glob("*.txt"):
        help_files.append({"path": path.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    save(ROOT / "assets/research/agent-kernel/codex-research-20261027.json", {
        "date": "2026-10-27", "status": "OFFICIAL_DOCS_AND_LOCAL_HELP_READ_ONLY", "production_integration_verified": False,
        "local_cli_version": "0.164.0-alpha.11.1", "local_help_records": help_files,
        "sources": [
            {"title": "Codex app-server", "url": "https://learn.chatgpt.com/docs/app-server", "facts": ["stdio JSON-RPC threads/turns/events/interrupt", "skills/list and explicit skill input", "outputSchema per turn", "unsubscribe has inactivity grace; archive is not delete", "dynamicTools experimental", "thread/shellCommand bypasses sandbox; forbidden in this product"]},
            {"title": "Codex SDK", "url": "https://learn.chatgpt.com/docs/codex-sdk", "facts": ["server-side programmatic integration alternative; product chooses app-server lifecycle control"]},
            {"title": "Build skills", "url": "https://learn.chatgpt.com/docs/build-skills", "facts": ["SKILL.md with name/description; progressive disclosure", "discovery includes repository/user/admin/system scope; audit all discovered sources"]},
            {"title": "Authentication", "url": "https://learn.chatgpt.com/docs/auth", "facts": ["authentication must be configured for service account/project; personal desktop login not a product tenancy mechanism"]},
            {"title": "Sandbox", "url": "https://learn.chatgpt.com/docs/sandboxing", "facts": ["actual native sandbox compatibility and effective permissions require G0 verification"]},
            {"title": "Agent approvals and security", "url": "https://learn.chatgpt.com/docs/agent-approvals-security", "facts": ["permissions must be enforced outside untrusted prompts; actual configured behavior requires verification"]},
            {"title": "Windows sandbox", "url": "https://learn.chatgpt.com/docs/windows/windows-sandbox", "facts": ["native dedicated-user/ACL legacy elevated path is a G0 candidate", "unelevated has weaker network isolation and no denied read paths", "project fixes native-process mode and disallows MXC via managed windows.allow_mxc=false; not applied locally"]},
        ], "operations_performed": ["web official documentation read", "codex --version", "codex app-server --help", "codex exec --help"],
        "not_performed": ["app-server launch", "model run", "real generation", "payment", "cloud deployment", "docker/wsl/virtualization", "browser UI", "global skill installation"],
        "recommendation": "CODEX_APP_SERVER_FOUR_STAGES_NATIVE_ORDER_INSTANCE_TRUSTED_SKILLS_TWO_FRESH_REVIEWS_RELEASE"})
    print(json.dumps({"status": "GENERATED_DESIGN_ONLY", "requirements": 58, "schemas": len(api["components"]["schemas"]),
        "management_operations": len(admin_endpoints["endpoints"]), "state_machines": len(machines["machines"]),
        "logical_entities": len(entities["entities"]), "codex_examples": len(read(OUT / "contracts/codex-fixtures.json")["cases"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()

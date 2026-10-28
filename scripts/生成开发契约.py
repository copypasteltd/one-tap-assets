"""Generate design contracts only; no service calls, runtime bootstrap or sales activation."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/development/v1.0"
STATUS = "DESIGN_NOT_IMPLEMENTED"
DATE = "2026-10-27"


def save(relative: str, value: object) -> None:
    path = OUT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fids(*numbers: int) -> list[str]:
    return [f"P01-F{n:02d}" for n in numbers]


def ref(name: str) -> dict:
    return {"$ref": f"#/components/schemas/{name}"}


def obj(properties: dict, required: list[str] | None = None) -> dict:
    return {"type": "object", "properties": properties,
            "required": list(properties) if required is None else required,
            "additionalProperties": False}


def arr(items: dict, minimum: int = 0, maximum: int = 100) -> dict:
    return {"type": "array", "items": items, "minItems": minimum, "maxItems": maximum}


def string(maximum: int = 1024, minimum: int = 1) -> dict:
    return {"type": "string", "minLength": minimum, "maxLength": maximum}


def enum(*values: str) -> dict:
    return {"type": "string", "enum": list(values)}


def nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


def number(maximum: int = 2147483647, minimum: int = 0) -> dict:
    return {"type": "integer", "minimum": minimum, "maximum": maximum}


ID = {"type": "string", "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$"}
HASH = {"type": "string", "pattern": "^[a-f0-9]{64}$"}
TIME = {"type": "string", "format": "date-time", "maxLength": 40,
        "pattern": r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$"}
URL = {"type": "string", "format": "uri", "pattern": "^https://", "maxLength": 4096}
BOOL = {"type": "boolean"}


def state_machines() -> dict:
    machines = []

    def add(name: str, initial: str, terminals: list[str], edges: dict[str, list[str]], guards: list[str]) -> None:
        states = list(dict.fromkeys([initial, *edges.keys(), *[s for ss in edges.values() for s in ss]]))
        machines.append({"id": name, "initial": initial, "states": states, "terminal_states": terminals,
                         "transitions": [{"from": a, "to": b} for a, values in edges.items() for b in values],
                         "guards": guards, "implementation_status": STATUS})

    add("Analysis", "QUEUED", ["READY", "BLOCKED", "FAILED"], {
        "QUEUED": ["ANALYZING", "FAILED"], "ANALYZING": ["VALIDATING", "FAILED"],
        "VALIDATING": ["READY", "BLOCKED", "FAILED"]},
        ["真实视觉初次加最多一次重试保存在attempt，不伪造READY；证据只属于当前输入版本。"])
    add("Plan", "PLANNING", ["READY", "BLOCKED", "FAILED"], {
        "PLANNING": ["VALIDATING", "FAILED"], "VALIDATING": ["READY", "BLOCKED", "FAILED"]},
        ["READY须通过事实/帧/实际能力检查；不是媒体交付。输入变化创建新计划。"])
    add("Asset", "UPLOADING", ["REJECTED", "DELETED"], {
        "UPLOADING": ["VERIFYING", "EXPIRED", "DELETED"], "VERIFYING": ["READY", "REJECTED", "EXPIRED", "DELETED"],
        "READY": ["EXPIRED", "DELETED"], "EXPIRED": ["DELETED"]},
        ["READY须后端核对象、解码/像素/大小/归属；到期先停授权，清理幂等。"])
    add("Quote", "OPEN", ["CONSUMED", "EXPIRED", "INVALIDATED"], {
        "OPEN": ["CONSUMED", "EXPIRED", "INVALIDATED"]},
        ["15分钟内同归属/输入/plan_hash且准入有效；建单锁定并唯一消费。"])
    add("Payment", "CREATED", ["CONFIRMED"], {
        "CREATED": ["PENDING", "UNKNOWN", "FAILED"], "PENDING": ["CONFIRMED", "UNKNOWN", "FAILED", "CANCELLED"],
        "UNKNOWN": ["PENDING", "CONFIRMED", "FAILED", "CANCELLED"], "FAILED": ["CONFIRMED"], "CANCELLED": ["CONFIRMED"]},
        ["CONFIRMED只由后端验签/查单确认，宿主回调不直接推进。UNKNOWN先查原单。",
         "FAILED/CANCELLED到CONFIRMED仅接受迟到资金的真实对账证据，不表示重新发起付款。",
         "晚到付款真实记账；不能履原合同时进入退款异常处理，不能丢弃资金事件。"])
    add("Fulfillment", "NOT_STARTED", ["DELIVERED", "FAILED", "CANCELLED"], {
        "NOT_STARTED": ["QUEUED", "FAILED", "CANCELLED"], "QUEUED": ["IN_PROGRESS", "FAILED", "CANCELLED"],
        "IN_PROGRESS": ["DELIVERED", "FAILED", "CANCELLED"]},
        ["验付/任务/outbox同事务。发布与取消/退款锁同一订单，完整manifest才DELIVERED。"])
    add("Refund", "REQUESTED", ["REFUNDED", "REJECTED"], {
        "REQUESTED": ["PROCESSING", "REJECTED"], "PROCESSING": ["REFUNDED", "UNKNOWN", "FAILED"],
        "UNKNOWN": ["PROCESSING", "REFUNDED", "FAILED"], "FAILED": ["PROCESSING"]},
        ["退原通道，累计不超实付；UNKNOWN先查原退款，FAILED恢复沿原意图并留审计。"])
    job_edges = {"QUEUED": ["PREPARING"], "PREPARING": ["GENERATING"], "GENERATING": ["POST_PROCESSING"],
                 "POST_PROCESSING": ["QC"], "QC": ["DELIVERED", "REPAIRING"],
                 "REPAIRING": ["PREPARING", "GENERATING", "POST_PROCESSING", "QC"]}
    for values in job_edges.values():
        values.extend(["FAILED", "CANCELLED"])
    add("RenderJob", "QUEUED", ["DELIVERED", "FAILED", "CANCELLED"], job_edges,
        ["REPAIRING最多一轮；受影响节点额外一次且并发原子预算/原截止。",
         "终态不回生成；小改/平台纠错建立关联新版本，不重置终态。"])
    add("StageRun", "READY", ["SUCCEEDED", "FAILED", "CANCELLED"], {
        "READY": ["CLAIMED", "CANCELLED", "FAILED"], "CLAIMED": ["RUNNING", "READY", "FAILED", "CANCELLED"],
        "RUNNING": ["SUCCEEDED", "UNKNOWN", "FAILED", "CANCELLED"], "UNKNOWN": ["RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]},
        ["CLAIMED回READY仅证实尚无外部副作用；否则恢复原intent。每次回写检查fencing_token。",
         "租约到期不是重新购买依据；UNKNOWN转移须供应商查询/对账证据。"])
    add("ProviderSubmission", "INTENT", ["SUCCEEDED", "FAILED"], {
        "INTENT": ["SUBMITTING", "FAILED"], "SUBMITTING": ["ACKNOWLEDGED", "UNKNOWN", "FAILED"],
        "ACKNOWLEDGED": ["RUNNING", "SUCCEEDED", "FAILED"], "RUNNING": ["SUCCEEDED", "UNKNOWN", "FAILED"],
        "UNKNOWN": ["ACKNOWLEDGED", "RUNNING", "SUCCEEDED", "FAILED"]},
        ["先持久意图/预算再POST，ACK持久后轮询。UNKNOWN无到SUBMITTING边，不盲重购。",
         "只有确定未发生/实际结算/对账解决才能释放UNKNOWN预留。"])
    add("AlbumSaveItem", "PENDING", ["SAVED"], {
        "PENDING": ["DOWNLOADING"], "DOWNLOADING": ["SAVING", "FAILED"],
        "SAVING": ["SAVED", "FAILED", "UNKNOWN"], "FAILED": ["DOWNLOADING"], "UNKNOWN": ["SAVED", "FAILED"]},
        ["SAVED须宿主成功回调；UNKNOWN须实际证据或用户核对，不能自动重存。明确再存创建新attempt。",
         "保存回执不改变付款/交付/退款。"])
    add("Publication", "DRAFT", ["REJECTED"], {
        "DRAFT": ["VALIDATING"], "VALIDATING": ["UNDER_REVIEW", "CHANGES_REQUESTED"],
        "UNDER_REVIEW": ["APPROVED", "CHANGES_REQUESTED", "REJECTED"], "CHANGES_REQUESTED": ["VALIDATING"],
        "APPROVED": ["PUBLISHED"], "PUBLISHED": ["SUSPENDED"], "SUSPENDED": ["UNDER_REVIEW"]},
        ["审核与准入独立，PUBLISHED不自动sale_enabled；发布/停售只允运营角色。",
         "公开版本不可变；草稿修订建立新版本，旧订单仍读快照。"])
    add("Admission", "NOT_EVALUATED", [], {
        "NOT_EVALUATED": ["EVALUATING"], "EVALUATING": ["ADMITTED", "REJECTED"],
        "ADMITTED": ["SUSPENDED"], "REJECTED": ["EVALUATING"], "SUSPENDED": ["EVALUATING"]},
        ["模型/价/权利/样例/基准齐备才ADMITTED；公开和准入同时成立才能新售。"])
    add("PrivacyDeletion", "REQUESTED", ["COMPLETED"], {
        "REQUESTED": ["PROCESSING"], "PROCESSING": ["COMPLETED", "PARTIAL_BLOCKED"],
        "PARTIAL_BLOCKED": ["PROCESSING"]},
        ["COMPLETED须受控范围删除回执齐备；不可控备份/供应商边界另列，不伪称手机已删除。"])
    return {"schema_version": "1.0.0", "status": STATUS, "note": "状态图描述设计。合法边仍需权限/事务/证据守卫，不可只凭枚举更新。", "machines": machines}


def schemas(machines: dict) -> dict:
    s = {m["id"] + "State": enum(*m["states"]) for m in machines["machines"]}
    s.update({"ResourceId": ID, "Sha256": HASH, "Timestamp": TIME,
              "Platform": enum("alipay", "douyin"), "Engine": enum("PHOTO_LAYOUT", "PER_SHOT_AI", "REFERENCE_FILM")})
    s["Error"] = obj({"code": string(80), "message": string(300), "retryable": BOOL,
                      "trace_id": ID, "details": arr(obj({"field": string(150), "reason": string(300)}))})
    s["SessionRequest"] = obj({"platform": ref("Platform"), "code": string(2048)})
    s["Session"] = obj({"access_token": string(4096), "token_type": {"const": "Bearer"}, "expires_at": TIME, "user_id": ID})
    s["ProductRequest"] = obj({})
    s["Product"] = obj({"product_id": ID, "revision": number(), "photo_version": nullable(number()),
                        "profile_id": nullable(ID), "created_at": TIME})
    s["AssetRequest"] = obj({"product_id": ID, "purpose": enum("PRODUCT_PHOTO", "RIGHTS_EVIDENCE", "SUPPORT_EVIDENCE", "REPORT_EVIDENCE"),
                             "file_name": string(200), "mime_type": enum("image/jpeg", "image/png"),
                             "size_bytes": number(10000000, 1), "sha256": nullable(HASH)},
                            ["purpose", "file_name", "mime_type", "size_bytes"])
    s["AssetRequest"]["allOf"] = [{"if": {"properties": {"purpose": {"const": "PRODUCT_PHOTO"}}, "required": ["purpose"]},
                                    "then": {"required": ["product_id"]}}]
    # Header/form values are provider-authorized transport parameters, not user-executable configuration.
    s["StringMap"] = {"type": "object", "additionalProperties": string(4096, 0), "maxProperties": 30}
    s["UploadGrant"] = obj({"asset_id": ID, "method": enum("PUT", "POST"), "upload_url": URL,
                           "headers": ref("StringMap"), "form_fields": ref("StringMap"), "expires_at": TIME})
    s["AssetCompleteRequest"] = obj({"sha256": HASH})
    s["Asset"] = obj({"asset_id": ID, "product_id": nullable(ID), "state": ref("AssetState"), "mime_type": string(100),
                      "size_bytes": number(10000000, 1), "width": number(30000000, 1), "height": number(30000000, 1),
                      "sha256": HASH})
    s["PhotoBindingRequest"] = obj({"asset_ids": {**arr(ID, 3, 5), "uniqueItems": True}, "expected_revision": number()})
    s["AnalysisRequest"] = obj({"photo_version": number(2147483647, 1)})
    s["Analysis"] = obj({"analysis_id": ID, "product_id": ID, "photo_version": number(), "state": ref("AnalysisState"),
                         "profile_id": nullable(ID), "reason_codes": arr(string(80)), "updated_at": TIME})
    s["Evidence"] = obj({"evidence_id": ID, "asset_id": ID, "kind": enum("OBSERVATION", "OCR", "USER_CORRECTION"),
                         "text": string(1000), "region": nullable(arr({"type": "number", "minimum": 0, "maximum": 1}, 4, 4))})
    s["Observation"] = obj({"feature": string(120), "value": string(1000),
                            "status": enum("OBSERVED", "OCR", "USER_CORRECTED", "CONFLICTED"),
                            "source_asset_ids": arr(ID, 1, 5), "evidence_ids": arr(ID, 1, 20),
                            "note": string(1000), "model_reported_confidence": nullable({"type": "number", "minimum": 0, "maximum": 1})})
    s["Hypothesis"] = obj({"text": string(500), "evidence_ids": arr(ID, 1, 20), "uncertain": {"const": True}})
    s["Profile"] = obj({"schema_version": {"const": "1.1"}, "profile_id": ID, "product_id": ID, "photo_version": number(),
                        "identity_lock_id": ID, "summary": string(1000), "category": nullable(string(120)), "name": nullable(string(200)),
                        "observations": arr(ref("Observation")), "label_texts": arr(ref("Observation")),
                        "hypotheses": arr(ref("Hypothesis")), "unknowns": arr(string(300)), "conflicts": arr(string(500)),
                        "photo_roles": arr(obj({"asset_id": ID, "role": enum("WHOLE", "SIDE", "DETAIL", "LABEL", "OTHER")}), 3, 5),
                        "evidence": arr(ref("Evidence")), "profile_hash": HASH, "revision": number()})
    s["Profile"]["description"] = "商品档案1.1的买家可见投影；供应商回执/模型提示版本/内部质量记录保存在私有内部模型，不返回完整调试字段。"
    s["CorrectionRequest"] = obj({"expected_revision": number(), "profile_id": ID,
                                 "field": enum("category", "name", "observation", "label_text", "photo_role"),
                                 "value": string(1000), "evidence_asset_ids": arr(ID, 0, 5)},
                                ["expected_revision", "profile_id", "field", "value"])
    s["OutputSlot"] = obj({"slot_id": ID, "kind": enum("image", "video", "copy"), "count": number(100, 1),
                           "width": nullable(number(8192, 1)), "height": nullable(number(8192, 1)),
                           "fps": nullable(number(120, 1)), "duration_frames": nullable(number(1000000, 1))})
    s["Variant"] = obj({"variant_id": ID, "version": string(40), "name": string(120), "engine": ref("Engine"),
                        "sale_enabled": BOOL, "admission_state": ref("AdmissionState"), "reason_codes": arr(string(100)),
                        "price_fen": nullable(number()), "output_slots": arr(ref("OutputSlot"), 1, 30),
                        "speech_mode": enum("NONE", "NATIVE_ZH"), "input_guidance": arr(string(300), 1, 20)})
    s["Variant"]["allOf"] = [{"if": {"properties": {"sale_enabled": {"const": True}}, "required": ["sale_enabled"]},
                                "then": {"properties": {"admission_state": {"const": "ADMITTED"}, "price_fen": number()}}}]
    s["PresetSummary"] = obj({"preset_id": ID, "version": string(40), "name": string(100), "author_name": string(100),
                              "source": enum("OFFICIAL", "COMMUNITY"), "style_tags": arr(string(50), 0, 20),
                              "sample_id": nullable(ID), "sample_label": {"const": "AUTHORIZED_SAMPLE_NOT_YOUR_RESULT"},
                              "sale_enabled": BOOL})
    s["PresetDetail"] = obj({"preset": ref("PresetSummary"), "description": string(2000),
                             "variants": arr(ref("Variant"), 1, 30), "license_summary": string(2000),
                             "fork_allowed": BOOL, "parent_version": nullable(string(200))})
    s["Recommendation"] = obj({"preset": ref("PresetSummary"), "variant_ids": arr(ID, 1, 30),
                               "reason": string(500), "missing_inputs": arr(string(300))})
    s["InputCheckRequest"] = obj({"product_id": ID, "profile_id": ID, "variant_id": ID, "variant_version": string(40)})
    s["InputCheck"] = obj({"eligible": BOOL, "reason_codes": arr(string(100)), "capture_guidance": arr(string(500))})
    s["PlanRequest"] = obj({"product_id": ID, "photo_version": number(2147483647, 1), "profile_id": ID,
                            "identity_lock_id": ID, "preset_id": ID, "preset_version": string(40),
                            "variant_id": ID, "variant_version": string(40)})
    s["Plan"] = obj({"plan_id": ID, "state": ref("PlanState"), "plan_hash": nullable(HASH), "product_id": ID,
                     "profile_id": ID, "variant_id": ID, "engine": ref("Engine"), "summary": string(2000, 0),
                     "output_slots": arr(ref("OutputSlot")), "reason_codes": arr(string(100)),
                     "estimated_seconds_min": nullable(number()), "estimated_seconds_max": nullable(number())})
    s["PreviewRequest"] = obj({"plan_id": ID, "plan_hash": HASH})
    s["Preview"] = obj({"preview_id": ID, "product_id": ID, "plan_id": ID, "plan_hash": HASH,
                        "state": enum("QUEUED", "GENERATING", "READY", "FAILED"),
                        "label": {"const": "YOUR_OPTIONAL_PREVIEW_NOT_FINAL_PACK"}, "expires_at": TIME})
    s["QuoteRequest"] = obj({"plan_id": ID, "plan_hash": HASH})
    s["Quote"] = obj({"quote_id": ID, "plan_id": ID, "plan_hash": HASH, "state": ref("QuoteState"),
                      "currency": {"const": "CNY"}, "amount_fen": number(), "expires_at": TIME,
                      "output_slots": arr(ref("OutputSlot"), 1, 30), "terms_version": string(80),
                      "hard_deadline_seconds": number(86400, 1)})
    s["OrderRequest"] = obj({"quote_id": ID, "channel": ref("Platform")})
    s["Order"] = obj({"order_id": ID, "quote_id": ID, "channel": ref("Platform"), "currency": {"const": "CNY"},
                      "amount_fen": number(), "payment_state": ref("PaymentState"), "fulfillment_state": ref("FulfillmentState"),
                      "refund_id": nullable(ID), "job_id": nullable(ID), "payable_until": TIME,
                      "delivery_expires_at": nullable(TIME), "created_at": TIME})
    s["PaymentAction"] = obj({"payment_id": ID, "order_id": ID, "state": ref("PaymentState"),
                              "channel": ref("Platform"), "expires_at": TIME, "action": {
        "oneOf": [obj({"kind": {"const": "INVOKE_PLATFORM_PAYMENT"}, "adapter_contract_version": string(80),
                       "serialized_platform_payload": string(16000)}),
                  obj({"kind": {"const": "QUERY_ORIGINAL_ORDER"}})]}})
    s["PaymentAction"]["description"] = "产品适配器封套。原生payload schema在G0获准通道协议后分别冻结；仅允许对应适配器解析/校验，不eval、不当成统一官方报文。"
    s["Job"] = obj({"job_id": ID, "order_id": ID, "state": ref("RenderJobState"), "current_stage": nullable(string(100)),
                    "completed_stage_count": number(), "total_stage_count": number(), "repair_rounds": number(1),
                    "deadline_at": TIME, "updated_at": TIME})
    s["Stage"] = obj({"stage_id": ID, "name": string(100), "state": ref("StageRunState"), "attempt": number(2, 1),
                      "updated_at": TIME, "reason_code": nullable(string(100))})
    s["Deliverable"] = obj({"deliverable_id": ID, "slot_id": ID, "kind": enum("image", "video", "copy"),
                            "file_name": nullable(string(200)), "mime_type": nullable(string(100)),
                            "size_bytes": nullable(number(2000000000)), "width": nullable(number(8192, 1)),
                            "height": nullable(number(8192, 1)), "fps": nullable(number(120, 1)),
                            "duration_frames": nullable(number(1000000, 1)), "text": nullable(string(10000)), "sha256": HASH})
    s["Deliverables"] = obj({"order_id": ID, "manifest_id": ID, "manifest_revision": number(2147483647, 1),
                             "expires_at": TIME, "items": arr(ref("Deliverable"), 1, 100)})
    s["DownloadLink"] = obj({"deliverable_id": ID, "url": URL, "expires_at": TIME, "ttl_seconds": {"const": 300}})
    s["PreviewLink"] = obj({"preview_id": ID, "url": URL, "expires_at": TIME, "ttl_seconds": {"const": 300}})
    s["SaveSessionRequest"] = obj({"order_id": ID, "installation_id": ID,
                                   "deliverable_ids": {**arr(ID, 1, 100), "uniqueItems": True}})
    s["SaveSession"] = obj({"save_session_id": ID, "order_id": ID, "installation_id": ID,
                            "deliverable_ids": arr(ID, 1, 100), "created_at": TIME})
    s["SaveReceiptRequest"] = obj({"save_session_id": ID, "deliverable_id": ID, "attempt": number(1000, 1),
                                   "state": ref("AlbumSaveItemState"), "error_code": nullable(string(100)), "occurred_at": TIME})
    s["Receipt"] = obj({"receipt_id": ID, "accepted": BOOL})
    s["ReasonRequest"] = obj({"reason_code": string(100), "message": string(1000, 0)}, ["reason_code"])
    s["Refund"] = obj({"refund_id": ID, "order_id": ID, "state": ref("RefundState"), "amount_fen": number(), "updated_at": TIME})
    s["RevisionRequest"] = obj({"manifest_revision": number(2147483647, 1), "kind": enum("COVER", "ALLOWED_ORDER", "DISPLAY_TEXT"),
                                "cover_deliverable_id": ID, "ordered_deliverable_ids": arr(ID, 1, 100), "display_text": string(2000)},
                               ["manifest_revision", "kind"])
    s["RevisionRequest"]["allOf"] = [{"if": {"properties": {"kind": {"const": kind}}, "required": ["kind"]},
                                       "then": {"required": [field]}}
                                      for kind, field in [("COVER", "cover_deliverable_id"), ("ALLOWED_ORDER", "ordered_deliverable_ids"), ("DISPLAY_TEXT", "display_text")]]
    s["Revision"] = obj({"revision_id": ID, "order_id": ID, "state": enum("REQUESTED", "PROCESSING", "COMPLETED", "FAILED"),
                         "result_manifest_revision": nullable(number(2147483647, 1)), "consumes_user_allowance": BOOL})
    s["TicketRequest"] = obj({"category": enum("PAYMENT", "GENERATION", "PRODUCT_ERROR", "SAVE", "REFUND", "OTHER"),
                              "message": string(2000), "attachment_asset_ids": arr(ID, 0, 5)}, ["category", "message"])
    s["Ticket"] = obj({"ticket_id": ID, "order_id": ID, "state": enum("OPEN", "PROCESSING", "RESOLVED", "CLOSED"),
                       "category": string(100), "updated_at": TIME})
    # Components are a finite safe value language; provider URLs, scripts, schemas and prices have no fields here.
    s["PresetConfig"] = obj({"name": string(100), "description": string(2000), "style_tags": arr(string(50), 1, 10),
                             "parent_preset_version": nullable(string(200)), "component_versions": arr(ID, 1, 30),
                             "variant_blueprint_ids": arr(ID, 1, 10), "resource_version_ids": arr(ID, 0, 30),
                             "fork_allowed": BOOL})
    s["ComponentOption"] = obj({"component_version_id": ID, "type": string(80), "name": string(100),
                                "description": string(1000), "supported_engines": arr(ref("Engine"), 1, 3)})
    s["VariantBlueprint"] = obj({"blueprint_id": ID, "name": string(100), "engine": ref("Engine"),
                                 "allowed_component_version_ids": arr(ID, 1, 100), "admission_required": {"const": True}})
    s["ResourceOption"] = obj({"resource_version_id": ID, "kind": enum("FONT", "MUSIC", "CHARACTER", "VOICE", "LAYOUT"),
                               "name": string(100), "license_summary": string(1000), "usable": BOOL})
    s["RightsRecordRequest"] = obj({"scope": enum("OWNED_PRODUCT", "SAMPLE_PUBLICATION", "THIRD_PARTY_RESOURCE"),
                                    "statement": string(3000), "evidence_asset_ids": arr(ID, 1, 10),
                                    "resource_version_ids": arr(ID, 0, 30), "license_reference": string(1000)},
                                   ["scope", "statement", "evidence_asset_ids"])
    s["RightsRecord"] = obj({"rights_record_id": ID, "state": enum("SUBMITTED", "VERIFIED", "REJECTED", "REVOKED"),
                             "scope": string(100), "updated_at": TIME})
    s["PresetDraftRequest"] = obj({"config": ref("PresetConfig")})
    s["PresetDraftPatch"] = obj({"expected_revision": number(), "config": ref("PresetConfig")})
    s["PresetDraft"] = obj({"draft_id": ID, "revision": number(), "config": ref("PresetConfig"),
                            "publication_id": nullable(ID), "updated_at": TIME})
    s["SampleRequest"] = obj({"draft_revision": number(), "product_id": ID, "profile_id": ID,
                              "variant_blueprint_id": ID, "rights_record_ids": arr(ID, 1, 30)})
    s["Sample"] = obj({"sample_id": ID, "draft_id": ID, "state": enum("QUEUED", "GENERATING", "READY", "FAILED"),
                       "visibility": enum("PRIVATE", "AUTHORIZED_PUBLIC"), "rights_verified": BOOL})
    s["SampleMedia"] = obj({"sample_id": ID, "label": enum("PRIVATE_CREATOR_SAMPLE", "AUTHORIZED_SAMPLE_NOT_YOUR_RESULT"),
                            "items": arr(obj({"kind": enum("image", "video"), "url": URL, "expires_at": TIME}), 1, 30)})
    s["PublicSampleMedia"] = {"allOf": [ref("SampleMedia"), {"properties": {"label": {"const": "AUTHORIZED_SAMPLE_NOT_YOUR_RESULT"}}}]}
    s["PublicationRequest"] = obj({"expected_revision": number(), "sample_ids": arr(ID, 1, 30),
                                   "rights_record_ids": arr(ID, 1, 50), "license_version": ID})
    s["Publication"] = obj({"publication_id": ID, "draft_id": ID, "revision": number(), "state": ref("PublicationState"),
                            "admission_state": ref("AdmissionState"), "sale_enabled": BOOL,
                            "reason_codes": arr(string(100)), "preset_id": nullable(ID), "published_version": nullable(string(40))})
    s["Publication"]["allOf"] = [{"if": {"properties": {"sale_enabled": {"const": True}}, "required": ["sale_enabled"]},
                                    "then": {"properties": {"state": {"const": "PUBLISHED"}, "admission_state": {"const": "ADMITTED"},
                                                            "preset_id": ID, "published_version": string(40)}}}]
    s["Favorite"] = obj({"preset_id": ID, "favorited": BOOL})
    s["ForkRequest"] = obj({"parent_version": string(40), "name": string(100)})
    s["ReportRequest"] = obj({"preset_version": string(40), "reason": enum("RIGHTS", "MISLEADING", "UNSAFE", "PRODUCT_DISTORTION", "OTHER"),
                              "message": string(2000), "evidence_asset_ids": arr(ID, 0, 5)}, ["preset_version", "reason", "message"])
    s["Report"] = obj({"report_id": ID, "preset_id": ID, "revision": number(), "state": enum("OPEN", "REVIEWING", "RESOLVED", "DISMISSED", "APPEALED"),
                       "updated_at": TIME})
    s["AppealRequest"] = obj({"message": string(2000), "evidence_asset_ids": arr(ID, 0, 5)}, ["message"])
    s["Appeal"] = obj({"appeal_id": ID, "report_id": ID, "state": enum("OPEN", "REVIEWING", "RESOLVED", "REJECTED")})
    s["PrivacyDeletionRequest"] = obj({"scope": enum("PRODUCT", "ACCOUNT_MEDIA"), "product_id": ID,
                                       "acknowledge_inflight_contract": BOOL}, ["scope", "acknowledge_inflight_contract"])
    s["PrivacyDeletionRequest"]["allOf"] = [{"if": {"properties": {"scope": {"const": "PRODUCT"}}, "required": ["scope"]},
                                             "then": {"required": ["product_id"]}}]
    s["PrivacyDeletion"] = obj({"deletion_id": ID, "state": ref("PrivacyDeletionState"), "created_at": TIME,
                                "retained_categories": arr(string(200)), "limitations": arr(string(500))})
    s["HelpArticle"] = obj({"article_id": ID, "title": string(200), "body": string(10000)})
    s["ReviewDecisionRequest"] = obj({"expected_revision": number(), "decision": enum("APPROVE", "REQUEST_CHANGES", "REJECT"),
                                     "reason": string(2000), "evidence_record_ids": arr(ID, 0, 50)})
    s["VersionActionRequest"] = obj({"expected_revision": number(), "action": enum("ADMIT", "REJECT", "SUSPEND", "RESUME"),
                                    "reason": string(2000), "evidence_set_id": ID})
    s["AdmissionDecisionRequest"] = {"allOf": [ref("VersionActionRequest"), {"properties": {"action": enum("ADMIT", "REJECT")}}]}
    s["AvailabilityRequest"] = {"allOf": [ref("VersionActionRequest"), {"properties": {"action": enum("SUSPEND", "RESUME")}}]}
    s["ManagementActionRequest"] = obj({"reason": string(2000), "evidence_record_ids": arr(ID, 0, 50)})
    s["GovernanceDecisionRequest"] = obj({"expected_revision": number(), "decision": enum("RESOLVE", "DISMISS", "SUSPEND_CONTENT"),
                                         "reason": string(2000), "evidence_record_ids": arr(ID, 0, 50)})
    s["CompensationRequest"] = obj({"action": enum("REQUEST_ORIGINAL_REFUND", "REPLAY_ORIGINAL_OUTBOX"),
                                   "reason": string(2000), "evidence_record_ids": arr(ID, 1, 50)})
    s["ManagementResult"] = obj({"action_id": ID, "resource_id": ID, "state": enum("ACCEPTED", "COMPLETED", "BLOCKED"),
                                 "reason_codes": arr(string(100)), "updated_at": TIME})
    s["ManagedVersion"] = obj({"resource_id": ID, "kind": enum("MODEL", "VARIANT"), "revision": number(), "version": string(80),
                               "admission_state": ref("AdmissionState"), "sale_enabled": BOOL, "price_fen": nullable(number()),
                               "actual_model": nullable(string(200)), "model_version_ids": arr(ID, 0, 30),
                               "evidence_set_id": nullable(ID), "reason_codes": arr(string(100))})
    s["OrderTrace"] = obj({"order_id": ID, "events": arr(obj({"event_id": ID, "kind": string(100), "trace_id": ID,
                                                            "occurred_at": TIME}), 0, 100), "next_cursor": nullable(string(2048))})
    s["MetricsSummary"] = obj({"window_start": TIME, "window_end": TIME, "paid_orders": number(), "delivered_orders": number(),
                               "unknown_submissions": number(), "refunds_pending": number(), "hard_deadline_failures": number(),
                               "cost_currency": {"const": "CNY"}, "cost_micro_total": number(9007199254740991),
                               "automatic_pack_success_ratio": nullable({"type": "number", "minimum": 0, "maximum": 1}),
                               "route_p95_seconds": obj({engine: nullable(number()) for engine in ("PHOTO_LAYOUT", "PER_SHOT_AI", "REFERENCE_FILM")})})
    # Generate typed envelopes and cursored collection types, never a free-form object as a business response.
    models = list(s)
    for name in models:
        if name in ("Error", "StringMap") or name.endswith("Request") or name.endswith("Patch") or name.endswith("State"):
            continue
        s[name + "Response"] = obj({"code": {"const": "OK"}, "data": ref(name), "trace_id": ID})
    for name in ["Product", "PresetSummary", "Variant", "Recommendation", "Order", "Stage", "PresetDraft", "Report", "Ticket", "HelpArticle",
                 "ComponentOption", "VariantBlueprint", "ResourceOption", "Publication"]:
        s[name + "List"] = obj({"items": arr(ref(name), 0, 100), "next_cursor": nullable(string(2048))})
        s[name + "ListResponse"] = obj({"code": {"const": "OK"}, "data": ref(name + "List"), "trace_id": ID})
    return s


def openapi(s: dict, design_map: dict) -> tuple[dict, list[dict]]:
    paths: dict = {}
    endpoints: list[dict] = []
    parameters = {"IdempotencyKey": {"name": "Idempotency-Key", "in": "header", "required": True,
                                    "schema": {"type": "string", "minLength": 8, "maxLength": 128, "pattern": "^[A-Za-z0-9_-]+$"}},
                  "Cursor": {"name": "cursor", "in": "query", "required": False, "schema": string(2048)},
                  "Limit": {"name": "limit", "in": "query", "required": False, "schema": {**number(100, 1), "default": 20}}}
    public_ops = {"createPlatformSession", "listPresets", "getPresetVersion", "listPresetVariants", "listHelpArticles", "getPublicSampleMedia"}

    def add(method: str, path: str, operation: str, title: str, model: str | None,
            requirements: list[int], request: str | None = None, status: int = 200,
            listing: bool = False, tag: str = "buyer", notes: str = "") -> None:
        import re
        params = [{"name": p, "in": "path", "required": True, "schema": ID if p not in ("version", "provider") else (
            enum("alipay", "douyin") if p == "provider" else string(40))} for p in re.findall(r"\{([^}]+)\}", path)]
        callback = operation == "receivePaymentEvent"
        idempotent = method in ("post", "patch", "delete", "put") and operation not in (
            "createPlatformSession", "receivePaymentEvent", "setFavorite", "deleteFavorite")
        if idempotent:
            params.append({"$ref": "#/components/parameters/IdempotencyKey"})
        if listing:
            params.extend([{"$ref": "#/components/parameters/Cursor"}, {"$ref": "#/components/parameters/Limit"}])
        auth = "provider-native-signature-and-server-reconciliation" if callback else (
            "public-rate-limited" if operation in public_ops else "product-session-and-resource-ownership")
        reqids = fids(*requirements)
        pages = sorted({p for rid in reqids for p in design_map.get(rid, [])})
        responses = {str(status): {"description": "已持久化受理，可按资源ID查询" if status == 202 else "成功"}}
        if model:
            responses[str(status)]["content"] = {"application/json": {"schema": ref(model + "Response")}}
        else:
            responses[str(status)]["description"] = "按原支付通道正式协议返回ACK，不包裹产品JSON；实际报文适配后冻结"
        for code in (400, 401, 403, 404, 409, 410, 413, 422, 429, 503):
            responses[str(code)] = {"description": "业务/鉴权错误，具体code及恢复语义见接口文档",
                                    "content": {"application/json": {"schema": ref("Error")}}}
        op = {"operationId": operation, "summary": title, "description": notes or title,
              "tags": [tag], "parameters": params, "responses": responses,
              "security": [] if operation in public_ops or callback else [{"productSession": []}],
              "x-auth-policy": auth, "x-idempotency-required": idempotent,
              "x-requirements": reqids, "x-design-pages": pages, "x-implementation-status": STATUS}
        if request:
            op["requestBody"] = {"required": True, "content": {"application/json": {"schema": ref(request)}}}
        if callback:
            op["requestBody"] = {"required": True, "description": "保留原始字节，媒体类型/验签字段/ACK按获准通道正式协议；无产品Bearer不等于免验签。",
                "content": {"application/json": {"schema": {"description": "供应商原生JSON，解析前验签/查单；不在此发明统一字段"}},
                            "application/x-www-form-urlencoded": {"schema": {"type": "string"}},
                            "text/xml": {"schema": {"type": "string"}}}}
            op["x-response-adapter-required"] = True
        paths.setdefault(path, {})[method] = op
        endpoints.append({"method": method.upper(), "path": path, "operation_id": operation, "summary": title,
                          "request_schema": request, "response_schema": model, "success_status": status,
                          "auth_policy": auth, "idempotency_required": idempotent,
                          "requirements": reqids, "design_pages": pages, "implementation_status": STATUS})

    add("post", "/sessions/platform", "createPlatformSession", "宿主临时凭证换产品会话", "Session", [1, 23], "SessionRequest", tag="identity")
    add("post", "/products", "createProduct", "创建无商品表单草稿", "Product", [1, 2, 3], "ProductRequest", 201)
    add("get", "/products", "listProducts", "查询本人商品草稿", "ProductList", [1], listing=True)
    add("get", "/products/{product_id}", "getProduct", "恢复本人草稿版本", "Product", [1, 2])
    add("post", "/assets", "createUploadGrant", "申请私有照片上传授权", "UploadGrant", [2, 15, 23], "AssetRequest", 201, tag="assets")
    add("post", "/assets/{asset_id}/complete", "completeAssetUpload", "后端验证上传并确认READY", "Asset", [2, 15, 25], "AssetCompleteRequest", tag="assets")
    add("put", "/products/{product_id}/photos", "bindProductPhotos", "绑定3至5张已验证照片", "Product", [2, 3, 25], "PhotoBindingRequest")
    add("post", "/products/{product_id}/analyses", "createAnalysis", "受理真实多模态分析", "Analysis", [3, 25, 26, 34], "AnalysisRequest", 202, tag="analysis")
    add("get", "/analyses/{analysis_id}", "getAnalysis", "查询分析状态", "Analysis", [3, 26], tag="analysis")
    add("get", "/products/{product_id}/profile", "getProductProfile", "读取本人有证据档案", "Profile", [3, 26, 34], tag="analysis")
    add("post", "/products/{product_id}/corrections", "correctProfile", "可选纠错生成新档案锁版本", "Profile", [3, 12, 26, 34], "CorrectionRequest", tag="analysis")
    add("get", "/presets", "listPresets", "发现官方与社区方案", "PresetSummaryList", [4, 21, 27, 29], listing=True, tag="catalog")
    add("get", "/presets/{preset_id}/versions/{version}", "getPresetVersion", "查看不可变预设及授权样例信息", "PresetDetail", [4, 21, 30, 33], tag="catalog")
    add("get", "/presets/{preset_id}/versions/{version}/variants", "listPresetVariants", "查询效果变体与禁售原因", "VariantList", [19, 21, 33, 37, 38, 39, 42, 46], listing=True, tag="catalog")
    add("get", "/products/{product_id}/preset-recommendations", "recommendPresets", "基于本人档案推荐方案", "RecommendationList", [21, 25, 29], listing=True, tag="catalog")
    add("post", "/input-check", "checkVariantInput", "收费前核变体输入充分性", "InputCheck", [21, 25, 36, 42], "InputCheckRequest", tag="planning")
    add("post", "/plans", "createPlan", "受理有证据脚本与帧计划", "Plan", [5, 6, 32, 33, 35, 36, 37, 38, 39, 40], "PlanRequest", 202, tag="planning")
    add("get", "/plans/{plan_id}", "getPlan", "查询计划摘要与哈希", "Plan", [5, 6, 35], tag="planning")
    add("post", "/products/{product_id}/previews", "createOptionalPreview", "按同版计划受理可选本人预览", "Preview", [6, 7], "PreviewRequest", 202, tag="planning",
        notes="每日5个新本人预览的原子额度；已有预览查询/已购执行和领取不受额度限制，不偷偷提交收费视频。")
    add("get", "/previews/{preview_id}", "getOptionalPreview", "查询本人预览状态", "Preview", [6], tag="planning")
    add("post", "/previews/{preview_id}/download-link", "createPreviewLink", "授权访问本人预览", "PreviewLink", [6, 15], tag="planning",
        notes="仅READY且未过期的本人预览；与正式整包交付权益分开。")
    add("post", "/quotes", "createQuote", "服务端定价与冻结整包合同", "Quote", [7, 33, 42, 46], "QuoteRequest", 201, tag="transactions")
    add("post", "/orders", "createOrder", "消费报价建立原渠道订单", "Order", [6, 7, 8, 33], "OrderRequest", 201, tag="transactions")
    add("get", "/orders", "listOrders", "查询本人作品与订单", "OrderList", [1, 8, 11], listing=True, tag="transactions")
    add("get", "/orders/{order_id}", "getOrder", "查询验付履约与退款引用", "Order", [8, 9, 13], tag="transactions")
    add("post", "/orders/{order_id}/payment-attempts", "getOrCreatePaymentAction", "沿原单创建或恢复获准支付动作", "PaymentAction", [8, 23], tag="transactions",
        notes="核当前宿主/app/商户/用户与原单；UNKNOWN先查原attempt。action由本端适配器生成，不视为最终官方SDK报文。")
    add("post", "/payment-events/{provider}", "receivePaymentEvent", "接收原通道支付事件并后端核验", None, [8, 13, 43], tag="transactions")
    add("get", "/jobs/{job_id}", "getJob", "读取云端任务真实状态", "Job", [9, 43, 46, 49, 50], tag="generation")
    add("get", "/jobs/{job_id}/stages", "listJobStages", "查询脱敏阶段状态", "StageList", [9, 43, 50], listing=True, tag="generation")
    add("get", "/orders/{order_id}/deliverables", "getDeliverables", "完整QC交付后读取素材清单", "Deliverables", [10, 11, 40, 41], tag="delivery")
    add("post", "/deliverables/{deliverable_id}/download-link", "createDownloadLink", "校验领取权益后签发5分钟短链", "DownloadLink", [11, 15, 22], tag="delivery")
    add("post", "/save-sessions", "createSaveSession", "记录本安装保存队列", "SaveSession", [11, 22, 23], "SaveSessionRequest", 201, tag="delivery")
    add("post", "/save-receipts", "recordSaveReceipt", "幂等记录逐文件相册回执", "Receipt", [17, 22, 23], "SaveReceiptRequest", tag="delivery")
    add("post", "/orders/{order_id}/cancel", "cancelOrder", "按原单合同取消并处理在途竞态", "Order", [8, 13, 43], "ReasonRequest", tag="support")
    add("post", "/orders/{order_id}/refund-requests", "requestRefund", "提交原渠道退款请求", "Refund", [13, 16], "ReasonRequest", 202, tag="support")
    add("get", "/refunds/{refund_id}", "getRefund", "查询原退款真实状态", "Refund", [13, 16], tag="support")
    add("post", "/orders/{order_id}/revisions", "requestLimitedRevision", "48小时一次受限小修改", "Revision", [12], "RevisionRequest", 202, tag="support")
    add("get", "/revisions/{revision_id}", "getRevision", "查询关联修改版本", "Revision", [12], tag="support")
    add("post", "/orders/{order_id}/tickets", "createSupportTicket", "提交原单帮助或平台纠错", "Ticket", [12, 14, 16], "TicketRequest", 201, tag="support")
    add("get", "/tickets", "listSupportTickets", "查询本人售后工单", "TicketList", [16], listing=True, tag="support")
    add("get", "/tickets/{ticket_id}", "getSupportTicket", "查询本人售后处理", "Ticket", [16], tag="support")
    add("get", "/help-articles", "listHelpArticles", "自助帮助", "HelpArticleList", [16], listing=True, tag="support")
    add("post", "/privacy-deletions", "requestPrivacyDeletion", "请求清理本人商品或账户媒体", "PrivacyDeletion", [15], "PrivacyDeletionRequest", 202, tag="privacy")
    add("get", "/privacy-deletions/{deletion_id}", "getPrivacyDeletion", "查询清理回执与保留边界", "PrivacyDeletion", [15], tag="privacy")
    add("get", "/community-components", "listCommunityComponents", "作者查询平台受控组件目录", "ComponentOptionList", [28, 32], listing=True, tag="community")
    add("get", "/variant-blueprints", "listVariantBlueprints", "作者查询允许组合的执行蓝本", "VariantBlueprintList", [28, 32, 33, 42], listing=True, tag="community")
    add("get", "/community-resource-versions", "listCommunityResources", "作者查询获准字体音乐人物声音资源", "ResourceOptionList", [28, 30, 36, 40, 47], listing=True, tag="community")
    add("post", "/rights-records", "submitRightsRecord", "作者提交私有授权证据", "RightsRecord", [15, 28, 30, 47], "RightsRecordRequest", 201, tag="community")
    add("get", "/rights-records/{rights_record_id}", "getRightsRecord", "查询本人权利证据审核", "RightsRecord", [28, 30, 47], tag="community")
    add("post", "/preset-drafts", "createPresetDraft", "创建受控社区方案草稿", "PresetDraft", [4, 28, 32], "PresetDraftRequest", 201, tag="community")
    add("get", "/preset-drafts", "listPresetDrafts", "列出作者本人草稿", "PresetDraftList", [28], listing=True, tag="community")
    add("get", "/preset-drafts/{draft_id}", "getPresetDraft", "恢复作者草稿与版本", "PresetDraft", [28, 33], tag="community")
    add("patch", "/preset-drafts/{draft_id}", "updatePresetDraft", "乐观并发更新受控配置", "PresetDraft", [28, 32, 33], "PresetDraftPatch", tag="community")
    add("post", "/preset-drafts/{draft_id}/samples", "createPresetSample", "受理授权私有样例生成", "Sample", [28, 36, 47], "SampleRequest", 202, tag="community")
    add("get", "/preset-samples/{sample_id}", "getPresetSample", "查询作者样例状态", "Sample", [28, 47], tag="community")
    add("post", "/preset-samples/{sample_id}/media-links", "createPrivateSampleMediaLinks", "授权作者查看本人私有样例", "SampleMedia", [15, 28, 47], tag="community")
    add("get", "/public-samples/{sample_id}", "getPublicSampleMedia", "查看独立授权且审核公开的样例", "PublicSampleMedia", [21, 28, 31, 47], tag="catalog",
        notes="仅AUTHORIZED_PUBLIC独立对象；禁用/撤回不再签发，私有样例不能凭ID匿名访问。")
    add("get", "/appeals/{appeal_id}", "getAppeal", "查询本人或有权当事人的申诉", "Appeal", [31], tag="community")
    add("post", "/preset-drafts/{draft_id}/submit", "submitPresetPublication", "提交审核与准入材料", "Publication", [28, 30, 31, 47], "PublicationRequest", 202, tag="community")
    add("get", "/preset-publications/{publication_id}", "getPresetPublication", "查询审核准入与停售状态", "Publication", [28, 31, 50], tag="community")
    add("put", "/presets/{preset_id}/favorite", "setFavorite", "收藏方案", "Favorite", [29], tag="community")
    add("delete", "/presets/{preset_id}/favorite", "deleteFavorite", "取消收藏", "Favorite", [29], tag="community")
    add("get", "/favorites", "listFavorites", "查询本人收藏", "PresetSummaryList", [29], listing=True, tag="community")
    add("post", "/presets/{preset_id}/forks", "forkPreset", "依父版本许可派生草稿", "PresetDraft", [30, 32], "ForkRequest", 201, tag="community")
    add("post", "/presets/{preset_id}/reports", "reportPreset", "举报版本与提交私有证据", "Report", [31], "ReportRequest", 201, tag="community")
    add("get", "/reports", "listReports", "查询本人举报", "ReportList", [31], listing=True, tag="community")
    add("get", "/reports/{report_id}", "getReport", "查询有权读取的举报决定", "Report", [31], tag="community")
    add("post", "/reports/{report_id}/appeals", "appealReportDecision", "对有权申诉的治理决定申诉", "Appeal", [31], "AppealRequest", 201, tag="community")
    spec = {"openapi": "3.1.1", "jsonSchemaDialect": "https://json-schema.org/draft/2020-12/schema",
            "info": {"title": "一品成片 P01 自有业务API", "version": "1.0.0-design",
                     "description": "需求v3.0/C设计v1.0的拟实现合同。无部署；支付原生协议另由获准通道SDK适配。"},
            "servers": [{"url": "/v1/p01", "description": "相对基路径；未指定生产域名"}],
            "security": [{"productSession": []}], "paths": paths,
            "components": {"securitySchemes": {"productSession": {"type": "http", "scheme": "bearer",
                            "description": "产品后端换发短期会话；逐对象授权并非持token即可读全站"}},
                           "parameters": parameters, "schemas": s},
            "x-implementation-status": STATUS,
            "x-management-contract": "management-openapi.json; independent management identity, planned not implemented",
            "x-platform-adapter-status": "PROVIDER_NATIVE_PAYMENT_PAYLOADS_NOT_VERIFIED"}
    return spec, endpoints


def management_openapi(public: dict) -> tuple[dict, list[dict]]:
    import copy
    import re
    definitions = [
        ("get", "/publications", "listReviewQueue", "查询预设审核队列", "PublicationList", None, "moderator:review", [14, 28, 31]),
        ("post", "/publications/{publication_id}/review-decisions", "decidePublicationReview", "留证据的内容与权利审核", "Publication", "ReviewDecisionRequest", "moderator:review", [14, 28, 30, 31, 47]),
        ("post", "/publications/{publication_id}/publish", "publishApprovedPreset", "仅在审核及准入齐备后发布", "Publication", "ManagementActionRequest", "moderator:publish", [14, 28, 33, 47]),
        ("get", "/variants/{variant_id}/versions/{version}", "getManagedVariantVersion", "查询变体管理修订与准入证据索引", "ManagedVersion", None, "registry:read", [14, 33, 42, 46]),
        ("get", "/model-versions/{model_version_id}", "getManagedModelVersion", "查询模型管理修订与能力证据索引", "ManagedVersion", None, "registry:read", [42, 50]),
        ("post", "/variants/{variant_id}/versions/{version}/admission-decisions", "decideVariantAdmission", "按能力权利价格基准证据准入或拒绝", "ManagementResult", "AdmissionDecisionRequest", "registry:admit", [14, 33, 42, 46, 47]),
        ("post", "/variants/{variant_id}/versions/{version}/sale-status", "changeVariantAvailability", "精确停新售或经重验恢复", "ManagementResult", "AvailabilityRequest", "registry:availability", [14, 42, 50]),
        ("post", "/model-versions/{model_version_id}/availability", "changeModelAvailability", "模型能力版本停售或重验恢复", "ManagementResult", "AvailabilityRequest", "registry:availability", [42, 50]),
        ("post", "/reports/{report_id}/decisions", "decideGovernanceReport", "审理举报并记录决定", "Report", "GovernanceDecisionRequest", "moderator:govern", [31]),
        ("get", "/orders/{order_id}/trace", "readRedactedOrderTrace", "按需审计读取原单脱敏事件", "OrderTrace", None, "support:read_order_trace", [14, 16, 43, 50]),
        ("post", "/orders/{order_id}/platform-repairs", "requestPlatformErrorRepair", "平台错误关联免费纠错不耗小改额度", "Revision", "ManagementActionRequest", "support:repair", [12, 14, 41]),
        ("post", "/orders/{order_id}/compensations", "requestOriginalOrderCompensation", "原单退款或幂等补投原履约事件", "ManagementResult", "CompensationRequest", "finance:compensate", [8, 13, 14, 43]),
        ("post", "/provider-submissions/{submission_id}/reconciliations", "reconcileProviderSubmission", "查原任务或消费有证据的对账记录", "ManagementResult", "ManagementActionRequest", "operator:reconcile_submission", [14, 43, 46]),
        ("get", "/metrics/summary", "readOperationalSummary", "按窗口读取聚合履约成本质量索引", "MetricsSummary", None, "metrics:read", [17, 50]),
        ("post", "/privacy-deletions/{deletion_id}/reconcile", "reconcilePrivacyDeletion", "重试受控清理并更新边界回执", "PrivacyDeletion", "ManagementActionRequest", "privacy:reconcile", [15, 50]),
        ("get", "/actions/{action_id}", "getManagementAction", "有权限的发起者查询管理动作进展", "ManagementResult", None, "management:read_own_action", [14, 50]),
    ]
    paths = {}
    endpoints = []
    for method, path, operation, title, response, request, role, requirements in definitions:
        params = [{"name": field, "in": "path", "required": True, "schema": string(40) if field == "version" else ID}
                  for field in re.findall(r"\{([^}]+)\}", path)]
        if method == "post":
            params.append({"$ref": "#/components/parameters/IdempotencyKey"})
        if method == "get":
            params.extend([{"$ref": "#/components/parameters/Cursor"}, {"$ref": "#/components/parameters/Limit"}])
        if operation == "readOperationalSummary":
            params.extend([{"name": key, "in": "query", "required": True, "schema": TIME} for key in ("window_start", "window_end")])
        op = {"operationId": operation, "summary": title, "description": "管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。",
              "security": [{"managementSession": []}], "parameters": params,
              "x-required-permission": role, "x-requirements": fids(*requirements), "x-implementation-status": STATUS,
              "x-idempotency-required": method == "post", "responses": {
                  "200": {"description": "持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明",
                          "content": {"application/json": {"schema": ref(response + "Response")}}},
                  "default": {"description": "鉴权/状态/证据/依赖错误", "content": {"application/json": {"schema": ref("Error")}}}}}
        if request:
            op["requestBody"] = {"required": True, "content": {"application/json": {"schema": ref(request)}}}
        paths.setdefault(path, {})[method] = op
        endpoints.append({"method": method.upper(), "path": path, "operation_id": operation, "summary": title,
                          "permission": role, "request_schema": request, "response_schema": response,
                          "requirements": fids(*requirements), "implementation_status": STATUS})
    components = copy.deepcopy(public["components"])
    components["securitySchemes"] = {"managementSession": {"type": "http", "scheme": "bearer",
        "description": "独立管理身份audience/issuer与细粒度permission；不接受产品Bearer，逐动作鉴权/审计"}}
    result = {"openapi": "3.1.1", "jsonSchemaDialect": public["jsonSchemaDialect"],
              "info": {"title": "一品成片 P01 内部管理API", "version": "1.0.0-design", "description": "仅管理域设计，尚无实现。不对小程序买家/作者开放。"},
              "servers": [{"url": "/v1/internal/p01"}], "security": [{"managementSession": []}],
              "paths": paths, "components": components, "x-implementation-status": STATUS}
    return result, endpoints


def data_model() -> dict:
    # Scope distinguishes private composite foreign keys from globally versioned public catalogs.
    rows = [
        ("tenants", "tenant_id", "root", "created_at", "tenant_id", "tenant root"),
        ("users", "user_id", "tenant", "tenant_id,created_at", "tenant_id,user_id", "subject ownership"),
        ("platform_identities", "identity_id", "tenant", "user_id,platform,app_id,subject_id", "platform,app_id,subject_id", "no nickname merge"),
        ("sessions", "session_id", "tenant", "user_id,token_hash,expires_at,revoked_at", "token_hash", "hashed/revocable tokens"),
        ("product_drafts", "product_id", "tenant", "owner_id,revision,current_photo_version,current_profile_id", "tenant_id,product_id", "optimistic revision"),
        ("assets", "asset_id", "tenant", "owner_id,product_id,purpose,state,object_key,sha256,size_bytes,width,height,expires_at", "tenant_id,asset_id", "private verified object"),
        ("product_photo_versions", "photo_version_id", "tenant", "product_id,revision,photo_set_hash", "tenant_id,product_id,revision", "immutable ordered photo set"),
        ("product_photo_items", "photo_item_id", "tenant", "photo_version_id,asset_id,position", "tenant_id,photo_version_id,position", "composite tenant foreign keys to photo version and asset"),
        ("analysis_jobs", "analysis_id", "tenant", "product_id,photo_version_id,input_hash,state,model_version,deadline_at", "tenant_id,analysis_id", "bounded real-vision analysis"),
        ("analysis_attempts", "analysis_attempt_id", "tenant", "analysis_id,attempt,request_hash,receipt_ref", "tenant_id,analysis_id,attempt", "initial plus one retry"),
        ("profile_versions", "profile_id", "tenant", "product_id,photo_version_id,revision,schema_version,evidence_json,profile_json,profile_hash", "tenant_id,product_id,revision", "immutable observed/OCR/hypothesis/unknown"),
        ("identity_locks", "identity_lock_id", "tenant", "profile_id,lock_version,lock_json,hash", "tenant_id,profile_id,lock_version", "immutable packaging/shape/quantity lock"),
        ("correction_versions", "correction_id", "tenant", "product_id,parent_profile_id,new_profile_id,source,actor", "tenant_id,correction_id", "append-only correction provenance"),
        ("source_recipes", "source_recipe_id", "catalog", "repository,commit,path,license,source_hash", "repository,commit,source_recipe_id", "read-only provenance"),
        ("component_versions", "component_version_id", "catalog", "type,version,schema_ref,allowed_resources", "type,version", "platform-owned schemas, no executable author code"),
        ("presets", "preset_id", "catalog", "author_id,source,current_version,visibility", "preset_id", "public content is not private buyer data"),
        ("preset_versions", "preset_version_id", "catalog", "preset_id,version,parent_version_id,config_json,hash,license_version", "preset_id,version", "published immutable version"),
        ("execution_variants", "variant_version_id", "catalog", "preset_version_id,variant_id,version,engine,admission_state,sale_enabled,price_fen,policy_json", "variant_id,version", "null prices/models cannot sell"),
        ("resource_licenses", "license_record_id", "restricted", "resource_id,version,scope,evidence_ref,expires_at,revoked_at", "resource_id,version,scope", "rights evidence access restricted"),
        ("rights_records", "rights_record_id", "tenant", "author_id,scope,statement,evidence_asset_ids,state,decision_ref", "tenant_id,rights_record_id", "private evidence, not author self-approval"),
        ("preset_drafts", "draft_id", "tenant", "author_id,revision,config_json,parent_version_id", "tenant_id,draft_id", "author-only mutable draft"),
        ("publications", "publication_id", "tenant", "draft_id,draft_revision,review_state,admission_state,decision_actor,published_version_id", "tenant_id,draft_id,draft_revision", "publish only by moderator"),
        ("public_samples", "sample_id", "tenant", "draft_id,asset_refs,rights_record_ids,visibility,qc_ref", "tenant_id,sample_id", "separate authorized public projection"),
        ("favorites", "favorite_id", "tenant", "user_id,preset_id", "tenant_id,user_id,preset_id", "intrinsically idempotent"),
        ("forks", "fork_id", "tenant", "author_id,parent_version_id,draft_id,license_snapshot", "tenant_id,draft_id", "preserve attribution/license chain"),
        ("moderation_reports", "report_id", "tenant", "reporter_id,preset_version_id,reason,evidence_refs,state,decision", "tenant_id,report_id", "private reporter evidence"),
        ("moderation_appeals", "appeal_id", "tenant", "report_id,appellant_id,evidence_refs,state", "tenant_id,appeal_id", "authorized party and moderator only"),
        ("provider_model_versions", "model_version_id", "restricted", "provider,actual_model,capabilities_json,rate_snapshot,status,credential_ref", "provider,actual_model,version", "credentials external, immutable capability/rates"),
        ("character_versions", "character_version_id", "restricted", "character_id,version,appearance_ref,voice_ref,license_record_ids", "character_id,version", "identity/voice rights frozen"),
        ("scene_locks", "scene_lock_id", "tenant", "plan_id,scene_json,hash", "tenant_id,scene_lock_id", "fixed look and scene constraints"),
        ("plan_versions", "plan_id", "tenant", "product_id,photo_version_id,profile_id,identity_lock_id,variant_version_id,state,plan_json,plan_hash", "tenant_id,plan_id", "immutable validated READY plan"),
        ("shot_plans", "shot_plan_id", "tenant", "plan_id,shot_id,start_frame,end_frame,overlap_frames,evidence_refs,dependency_ids", "tenant_id,plan_id,shot_id", "integer frame and factual speech constraints"),
        ("reference_frame_sets", "reference_set_id", "tenant", "plan_id,shot_id,layout_json,asset_refs,mapping_json,quality_decision", "tenant_id,reference_set_id", "grid/single crops count toward real limits"),
        ("quotes", "quote_id", "tenant", "plan_id,plan_hash,amount_fen,currency,expires_at,state,consumed_order_id,snapshot_json", "tenant_id,quote_id", "15-minute, single consumption"),
        ("optional_previews", "preview_id", "tenant", "owner_id,product_id,plan_id,plan_hash,state,object_key,expires_at", "tenant_id,preview_id", "same version as quote; explicit preview not final pack"),
        ("quota_buckets", "quota_bucket_id", "tenant", "owner_id,kind,window_start,used_count,limit", "tenant_id,owner_id,kind,window_start", "atomic new-preview quota; never blocks paid fulfillment"),
        ("orders", "order_id", "tenant", "owner_id,quote_id,channel,app_id,amount_fen,payment_state,fulfillment_state,payable_until", "tenant_id,quote_id", "same order lock for payment/cancel/publish/refund"),
        ("execution_snapshots", "execution_snapshot_id", "tenant", "order_id,snapshot_json,hash,policy_version", "tenant_id,order_id", "immutable sold contract including cost/deadline"),
        ("payments", "payment_id", "tenant", "order_id,provider,merchant_id,provider_order_id,state,amount_fen", "provider,merchant_id,provider_order_id", "original-channel reconciliation"),
        ("payment_events", "payment_event_id", "restricted", "provider,merchant_id,event_key,payment_id,raw_hash,verified_at", "provider,merchant_id,event_key", "raw secrets not general logs"),
        ("refunds", "refund_id", "tenant", "order_id,payment_id,refund_intent_key,state,amount_fen,provider_ref", "provider,merchant_id,refund_intent_key", "atomic cumulative refund cap"),
        ("ledger_entries", "ledger_entry_id", "tenant", "order_id,event_key,entry_type,amount_fen,currency", "tenant_id,event_key,entry_type", "append only, no erasing old funds"),
        ("render_jobs", "job_id", "tenant", "order_id,execution_snapshot_id,state,fulfillable_at,deadline_at,repair_rounds", "tenant_id,order_id,execution_snapshot_id", "durable contract-bound lifecycle"),
        ("stage_runs", "stage_run_id", "tenant", "job_id,stage_id,attempt,input_hash,state,lease_owner,lease_expires_at,fencing_token", "tenant_id,job_id,stage_id,attempt", "short SQL claim, guarded results"),
        ("provider_submissions", "submission_id", "tenant", "stage_run_id,intent_key,input_hash,state,provider_task_id,receipt_ref,budget_reservation_id", "tenant_id,intent_key", "persist before paid POST; UNKNOWN no resubmit"),
        ("budget_reservations", "reservation_id", "tenant", "order_id,submission_id,amount_micro,currency,rate_snapshot,state", "tenant_id,submission_id", "atomic budget including unresolved UNKNOWN"),
        ("outbox_events", "outbox_event_id", "tenant", "aggregate_type,aggregate_id,event_key,payload,available_at,delivered_at", "tenant_id,event_key", "transactional event, dedup consumer"),
        ("idempotency_records", "idempotency_record_id", "tenant", "subject_id,operation,target_id,key,request_hash,resource_id,expires_at", "tenant_id,subject_id,operation,target_id,key", "same key different body conflict, no long-lived token response"),
        ("artifacts", "artifact_id", "tenant", "order_id,stage_run_id,slot_id,object_key,sha256,spec_json,expires_at", "tenant_id,artifact_id", "private intermediate or result"),
        ("qc_decisions", "qc_decision_id", "tenant", "order_id,artifact_id,ruleset_version,decision,evidence_ref", "tenant_id,qc_decision_id", "independent/versioned QC, immutable decision"),
        ("delivery_manifests", "manifest_id", "tenant", "order_id,revision,items_json,hash,qc_set_ref,delivered_at,expires_at", "tenant_id,order_id,revision", "atomic complete manifest"),
        ("save_sessions", "save_session_id", "tenant", "order_id,owner_id,installation_id,deliverable_ids", "tenant_id,save_session_id", "experience telemetry only"),
        ("save_receipts", "receipt_id", "tenant", "save_session_id,deliverable_id,attempt,state,occurred_at", "tenant_id,save_session_id,deliverable_id,attempt,state", "never changes funds/fulfillment"),
        ("revision_requests", "revision_id", "tenant", "order_id,parent_manifest_revision,kind,state,consumes_user_allowance,result_manifest_id", "tenant_id,revision_id", "48h optional allowance consumed only on success"),
        ("support_tickets", "ticket_id", "tenant", "order_id,owner_id,category,message,attachment_refs,state", "tenant_id,ticket_id", "platform error repair separate from optional revision"),
        ("privacy_deletions", "deletion_id", "tenant", "owner_id,scope,state,object_refs,receipts,limitations", "tenant_id,deletion_id", "restore must replay deletion markers"),
        ("audit_events", "audit_event_id", "restricted", "tenant_id,actor,action,target,trace_id,payload_hash,occurred_at", "audit_event_id", "append-only minimal/redacted evidence"),
    ]
    entities = []
    for table, pk, scope, fields, unique, invariant in rows:
        names = [pk, *fields.split(",")]
        if scope == "tenant" and "tenant_id" not in names:
            names.insert(1, "tenant_id")
        # The catalog is not executable DDL. Names used in logical uniqueness must exist in field inventory.
        for field in unique.split(","):
            if field not in names:
                names.append(field)
        entities.append({"table": table, "primary_key": pk, "scope": scope, "fields": list(dict.fromkeys(names)),
                         "unique_key": unique.split(","), "ownership_unique_key": ["tenant_id", pk] if scope == "tenant" else None,
                         "invariant": invariant, "implementation_status": STATUS})
    relations = [
        ("product_photo_items", "assets", ["tenant_id", "asset_id"]),
        ("product_photo_items", "product_photo_versions", ["tenant_id", "photo_version_id"]),
        ("profile_versions", "product_drafts", ["tenant_id", "product_id"]),
        ("identity_locks", "profile_versions", ["tenant_id", "profile_id"]),
        ("quotes", "plan_versions", ["tenant_id", "plan_id"]),
        ("orders", "quotes", ["tenant_id", "quote_id"]),
        ("execution_snapshots", "orders", ["tenant_id", "order_id"]),
        ("render_jobs", "orders", ["tenant_id", "order_id"]),
        ("stage_runs", "render_jobs", ["tenant_id", "job_id"]),
        ("provider_submissions", "stage_runs", ["tenant_id", "stage_run_id"]),
        ("artifacts", "orders", ["tenant_id", "order_id"]),
        ("delivery_manifests", "orders", ["tenant_id", "order_id"]),
        ("save_sessions", "orders", ["tenant_id", "order_id"]),
        ("save_receipts", "save_sessions", ["tenant_id", "save_session_id"]),
        ("moderation_appeals", "moderation_reports", ["tenant_id", "report_id"]),
    ]
    return {"schema_version": "1.0.0", "status": STATUS, "database": "PostgreSQL",
            "note": "逻辑实体/字段/关键唯一键和部分高风险外键目录；不是已执行DDL。迁移实现时补齐全部外键/类型/索引/check与兼容。",
            "entities": entities, "critical_composite_relations": [{"from": a, "to": b, "fields": fields} for a, b, fields in relations],
            "transactions": ["consume_quote_and_create_order", "verify_payment_create_job_and_outbox", "claim_stage_with_fencing_token",
                             "reserve_budget_and_persist_intent", "publish_complete_manifest_under_order_lock", "cancel_refund_and_late_result_guard"],
            "immutable_records": ["profile_versions", "identity_locks", "preset_versions", "execution_snapshots", "delivery_manifests", "ledger_entries"]}


def work_packages(requirements: list[dict], design_map: dict) -> dict:
    definitions = [
        (1, "能力与来源准入", [], "G0", [19, 23, 32, 38, 39, 42, 47], "docs/实施", "实际模型/费率/参考/声音/宿主与资源许可证据"),
        (2, "schema与版本", [1], "G0", [3, 4, 7, 32, 33, 35], "src/shared/contracts", "结构/引用/坏类型、版本不可变和OpenAPI实现一致"),
        (3, "商品与脚本规划", [2, 5], "G1", [3, 5, 6, 12, 21, 25, 26, 32, 34, 35], "src/worker/analysis", "真实视觉证据/商品锁、事实台词、整数帧时长与输入不足阻断"),
        (4, "模型注册与计划报价", [1, 2, 3], "G1", [7, 21, 33, 42, 46], "src/api/modules/plans", "未知模型/价不可售，快照/报价/时限/预算完整"),
        (5, "身份与私有资产", [2], "G0", [1, 2, 15, 23], "src/api/modules/identity", "双端身份、READY上传、跨租户/作者拒绝、到期/隐私清理"),
        (6, "原图与图包引擎", [3, 5], "G1", [5, 10, 27, 37], "src/worker/renderers/photo-layout", "10套基础图包/视频/文案与各自槽位/时长"),
        (7, "参考帧与锁检查", [1, 3, 5], "G1", [34, 36, 41], "src/worker/references", "格图/裁图/真实参考额度与商品关键帧QC"),
        (8, "逐镜AI引擎", [4, 7], "G1", [19, 37, 38, 43], "src/worker/renderers/per-shot", "三逐镜变体/声音/依赖/复用及实际任务"),
        (9, "原生整片引擎", [4, 7], "G1", [19, 37, 39, 43], "src/worker/renderers/reference-film", "15秒参考连续多镜/人物商品/原声与能力失败"),
        (10, "统一后期", [6, 8, 9], "G1", [10, 35, 40], "src/worker/post-production", "真实compose、原声/字幕/ducking/AI标识/封面/编码"),
        (11, "任务预算与交易", [2, 4, 5], "G2", [8, 9, 12, 13, 43, 46, 49], "src/api/modules/orders", "原渠道验付退款、幂等/outbox、UNKNOWN不重购、并发预算/截止与崩溃恢复"),
        (12, "全包QC与发布", [3, 6, 7, 8, 9, 10, 11], "G1", [10, 11, 34, 40, 41, 47], "src/worker/qc", "全片/全包门槛、原子manifest、取消/退款/发布竞态"),
        (13, "双小程序轻交互", [4, 5, 11, 12], "G2", [1, 2, 6, 11, 12, 16, 21, 22, 23, 49], "src/shared/mini", "C23单元、四组真机、原单恢复/权限/逐文件保存"),
        (14, "社区发布与治理", [2, 4, 12, 13], "G3", [4, 21, 28, 29, 30, 31, 32, 33], "src/api/modules/community", "两作者/两买家、受控组件/许可/授权样例/审核/派生/举报申诉"),
        (15, "样例基准与上架", [6, 7, 8, 9, 10, 12, 14], "G3", [17, 19, 25, 26, 27, 38, 39, 41, 47], "tests", "14×30整包、识别100/高危负例100、成本/时限/声音/正例误拒"),
        (16, "观测发布与恢复", [11, 12, 15], "G4", [14, 15, 16, 17, 23, 43, 49, 50], "scripts", "脱敏监测、能力停售/迁移/回滚/清理/恢复及全P0证据"),
    ]
    packages = [{"id": f"V3-{n:02d}", "name": name, "dependencies": [f"V3-{v:02d}" for v in deps],
                 "delivery_gate": gate, "requirements": fids(*refs), "target_path": path, "done_evidence": evidence,
                 "implementation_status": STATUS, "test_execution_status": "NOT_RUN",
                 "note": "阶段按纵向交付可分子任务；基础安全/交易测试不能等到delivery_gate才开始。"}
                for n, name, deps, gate, refs, path, evidence in definitions]
    future = {18: (13, "网页Plus深化"), 20: (13, "获准外部发布"), 24: (5, "双端身份绑定与Plus接续"),
              44: (8, "多语言能力/后期变体"), 45: (3, "同商品A/B开头"), 48: (4, "条件化高级方案准入")}
    mapping = []
    for req in requirements:
        ids = [p["id"] for p in packages if req["id"] in p["requirements"]]
        n = int(req["id"][-2:])
        if n in future:
            ids = [f"V3-{future[n][0]:02d}"]
        pages = design_map.get(req["id"], [])
        mapping.append({"requirement": req["id"], "title": req["title"], "priority": req["priority"],
                        "test_case": req["test_case"], "work_packages": ids, "design_pages": pages,
                        "scope": "REQUIRED_P0" if req["priority"] == "P0" else "FUTURE_" + req["priority"],
                        "implementation_status": STATUS, "test_execution_status": "NOT_RUN"})
    return {"version": "1.0.0", "requirements_version": "3.0", "status": STATUS, "packages": packages,
            "requirement_mapping": mapping,
            "future_backlog": [{"requirement": f"P01-F{n:02d}", "owner_work_package": f"V3-{v[0]:02d}",
                                "name": v[1], "required_for_p0_launch": False} for n, v in future.items()],
            "estimate": {"status": "REESTIMATE_AFTER_G0", "total_person_days": None, "calendar_weeks": None,
                         "historical_v2_1_estimate_not_applicable": True},
            "gate_note": "G1先证明三路线纵向原型，完整事务/双端证据在G2；依赖包可交付早期子任务，不代表整个包提前完成。"}


def internal_contracts() -> dict[str, dict]:
    lock = obj({"schema_version": {"const": "1.0.0"}, "identity_lock_id": ID, "tenant_id": ID, "profile_id": ID,
                "photo_version": number(2147483647, 1), "source_asset_ids": {**arr(ID, 3, 5), "uniqueItems": True},
                "features": arr(obj({"kind": enum("SHAPE", "PACKAGING", "QUANTITY", "COLOR", "TEXT_LOGO", "STRUCTURE", "ACCESSORY"),
                                     "value": string(1000), "evidence_ids": arr(ID, 1, 30)}), 1, 100),
                "unknowns": arr(string(300)), "canonicalization": {"const": "RFC8785"}, "content_hash": HASH})
    model = obj({"provider": ID, "actual_model": string(200), "registry_version": string(80),
                 "roles": arr(enum("VISION_ANALYSIS", "IMAGE", "VIDEO", "SPEECH", "QC"), 1, 5),
                 "capability_hash": HASH, "rate_snapshot_id": ID})
    media_slot = obj({"slot_id": ID, "kind": enum("image", "video", "copy"), "count": number(100, 1),
                      "width": nullable(number(8192, 1)), "height": nullable(number(8192, 1)),
                      "fps": nullable(number(120, 1)), "duration_frames": nullable(number(1000000, 1)),
                      "format": enum("png", "mp4-h264-yuv420p", "text")})
    audio = obj({"speech_mode": enum("NONE", "NATIVE_ZH"), "language": nullable(enum("zh-CN")),
                 "native_voice_id": nullable(ID), "preserve_native_speech": BOOL,
                 "caption_alignment": enum("ACTUAL_AUDIO", "NO_SPEECH"), "music_license_ids": arr(ID),
                 "ducking_enabled": BOOL})
    audio["allOf"] = [{"if": {"properties": {"speech_mode": {"const": "NATIVE_ZH"}}, "required": ["speech_mode"]},
                       "then": {"properties": {"language": {"const": "zh-CN"}, "native_voice_id": ID,
                                               "preserve_native_speech": {"const": True}, "caption_alignment": {"const": "ACTUAL_AUDIO"}}}}]
    snapshot = obj({"schema_version": {"const": "1.0.0"}, "order_id": ID, "tenant_id": ID, "product_id": ID,
                    "photo_version": number(2147483647, 1), "photo_set_hash": HASH, "profile_id": ID, "profile_hash": HASH,
                    "identity_lock_id": ID, "identity_lock_hash": HASH, "preset_id": ID, "preset_version": string(40),
                    "variant_id": ID, "variant_version": string(40), "engine": enum("PHOTO_LAYOUT", "PER_SHOT_AI", "REFERENCE_FILM"),
                    "plan_hash": HASH, "canonicalization": {"const": "RFC8785"}, "model_versions": arr(model, 1, 20),
                    "resource_versions": arr(obj({"resource_version_id": ID, "license_record_id": ID, "hash": HASH}), 0, 100),
                    "reference_policy": obj({"max_images": number(1000), "max_total_pixels": number(1000000000),
                                             "mapping_hash": nullable(HASH)}),
                    "audio_policy": audio,
                    "timeline": obj({"fps": {"const": 30}, "target_frames": number(1000000, 1),
                                     "shots": arr(obj({"shot_id": ID, "start_frame": number(1000000), "end_frame": number(1000000, 1),
                                                       "overlap_frames": number(1000000), "evidence_ids": arr(ID),
                                                       "spoken_text": string(3000, 0)}), 1, 100)}),
                    "outputs": arr(media_slot, 1, 30),
                    "pricing": obj({"currency": {"const": "CNY"}, "amount_fen": number(), "terms_version": string(80)}),
                    "budget": obj({"currency": {"const": "CNY"}, "ceiling_micro": number(9007199254740991),
                                   "repair_ceiling_micro": number(9007199254740991), "extra_calls_limit": number(1000),
                                   "max_repair_rounds": {"const": 1}, "retry_extends_deadline": {"const": False}}),
                    "fulfillable_at": TIME, "deadline_at": TIME, "policy_version": string(80)})
    submission = obj({"schema_version": {"const": "1.0.0"}, "submission_id": ID, "tenant_id": ID, "order_id": ID,
                      "plan_hash": HASH, "stage_run_id": ID, "shot_id": nullable(ID), "attempt": number(2, 1),
                      "intent_key": string(200), "input_hash": HASH,
                      "state": enum("INTENT", "SUBMITTING", "ACKNOWLEDGED", "RUNNING", "SUCCEEDED", "FAILED", "UNKNOWN"),
                      "provider": ID, "model_version_id": ID, "provider_task_id": nullable(string(300)),
                      "receipt_sha256": nullable(HASH), "reservation_id": ID, "reserved_cost_micro": number(9007199254740991),
                      "budget_currency": {"const": "CNY"}, "fencing_token": number(9007199254740991, 1), "created_at": TIME})
    submission["allOf"] = [
        {"if": {"properties": {"state": {"enum": ["ACKNOWLEDGED", "RUNNING", "SUCCEEDED"]}}, "required": ["state"]},
         "then": {"properties": {"receipt_sha256": HASH}}},
        {"if": {"properties": {"state": {"const": "RUNNING"}}, "required": ["state"]},
         "then": {"properties": {"provider_task_id": string(300)}}}]
    submission["description"] = "异步任务记录真实provider_task_id；同步结果可仅有真实回执摘要，不伪造外部任务ID。UNKNOWN不可盲重购。"
    result = {"product-identity-lock": lock, "execution-snapshot": snapshot, "provider-submission": submission}
    for name, schema in result.items():
        schema.update({"$schema": "https://json-schema.org/draft/2020-12/schema", "title": "一品成片 " + name,
                       "description": "内部开发设计合同，不含凭证或可长期访问的私有URL。跨字段/权限/事务另需语义验证。",
                       "x-implementation-status": STATUS})
    return result


def contract_fixtures() -> dict:
    """Reviewable schema examples; all identifiers/providers/amounts are synthetic, never live defaults."""
    import copy
    cases = []

    def add(name: str, schema: str, value: dict, valid: bool = True, semantic: str | None = None) -> None:
        cases.append({"name": name, "schema": schema, "value": value, "expected_valid": valid, "semantic_rule": semantic})

    add("no_product_form", "ProductRequest", {})
    add("reject_mandatory_form_fields", "ProductRequest", {"material": "invented"}, False)
    photos = {"asset_ids": ["fixture_photo_1", "fixture_photo_2", "fixture_photo_3"], "expected_revision": 1}
    add("three_photos", "PhotoBindingRequest", photos)
    add("duplicate_photos", "PhotoBindingRequest", {**photos, "asset_ids": ["fixture_photo_1"] * 3}, False)
    add("six_photos", "PhotoBindingRequest", {**photos, "asset_ids": [f"fixture_photo_{i}" for i in range(6)]}, False)
    upload = {"purpose": "PRODUCT_PHOTO", "product_id": "fixture_product", "file_name": "example.jpg", "mime_type": "image/jpeg", "size_bytes": 1000000}
    add("private_photo_upload", "AssetRequest", upload)
    add("oversized_upload", "AssetRequest", {**upload, "size_bytes": 10000001}, False)
    no_product = {k: v for k, v in upload.items() if k != "product_id"}
    add("photo_without_product", "AssetRequest", no_product, False)
    add("rights_evidence_separate_purpose", "AssetRequest", {**no_product, "purpose": "RIGHTS_EVIDENCE"})
    quote = {"plan_id": "fixture_plan", "plan_hash": "a" * 64}
    add("quote_no_client_price", "QuoteRequest", quote)
    add("reject_client_price", "QuoteRequest", {**quote, "amount_fen": 1234}, False)
    add("reject_client_tenant", "QuoteRequest", {**quote, "tenant_id": "fixture_other_tenant"}, False)
    add("existing_dotted_variant_id", "InputCheckRequest", {"product_id": "fixture_product", "profile_id": "fixture_profile", "variant_id": "portrait-social.ai-presenter-multi", "variant_version": "3.0.0"})
    add("p0_does_not_route_plus_payment", "OrderRequest", {"quote_id": "fixture_quote", "channel": "web"}, False)
    observation = {"feature": "primary_color", "value": "blue", "status": "OBSERVED", "source_asset_ids": ["fixture_photo_1"],
                   "evidence_ids": ["fixture_evidence"], "note": "Synthetic visible color example", "model_reported_confidence": None}
    add("observed_feature_has_provenance", "Observation", observation)
    add("reject_evidence_free_claim", "Observation", {**observation, "evidence_ids": []}, False)
    add("uncertain_hypothesis", "Hypothesis", {"text": "perhaps cloth", "evidence_ids": ["fixture_evidence"], "uncertain": True})
    add("cannot_mark_hypothesis_certain", "Hypothesis", {"text": "perhaps cloth", "evidence_ids": ["fixture_evidence"], "uncertain": False}, False)
    add("private_https_link", "DownloadLink", {"deliverable_id": "fixture_media", "url": "https://media.example.invalid/synthetic", "expires_at": "2026-10-27T00:05:00Z", "ttl_seconds": 300})
    add("reject_long_lived_link", "DownloadLink", {"deliverable_id": "fixture_media", "url": "https://media.example.invalid/synthetic", "expires_at": "2026-10-27T00:05:00Z", "ttl_seconds": 86400}, False)
    add("reject_broken_time", "DownloadLink", {"deliverable_id": "fixture_media", "url": "https://media.example.invalid/synthetic", "expires_at": "yesterday", "ttl_seconds": 300}, False)
    add("reject_invalid_calendar_date", "DownloadLink", {"deliverable_id": "fixture_media", "url": "https://media.example.invalid/synthetic", "expires_at": "2026-02-30T00:05:00Z", "ttl_seconds": 300}, False)
    add("reject_executable_community_field", "PresetConfig", {"name": "example", "description": "example", "style_tags": ["clean"], "parent_preset_version": None,
        "component_versions": ["fixture_component"], "variant_blueprint_ids": ["fixture_blueprint"], "resource_version_ids": [], "fork_allowed": False, "script": "forbidden"}, False)
    add("cover_change_needs_selected_cover", "RevisionRequest", {"manifest_revision": 1, "kind": "COVER"}, False)
    add("delete_product_needs_product_scope", "PrivacyDeletionRequest", {"scope": "PRODUCT", "acknowledge_inflight_contract": True}, False)
    add("availability_does_not_admit_unverified_capability", "AvailabilityRequest", {"expected_revision": 1, "action": "ADMIT", "reason": "fixture", "evidence_set_id": "fixture_evidence_set"}, False)
    add("public_sample_cannot_be_private_projection", "PublicSampleMedia", {"sample_id": "fixture_sample", "label": "PRIVATE_CREATOR_SAMPLE",
        "items": [{"kind": "image", "url": "https://media.example.invalid/synthetic", "expires_at": "2026-10-27T00:05:00Z"}]}, False)
    submission = {"schema_version": "1.0.0", "submission_id": "fixture_submission", "tenant_id": "fixture_tenant", "order_id": "fixture_order",
                  "plan_hash": "a" * 64, "stage_run_id": "fixture_stage", "shot_id": None, "attempt": 1, "intent_key": "fixture_intent",
                  "input_hash": "b" * 64, "state": "INTENT", "provider": "FIXTURE_NOT_A_PROVIDER", "model_version_id": "fixture_model",
                  "provider_task_id": None, "receipt_sha256": None, "reservation_id": "fixture_reservation", "reserved_cost_micro": 1000,
                  "budget_currency": "CNY", "fencing_token": 1, "created_at": "2026-10-27T00:00:00Z"}
    add("persist_intent_before_post", "provider-submission", submission)
    add("unknown_keeps_original_reservation", "provider-submission", {**submission, "state": "UNKNOWN"})
    add("ack_requires_real_receipt", "provider-submission", {**submission, "state": "ACKNOWLEDGED"}, False)
    add("synchronous_result_can_have_receipt_without_task_id", "provider-submission", {**submission, "state": "SUCCEEDED", "receipt_sha256": "c" * 64})
    add("running_requires_real_task_id", "provider-submission", {**submission, "state": "RUNNING", "receipt_sha256": "c" * 64}, False)
    snapshot = {"schema_version": "1.0.0", "order_id": "fixture_order", "tenant_id": "fixture_tenant", "product_id": "fixture_product",
                "photo_version": 1, "photo_set_hash": "a" * 64, "profile_id": "fixture_profile", "profile_hash": "b" * 64,
                "identity_lock_id": "fixture_lock", "identity_lock_hash": "c" * 64, "preset_id": "portrait-social", "preset_version": "3.0.0",
                "variant_id": "portrait-social.ai-presenter-single", "variant_version": "3.0.0", "engine": "PER_SHOT_AI", "plan_hash": "d" * 64,
                "canonicalization": "RFC8785", "model_versions": [{"provider": "FIXTURE_NOT_A_PROVIDER", "actual_model": "FIXTURE_VIDEO_NOT_REAL",
                "registry_version": "fixture_only", "roles": ["VISION_ANALYSIS", "VIDEO"], "capability_hash": "e" * 64, "rate_snapshot_id": "fixture_rate"}],
                "resource_versions": [], "reference_policy": {"max_images": 3, "max_total_pixels": 3000000, "mapping_hash": "f" * 64},
                "audio_policy": {"speech_mode": "NATIVE_ZH", "language": "zh-CN", "native_voice_id": "fixture_voice", "preserve_native_speech": True,
                                 "caption_alignment": "ACTUAL_AUDIO", "music_license_ids": [], "ducking_enabled": True},
                "timeline": {"fps": 30, "target_frames": 450, "shots": [{"shot_id": "fixture_shot", "start_frame": 0, "end_frame": 450,
                              "overlap_frames": 0, "evidence_ids": ["fixture_evidence"], "spoken_text": "这是一份测试文本。"}]},
                "outputs": [{"slot_id": "fixture_video", "kind": "video", "count": 1, "width": 1080, "height": 1920, "fps": 30, "duration_frames": 450, "format": "mp4-h264-yuv420p"},
                            {"slot_id": "fixture_image", "kind": "image", "count": 3, "width": 1080, "height": 1080, "fps": None, "duration_frames": None, "format": "png"},
                            {"slot_id": "fixture_copy", "kind": "copy", "count": 1, "width": None, "height": None, "fps": None, "duration_frames": None, "format": "text"}],
                "pricing": {"currency": "CNY", "amount_fen": 1234, "terms_version": "FIXTURE_NOT_FOR_SALE"},
                "budget": {"currency": "CNY", "ceiling_micro": 1000000, "repair_ceiling_micro": 100000, "extra_calls_limit": 1, "max_repair_rounds": 1, "retry_extends_deadline": False},
                "fulfillable_at": "2026-10-27T00:00:00Z", "deadline_at": "2026-10-27T00:30:00Z", "policy_version": "FIXTURE_ONLY"}
    add("frozen_execution_snapshot", "execution-snapshot", snapshot, semantic="execution_snapshot")
    bad = copy.deepcopy(snapshot)
    bad["audio_policy"]["preserve_native_speech"] = False
    add("cannot_overwrite_native_voice", "execution-snapshot", bad, False, "execution_snapshot")
    bad = copy.deepcopy(snapshot)
    bad["timeline"]["shots"][0]["end_frame"] = 420
    add("timeline_must_match_contract", "execution-snapshot", bad, False, "execution_snapshot")
    bad = copy.deepcopy(snapshot)
    bad["budget"]["repair_ceiling_micro"] = 2000000
    add("repair_cannot_exceed_total_budget", "execution-snapshot", bad, False, "execution_snapshot")
    bad = copy.deepcopy(snapshot)
    bad["deadline_at"] = "2026-10-26T23:59:59Z"
    add("deadline_must_follow_fulfillable_time", "execution-snapshot", bad, False, "execution_snapshot")
    bad = copy.deepcopy(snapshot)
    bad["model_versions"][0]["roles"] = ["VISION_ANALYSIS"]
    add("generative_route_requires_video_model", "execution-snapshot", bad, False, "execution_snapshot")
    return {"status": "SYNTHETIC_CONTRACT_EXAMPLES_ONLY", "note": "全部假数据，只检验设计schema/跨字段规则。不证明API、真实模型/交易/权限已实现。示例金额不是售价。", "cases": cases}


def main() -> int:
    reqs = json.loads((ROOT / "assets/requirements/requirements.v3.json").read_text(encoding="utf-8"))["requirements"]
    design = json.loads((ROOT / "assets/design/柚子创作社/v1.0/requirements-design-map.json").read_text(encoding="utf-8"))
    dmap = {r["requirement"]: r["pages"] for r in design["requirements"]}
    machines = state_machines()
    spec, endpoints = openapi(schemas(machines), dmap)
    management, management_endpoints = management_openapi(spec)
    save("state-machines.json", machines)
    save("data-model.json", data_model())
    work = work_packages(reqs, dmap)
    pages = json.loads((ROOT / "assets/design/柚子创作社/v1.0/page-registry.json").read_text(encoding="utf-8"))["pages"]
    components_by_page = {page["id"]: page["components"] for page in pages}
    for item in work["requirement_mapping"]:
        item["design_components"] = sorted({component for page in item["design_pages"] for component in components_by_page[page]})
    for package in work["packages"]:
        package["design_pages"] = sorted({page for requirement in package["requirements"] for page in dmap[requirement]})
        package["design_components"] = sorted({component for page in package["design_pages"] for component in components_by_page[page]})
    save("work-packages.json", work)
    save("contracts/openapi.json", spec)
    save("contracts/endpoints.json", {"status": STATUS, "endpoints": endpoints})
    save("contracts/management-openapi.json", management)
    save("contracts/management-endpoints.json", {"status": STATUS, "endpoints": management_endpoints})
    for name, schema in internal_contracts().items():
        save(f"contracts/{name}.schema.json", schema)
    save("contracts/contract-fixtures.json", contract_fixtures())
    lines = ["# 自有业务接口目录", "", "拟实现合同；统一前缀`/v1/p01`，全部DESIGN_NOT_IMPLEMENTED。", "",
             "产品Bearer须逐对象授权；public仅允许公开目录/临时码交换；支付回调必须原通道验签/查单。", "",
             "| 方法/路径 | operationId | 请求 → 响应数据 | 需求 |", "| --- | --- | --- | --- |"]
    for e in endpoints:
        lines.append(f"| {e['method']} {e['path']} | {e['operation_id']} | {e['request_schema'] or '无JSON体/通道原报文'} → {e['response_schema'] or '原通道ACK'} | {', '.join(e['requirements'])} |")
    lines.extend(["", "产品schema是受控DTO；支付action为产品适配器接口，获准通道的原生报文/验签/ACK在G0后分别冻结。",
                  "运营审核/停售/补偿/指标使用独立管理域，产品会话无权访问。", "",
                  "## 内部管理域", "", "前缀`/v1/internal/p01`，独立管理身份/逐动作权限/审计；尚未实现。", "",
                  "| 方法/路径 | operationId | 权限 |", "| --- | --- | --- |"])
    for endpoint in management_endpoints:
        lines.append(f"| {endpoint['method']} {endpoint['path']} | {endpoint['operation_id']} | {endpoint['permission']} |")
    lines.append("")
    (OUT / "contracts/endpoint-catalog.md").write_text("\n".join(lines), encoding="utf-8")
    constraint_titles = ["项目内工作及runtime隔离", "禁本地Docker/WSL/虚拟化与间接启动", "浏览器无用标签及时关闭",
                         "不以设计/mock冒充实现", "上游只读与生产许可准入", "C设计留存与tokens一致",
                         "10套14变体三路线均P0", "照片识别免商品表", "租户隔离/作者无买家访问权",
                         "未知模型价格权利禁售", "服务端验付与原单恢复", "持久意图/预算/UNKNOWN不重购",
                         "整包QC原子发布与相册状态分离", "合同截止固定且不隐形加费", "密钥/日志/链接脱敏"]
    baseline = {"baseline_id": "YPCC-DEV-1.0.0", "date": DATE, "status": STATUS, "requirements_version": "3.0",
                "design_baseline": "YPCC-DS-C-1.0.0", "root": "E:/dev/sandbox/支付宝黑客松/一品成片",
                "api_prefix": "/v1/p01", "openapi_version": "3.1.1", "json_schema_draft": "2020-12",
                "recommended_stack": {"mini": "Taro + React + TypeScript; G0 native compatibility pending",
                                      "api": "Node.js 24 LTS + TypeScript + Fastify; exact versions pending",
                                      "workers": "independent native processes + FFmpeg/ffprobe",
                                      "database": "PostgreSQL + durable stage queue + outbox",
                                      "storage": "private object storage, OSS adapter first; account/region pending"},
                "engineering_constraints": [{"id": f"EC-{n:02d}", "title": title} for n, title in enumerate(constraint_titles, 1)],
                "input_policy": {"photo_count_min": 3, "photo_count_max": 5, "file_max_bytes": 10000000,
                                 "total_max_bytes": 50000000, "short_edge_min_pixels": 640,
                                 "decoded_max_pixels": 30000000, "mime_types": ["image/jpeg", "image/png"],
                                 "byte_unit_note": "API以十进制MB定义字节上限，像素/总量另由服务端校验"},
                "business_policies": {"quote_ttl_seconds": 900, "download_link_ttl_seconds": 300,
                                      "delivery_retention_seconds": 604800, "unpaid_input_retention_seconds": 86400,
                                      "paid_input_retention_seconds": 604800, "limited_revision_window_seconds": 172800,
                                      "limited_revision_allowance": 1, "max_repair_rounds": 1,
                                      "repair_extends_deadline": False, "sale_enabled": False,
                                      "price_fen": None, "actual_provider_model": None},
                "counts": {"requirements": 50, "P0": 44, "P1": 4, "P2": 2, "official_presets": 10,
                           "execution_variants": 14, "design_units": 23, "design_components": 22,
                           "state_machines": len(machines["machines"]), "api_operations": len(endpoints),
                           "management_api_operations": len(management_endpoints), "work_packages": 16},
                "product_verification": {"implementation": "NOT_IMPLEMENTED", "real_providers": "NOT_RUN",
                                         "real_payments": "NOT_RUN", "four_device_groups": "NOT_RUN",
                                         "benchmark_420": "NOT_RUN", "cloud_deployment": "NOT_DEPLOYED"},
                "generated_by": "scripts/生成开发契约.py"}
    save("development-baseline.json", baseline)
    vendor = OUT / "contracts/vendor/openapi-3.1-schema.json"
    if vendor.exists():
        save("contracts/vendor/source-record.json", {
            "url": "https://spec.openapis.org/oas/3.1/schema/2026-08-03", "retrieved_date": DATE,
            "local_file": "openapi-3.1-schema.json", "sha256": hashlib.sha256(vendor.read_bytes()).hexdigest(),
            "note": "官方OpenAPI3.1结构schema。另用Draft202012Validator检查业务schema与样例；不证明业务实现。"})
    print(json.dumps({"status": "GENERATED_DESIGN_ONLY", "api_operations": len(endpoints),
                      "management_api_operations": len(management_endpoints),
                      "schemas": len(spec["components"]["schemas"]), "state_machines": len(machines["machines"]),
                      "requirements": len(reqs)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

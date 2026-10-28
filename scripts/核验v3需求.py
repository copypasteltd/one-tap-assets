"""Check cross-document and preset contracts; do not run product acceptance tests."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/requirements"
COMMIT = "1aab133dd75f4db57c3f62e6da2fdd121c5d509b"


def main() -> int:
    errors: list[str] = []

    def check(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    def read_json(relative: str) -> dict:
        return json.loads((ROOT / relative).read_text(encoding="utf-8"))

    source = ROOT / "docs/02-功能需求与用户流程.md"
    test_source = ROOT / "docs/05-验收测试与实施计划.md"
    reqs = re.findall(r"^### (P01-F\d{2}) (.+?)\n(.*?)(?=^### |\Z)", source.read_text(encoding="utf-8"), re.M | re.S)
    cases = re.findall(r"^\| (P01-T\d{2}) \| (P01-F\d{2}) \| (.+?) \|$", test_source.read_text(encoding="utf-8"), re.M)
    expected = {f"P01-F{i:02d}" for i in range(1, 51)}
    check(len(reqs) == 50 and {r[0] for r in reqs} == expected, "功能必须为唯一连续F01—F50")
    check(len(cases) == 50 and {c[1] for c in cases} == expected and len({c[0] for c in cases}) == 50, "50个同号验收用例缺失/重复")
    case_map = {rid: (cid, condition) for cid, rid, condition in cases}
    records = []
    for rid, title, body in reqs:
        priority = re.search(r"优先级：(P[012])。", body)
        acceptance = re.search(r"^验收：(.+)$", body, re.M)
        check(priority is not None and acceptance is not None, f"{rid}缺优先级/验收")
        if priority is None or acceptance is None or rid not in case_map:
            continue
        cid, condition = case_map[rid]
        check(cid == rid.replace("-F", "-T"), f"{rid}用例编号不一致")
        records.append({"id": rid, "title": title, "priority": priority.group(1), "description": body.split("\n\n验收：", 1)[0].strip(), "acceptance": acceptance.group(1), "test_case": cid, "test_specification": condition, "source": "docs/02-功能需求与用户流程.md", "test_source": "docs/05-验收测试与实施计划.md", "implementation_status": "DESIGN_NOT_IMPLEMENTED", "test_execution_status": "NOT_RUN"})
    priorities = dict(Counter(r["priority"] for r in records))
    check(priorities == {"P0": 44, "P1": 4, "P2": 2}, "优先级分布不符44/4/2")
    check(next((r["priority"] for r in records if r["id"] == "P01-F19"), None) == "P0", "F19应为生成式P0")
    primary = sorted((ROOT / "docs").glob("*.md"))
    check(len(primary) == 5, "应保留5份主文档")
    for path in primary:
        check("P01｜v3.0｜2026-10-27" in path.read_text(encoding="utf-8"), f"主文档版本未升v3：{path.name}")

    data = read_json("assets/presets/presets.v3.json")
    baseline = read_json("assets/presets/presets.v2.json")
    blueprint = read_json("assets/blueprints/云端方案映射.v3.json")
    research = read_json("assets/research/one-tap-ads/方案完整目录-1aab133.json")
    baseline_map = {p["preset_id"]: p for p in baseline["presets"]}
    source_ids = {r["id"] for r in research["recipes"]}
    look_ids = {p["id"] for p in research["look_presets"]}
    camera_ids = {p["id"] for p in research["camera_presets"]}
    caption_ids = set(research["caption_presets"])
    check(research["commit"] == COMMIT and len(source_ids) == 391, "来源快照提交/391条ID不符")
    check(data["schema_version"] == "3.0" and data["sale_enabled"] is False, "v3根状态错误")
    check(len(data["presets"]) == 10 and {p["preset_id"] for p in data["presets"]} == set(baseline_map), "官方10套ID被改变")
    variants = []
    for p in data["presets"]:
        pid = p["preset_id"]
        check(p["name"] == baseline_map[pid]["name"] and p["output_slots"] == baseline_map[pid]["output_slots"], f"{pid}名称/原媒体合同被改变")
        check(p["version"] == "3.0.0" and p["sale_enabled"] is False and p["price_fen"] is None, f"{pid}设计状态不正确")
        for v in p["execution_variants"]:
            variants.append(v)
            label = v["variant_id"]
            check(v["output_slots"] == p["output_slots"], f"{label}输出清单不符所属官方合同")
            check(v["sale_enabled"] is False and v["price_fen"] is None and v["provider_model_snapshot"] is None, f"{label}不可冒称已准入/定价")
            check(v["priority"] == "P0" and v["required_for_v3_launch"] is True, f"{label}非首版门槛")
            check(set(v["source_recipe_ids"]) <= source_ids, f"{label}来源ID不存在")
            c = v["creative_components"]
            check(c["look_id"] in look_ids and set(c["source_camera_plan"].values()) <= camera_ids and c["caption_preset"] in caption_ids, f"{label}组件引用不存在")
            video = next(s for s in v["output_slots"] if s["kind"] == "video")
            check(v["timeline_policy"]["target_frames"] == video["duration_seconds"] * video["fps"], f"{label}总帧错误")
            check(v["slo_policy"] == data["engine_policies"][v["engine"]], f"{label}SLO不一致")
            check(v["retry_policy"]["max_repair_rounds"] == 1 and v["retry_policy"]["retry_extends_deadline"] is False, f"{label}修复/截止错误")
            check(v["silent_engine_or_model_fallback_allowed"] is False, f"{label}不得静默换模型/路线")
            if v["engine"] == "PHOTO_LAYOUT":
                segments = v["timeline_policy"]["base_segments"]
                cursor = 0.0
                for segment in segments:
                    check(abs(segment["start_seconds"] - cursor) < 1e-8, f"{label}基础时间轴不连续")
                    cursor = segment["end_seconds"]
                check(abs(cursor - video["duration_seconds"]) < 1e-8, f"{label}基础时间轴时长错误")
            if v["audio_policy"]["speech"] == "native_speech":
                check(v["audio_policy"]["language"] == "zh-CN" and v["audio_policy"]["caption_alignment"] == "actual_audio" and v["audio_policy"]["preserve_native_speech"], f"{label}中文原声策略不符")
    engine_counts = dict(Counter(v["engine"] for v in variants))
    check(len(variants) == 14 and len({v["variant_id"] for v in variants}) == 14, "必须有14唯一变体")
    check(engine_counts == {"PHOTO_LAYOUT": 10, "PER_SHOT_AI": 3, "REFERENCE_FILM": 1}, "三路线/四生成式数量不符")
    check(blueprint["execution_variants"] == variants and blueprint["execution_variant_count"] == 14, "映射副本与主配置不一致")
    check(sum(len(p["execution_variants"]) for p in data["presets"]) * 30 == 420, "最小基准执行数不符")

    repository = ROOT / "runtime/repository-review/one-tap-ads"
    actual_commit = subprocess.check_output(["git", "-C", str(repository), "rev-parse", "HEAD"], text=True).strip()
    dirty = subprocess.check_output(["git", "-C", str(repository), "status", "--porcelain"], text=True).strip()
    check(actual_commit == COMMIT and dirty == "", "上游固定提交应保持只读/干净")
    for relative, digest in research["source_sha256"].items():
        check(hashlib.sha256((repository / relative).read_bytes()).hexdigest() == digest, f"来源文件hash变化：{relative}")

    OUT.mkdir(parents=True, exist_ok=True)
    report_path = OUT / "需求核验-v3.0.json"
    report_path.write_text('{"status":"CHECKING"}\n', encoding="utf-8")
    (OUT / "requirements.v3.json").write_text(json.dumps({"project": "P01", "version": "3.0", "date": "2026-10-27", "status": "DESIGN_NOT_IMPLEMENTED", "requirements": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    matrix = ["# 一品成片：v3.0需求—验收追踪矩阵", "", "50项功能/50主用例，44项P0、4项P1、2项P2。全部为设计/未执行，覆盖完整不等于产品测试通过。", "", "[结构化需求](../../assets/requirements/requirements.v3.json)｜[文档/配置核验](../../assets/requirements/需求核验-v3.0.json)｜[变更记录](需求变更记录-v3.0.md)", "", "| 需求 | 内容 | 优先级 | 主用例 |", "| --- | --- | --- | --- |"]
    for r in records:
        matrix.append(f"| [{r['id']}](../02-功能需求与用户流程.md) | {r['title']} | {r['priority']} | [{r['test_case']}](../05-验收测试与实施计划.md) |")
    (ROOT / "docs/设计/需求追踪矩阵-v3.0.md").write_text("\n".join(matrix) + "\n", encoding="utf-8")
    spec = importlib.util.spec_from_file_location("shared_doc_checks", ROOT.parent / "需求文档/_tools/核验文档.py")
    checker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(checker)
    markdown = sorted((ROOT / "docs").rglob("*.md")) + [ROOT / "README.md", ROOT / "AGENTS.md", ROOT / "assets/research/one-tap-ads/README.md"]
    errors.extend(checker.check_links(markdown))
    for path in markdown:
        t = path.read_text(encoding="utf-8")
        check(t.startswith("# ") or "背景" in path.parts, f"{path.name}缺H1")
        check("\ufffd" not in t, f"{path.name}有Unicode替换字符")
        check(sum(line.startswith("```") for line in t.splitlines()) % 2 == 0, f"{path.name}围栏不成对")
    report = {"checked_at": datetime.now().astimezone().isoformat(), "status": "PASS" if not errors else "FAIL", "scope": "P01 v3需求文档/配置/来源引用一致性，不运行产品验收", "primary_documents": len(primary), "markdown_files": len(markdown), "requirements": len(records), "test_specifications": len(cases), "priorities": priorities, "official_presets": len(data["presets"]), "execution_variants": len(variants), "engines": engine_counts, "minimum_full_pack_benchmark_runs_required_not_executed": 420, "original_preset_names_and_output_slots_preserved": not any("名称/原媒体合同" in e for e in errors), "source_commit": actual_commit, "upstream_worktree_clean": not dirty, "product_tests_executed": False, "model_generation_executed": False, "cloud_deployed": False, "errors": errors}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return bool(errors)


if __name__ == "__main__":
    if "P01｜v3.1｜" in (ROOT / "docs/01-产品需求PRD.md").read_text(encoding="utf-8"):
        # Do not rewrite historical v3.0 requirements/design inputs after the v3.1 migration.
        import runpy
        runpy.run_path(str(ROOT / "scripts/核验Codex方案.py"), run_name="__main__")
    else:
        raise SystemExit(main())

"""Turn the pinned, read-only research export into browsable Markdown and CSV.

This exports upstream creative data for review; it does not approve recipes for sale.
"""
from __future__ import annotations

import csv
import json
import shutil
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "assets/research/one-tap-ads"
REPO = ROOT / "runtime/repository-review/one-tap-ads"
DOC = ROOT / "docs/评估/one-tap-ads全量方案目录-2026-10-27.md"
BASE = "https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/"
MODES = {"product_closeup": "商品特写", "graphic_montage": "图文混剪", "scene_demo": "场景演示", "live_presenter": "人物讲解"}
STYLES = {"pain-point": "痛点种草", "scenario": "场景安利", "comparison": "对比测评", "story": "剧情故事", "drama": "情景短剧", "reversal": "反转", "interview": "采访", "unboxing": "开箱", "product_pov": "原脚本语义为物品拟人，须做适配", "talking_head": "人设口播"}
CATEGORIES = {"beauty": "美妆护肤", "food": "食品零食", "home": "家居日用", "fashion": "服饰鞋包", "digital": "数码3C"}
ROLES = {"hook": "开头钩子", "pain_point": "痛点", "product_reveal": "商品亮相", "demo": "展示/演示", "social_proof": "背书", "cta": "收尾引导"}


def main() -> None:
    data = json.loads((DATA / "方案完整目录-1aab133.json").read_text(encoding="utf-8"))
    video_evidence = json.loads((DATA / "演示视频证据-2026-10-27.json").read_text(encoding="utf-8"))
    assert video_evidence["commit"] == data["commit"]
    showcase = next(s for s in video_evidence["samples"] if s["id"] == "tissue-showcase")
    showcase_video = next(s for s in showcase["streams"] if s["codec_type"] == "video")
    recipes = data["recipes"]
    assert len(recipes) == 391 and len({r["id"] for r in recipes}) == 391
    assert not [r["id"] for r in recipes if r["resolved"]["look"] is None]
    assert not [r["id"] for r in recipes if any(v is None for v in r["resolved"]["cameras"].values())]
    lines = [
        "# one-tap-ads：391条方案完整目录",
        "",
        "2026-10-27｜固定提交1aab133｜上游ClipForge方案的只读研究导出。原作者xixihhhh，AGPL-3.0-only，保留来源与许可证；本目录不是一品成片已上线/已验收的方案库。",
        "",
        "每条保留原名、文案意图、形态、脚本风格、全部运镜、Look和合成配置。镜头指令与Look是生成提示，不能视为已验证效果；AdTemplate本身不固定总时长、模型和图片/视频交付数量。",
        "",
        "[案例深析](方案案例与生成流程深析-2026-10-27.md)｜[云端封装方案](../实施/方案驱动的云端服务与小程序封装-2026-10-27.md)｜[完整JSON](../../assets/research/one-tap-ads/方案完整目录-1aab133.json)｜[筛选用CSV](../../assets/research/one-tap-ads/方案筛选目录-1aab133.csv)｜[LICENSE](../../assets/research/one-tap-ads/LICENSE.upstream.txt)｜[NOTICE](../../assets/research/one-tap-ads/NOTICE.upstream.txt)",
        "",
        "## 分组数量",
        "",
        "| 分组 | 数量 |",
        "| --- | --- |",
    ]
    for group in data["groups"]:
        lines.append(f"| {group['name']['zh']} | {data['summary']['groups'][group['id']]} |")
    for group in data["groups"]:
        lines.extend(["", f"## {group['name']['zh']}", ""])
        for t in recipes:
            if t["group"] != group["id"]:
                continue
            look = t["resolved"]["look"]
            cameras = "；".join(f"{ROLES.get(role, role)}：{preset['name']['zh']}（{preset['id']}）" for role, preset in t["resolved"]["cameras"].items())
            categories = "、".join(CATEGORIES.get(v, v) for v in t.get("goodFor", [])) or "未限定类目（不代表所有商品已验证）"
            lines.extend([
                f"### {t['name']['zh']} · {t['id']}", "",
                t["tagline"]["zh"], "",
                f"- 适配标签：{categories}。画面形态：{MODES[t['videoMode']]}。脚本：{STYLES[t['styleType']]}。",
                f"- 运镜编排：{cameras}。",
                f"- 画面Look：{look['name']['zh']}（{look['id']}）；生图指令：{look['image']['zh']}；视频光线锚点：{look['motion']['zh']}。",
                f"- 原始合成配置：`{json.dumps(t['compose'], ensure_ascii=False, separators=(',', ':'))}`；未指定字段依原应用设置，云端需另行冻结默认值。",
                f"- 创意要求：{t['scriptHint']['zh']}。",
                f"- [固定提交源码]({BASE}src/lib/ad-templates.ts#L{t['source_line']})。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。", "",
            ])
    DOC.parent.mkdir(parents=True, exist_ok=True)
    DOC.write_text("\n".join(lines) + "\n", encoding="utf-8")
    csv_path = DATA / "方案筛选目录-1aab133.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["方案ID", "方案名", "分组", "适配类目", "形态", "脚本风格", "Look", "运镜", "合成配置", "创意要求", "原始源码", "验证状态"])
        for t in recipes:
            writer.writerow([
                t["id"], t["name"]["zh"], t["resolved"]["group"]["zh"], "/".join(t.get("goodFor", [])), MODES[t["videoMode"]], t["styleType"], t["resolved"]["look"]["name"]["zh"],
                "；".join(f"{ROLES.get(k,k)}:{v['name']['zh']}" for k, v in t["resolved"]["cameras"].items()),
                json.dumps(t["compose"], ensure_ascii=False, separators=(",", ":")), t["scriptHint"]["zh"], f"{BASE}src/lib/ad-templates.ts#L{t['source_line']}", "配置已提取；成片逐条待验证",
            ])
    for name in ("LICENSE", "NOTICE"):
        shutil.copyfile(REPO / name, DATA / f"{name}.upstream.txt")
    script_checks = [{"id": t["id"], "declared_seconds": t["totalDuration"], "shot_sum_seconds": sum(s["duration"] for s in t["shots"])} for t in data["examples"]["scripts"]]
    audit = {
        "commit": data["commit"],
        "recipes": len(recipes),
        "all_ids_unique": True,
        "all_referenced_cameras_and_looks_exist": True,
        "groups": dict(Counter(t["group"] for t in recipes)),
        "ad_recipe_missing_explicit_total_duration": sum("totalDuration" not in t and "duration" not in t for t in recipes),
        "ad_recipe_missing_explicit_quality": sum("quality" not in t["compose"] for t in recipes),
        "unique_settings_canonical_keys_without_hint": data["summary"]["unique_execution_settings_without_script_hint"],
        "unique_settings_canonical_keys_with_hint": data["summary"]["unique_with_script_hint"],
        "reference_example_duration_checks": script_checks,
        "showcase_declared_resolution": data["examples"]["showcase"]["resolution"],
        "showcase_actual_video_dimensions": [showcase_video["width"], showcase_video["height"]],
        "showcase_actual_audio_stream_present": any(s["codec_type"] == "audio" for s in showcase["streams"]),
        "showcase_source_sha256": showcase["sha256"],
        "visual_observation": {
            "source": "local input-coffee.jpg, grid-coffee.jpg and demo-coffee-film.mp4; contact sheets visually inspected",
            "coffee_input_package": "single bottle",
            "coffee_output_package": "small portion cup/capsule and gift box",
            "package_form_changed": True,
            "limits": "人工对照画面观察，未做新模型复现/ASR/音画同步定量验证；未证明演示与某个AdTemplate ID一一对应",
        },
        "product_acceptance_tests_executed": False,
    }
    (DATA / "方案内容审计-2026-10-27.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"recipes": len(recipes), "markdown": str(DOC), "csv": str(csv_path), "duration_checks": script_checks}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

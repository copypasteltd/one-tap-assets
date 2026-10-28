"""Package and verify the user-selected C design baseline. Native file operations only."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import zipfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSET = ROOT / "assets/design/柚子创作社/v1.0"
DOC = ROOT / "docs/设计/定型/C-柚子创作社-v1.0"
SOURCE = ROOT / "output/imagegen/2026-10-27-设计选型"
ARCHIVE = ASSET.parent / "archives/一品成片-C-设计定型-v1.0-20261027.zip"
BOARD_HASH = "b919b0de25c4bbab45bafa033f2990a2a40511d5010935815e2c4391a58e4a41"
BASELINE = "YPCC-DS-C-1.0.0"
PAGE_NAMES = ["拍照制作", "方案社区", "素材领取"]


def digest_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def digest(path: Path) -> str:
    return digest_bytes(path.read_bytes())


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def preserve_copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        if digest(source) != digest(target):
            raise ValueError(f"Refusing to overwrite a different retained source: {rel(target)}")
        return
    shutil.copy2(source, target)


def relative_luminance(color: str) -> float:
    values = [int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in values]
    return sum(value * weight for value, weight in zip(linear, (0.2126, 0.7152, 0.0722), strict=True))


def contrast(foreground: str, background: str) -> float:
    low, high = sorted((relative_luminance(foreground), relative_luminance(background)))
    return (high + 0.05) / (low + 0.05)


def create_contrast_report(tokens: dict) -> dict:
    pairs = [
        ("primary_button", "action.primary.foreground", "action.primary.background"),
        ("pressed_button", "action.primary.foreground", "action.primary.pressed"),
        ("secondary_button", "action.secondary.foreground", "action.secondary.background"),
        ("disabled_button_reason", "action.disabled.foreground", "action.disabled.background"),
        ("page_body", "text.primary", "surface.page"),
        ("card_body", "text.primary", "surface.card"),
        ("page_secondary", "text.secondary", "surface.page"),
        ("card_secondary", "text.secondary", "surface.card"),
        ("page_link", "text.link", "surface.page"),
        ("card_link", "text.link", "surface.card"),
        ("selected_body", "text.primary", "surface.selected"),
        ("ai_badge", "text.primary", "brand.yellow"),
        ("error", "feedback.error.foreground", "feedback.error.background"),
        ("success", "feedback.success.foreground", "feedback.success.background"),
        ("warning", "feedback.warning.foreground", "feedback.warning.background"),
    ]
    values = tokens["colors"]
    results = []
    for name, foreground, background in pairs:
        value = contrast(values[foreground], values[background])
        results.append({"name": name, "foreground": values[foreground], "background": values[background], "contrast": round(value, 5), "minimum": 4.5, "passed": value >= 4.5})
    return {
        "baseline_id": BASELINE, "method": "sRGB_relative_luminance_pure_solid_colors",
        "status": "PASS" if all(row["passed"] for row in results) else "FAIL",
        "pairs": results,
        "source_board_correction": {"foreground": "#FFFFFF", "background": "#FF7948", "contrast": round(contrast("#FFFFFF", "#FF7948"), 5), "accepted_for_normal_text": False, "action": "retain_original_board_use_ink_text_in_implementation"},
        "limit": "Pure-color arithmetic only; real rendering, images, accessibility and devices remain untested.",
    }


def build_trace(pages: dict) -> dict:
    requirements = read_json(ROOT / "assets/requirements/requirements.v3.json")["requirements"]
    future = {f"P01-F{item['requirement']:02d}": item for item in pages["future_extensions"]}
    internal = {f"P01-F{item['requirement']:02d}": item for item in pages["internal_surfaces_not_designed"]}
    cross = {f"P01-F{item['requirement']:02d}": item for item in pages["cross_cutting_requirements"]}
    records = []
    for requirement in requirements:
        number = int(requirement["id"].split("F")[1])
        linked = [page["id"] for page in pages["pages"] if number in page["requirements"]]
        mode = "FUTURE_EXTENSION_NOT_DESIGNED" if requirement["id"] in future else "CROSS_CUTTING_DESIGN_RULE" if requirement["id"] in cross else "PAGE_SPECIFIED_BACKEND_CONTRACT_REQUIRED"
        if not linked and mode == "PAGE_SPECIFIED_BACKEND_CONTRACT_REQUIRED":
            raise ValueError(f"Missing design responsibility: {requirement['id']}")
        records.append({
            "requirement": requirement["id"], "title": requirement["title"], "priority": requirement["priority"],
            "pages": linked, "design_responsibility": mode,
            "future_context": future.get(requirement["id"]),
            "internal_surface_not_designed": internal.get(requirement["id"]),
            "cross_cutting_scope": cross.get(requirement["id"]),
            "implementation_status": "NOT_IMPLEMENTED", "acceptance_execution_status": "NOT_RUN",
        })
    return {"baseline_id": BASELINE, "requirements_version": "3.0", "requirement_count": len(records), "note": "Design responsibility mapping, not proof of backend or product acceptance.", "requirements": records}


def generate_css(tokens: dict) -> str:
    lines = ["/* Design handoff reference. Not an implemented mini-program component library. */", ":root {"]
    for name, value in tokens["colors"].items():
        lines.append(f"  --yp-{name.replace('.', '-')}: {value};")
    for name, value in tokens["radii"].items():
        lines.append(f"  --yp-radius-{name}: {value}px;")
    for name, value in tokens["typography"].items():
        lines.append(f"  --yp-font-{name.replace('_', '-')}: {value['size']}px;")
        lines.append(f"  --yp-line-{name.replace('_', '-')}: {value['line_height']}px;")
    lines.extend(["  --yp-page-padding: 16px;", "  --yp-touch-min: 44px;", "  --yp-primary-height-min: 52px;", "}", ""])
    return "\n".join(lines)


def create_baseline() -> None:
    manifest_path = ASSET / "baseline-manifest.json"
    if manifest_path.exists():
        raise SystemExit("已存在C v1.0基线，不覆盖；核验使用--verify，新修订请另建版本。")
    current = read_json(ROOT / "assets/design/current.json")
    if current["direction_id"] != "C" or current["baseline_id"] != BASELINE:
        raise ValueError("Current selection does not match user-selected C baseline")
    source_board = SOURCE / "C-柚子创作社.png"
    if digest(source_board) != BOARD_HASH:
        raise ValueError("Original C board digest changed")
    reference = ASSET / "reference"
    preserve_copy(source_board, reference / "C-柚子创作社-原始设计稿.png")
    for name in PAGE_NAMES:
        preserve_copy(SOURCE / f"pages/C-{name}.png", reference / f"C-{name}.png")
    preserve_copy(SOURCE / "prompts/C-柚子创作社.txt", reference / "C-原始提示词.txt")
    selected = next(item for item in read_json(SOURCE / "designs.json")["designs"] if item["id"] == "C")
    write_json(reference / "source-record.json", {
        "baseline_id": BASELINE, "product_name": "一品成片", "direction_id": "C", "direction_name": "柚子创作社",
        "user_decision": current["user_decision"], "decision_date": current["decision_date"],
        "generator_skill": "sub2-image-gen", "model": selected["model"], "quality": selected["quality"],
        "requested_size": selected["requested_size"], "actual_size": selected["actual_size"],
        "original_source": rel(source_board), "retained_original": rel(reference / "C-柚子创作社-原始设计稿.png"),
        "original_sha256": BOARD_HASH, "prompt_sha256": digest(reference / "C-原始提示词.txt"),
        "page_previews": {name: "C-" + name + ".png" for name in PAGE_NAMES},
        "provenance_note": "Retained image and crops; no new model call in this baseline task. No gateway credentials stored.",
        "limitations": ["Generated concept, not implemented UI", "Fictional example product", "Typography/button contrast and video ratio corrected by specifications, original bytes unchanged"],
    })
    tokens = read_json(ASSET / "design-tokens.json")
    pages = read_json(ASSET / "page-registry.json")
    write_json(ASSET / "requirements-design-map.json", build_trace(pages))
    write_json(ASSET / "contrast-report.json", create_contrast_report(tokens))
    (ASSET / "design-tokens.css").write_text(generate_css(tokens), encoding="utf-8")
    (reference / "index.html").write_text(REFERENCE_GALLERY, encoding="utf-8")
    frozen = sorted([*DOC.glob("*.md"), *[path for path in ASSET.rglob("*") if path.is_file() and path.name not in {"baseline-manifest.json", "verification-report.json"}], ROOT / "assets/design/current.json", Path(__file__).resolve()], key=lambda path: rel(path))
    files = [{"path": rel(path), "bytes": path.stat().st_size, "sha256": digest(path)} for path in frozen]
    write_json(manifest_path, {
        "baseline_id": BASELINE, "version": "1.0.0", "requirements_version": "3.0",
        "status": "DIRECTION_CONFIRMED_SPEC_BASELINED", "user_decision": current["user_decision"],
        "frozen_at": datetime.now(timezone.utc).isoformat(), "original_board_sha256": BOARD_HASH,
        "high_fidelity_reference_pages": ["D01", "D04", "D11"], "page_spec_count": 23, "component_spec_count": 22,
        "archive": rel(ARCHIVE), "manifest_excludes": ["baseline-manifest.json itself", "verification-report.json derived result", "archive and its digest sidecar"],
        "implementation_status": "NOT_IMPLEMENTED", "device_validation_status": "NOT_RUN", "files": files,
    })
    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in [*frozen, manifest_path]:
            archive.write(path, rel(path))
    ARCHIVE.with_suffix(".zip.sha256").write_text(digest(ARCHIVE) + "  " + ARCHIVE.name + "\n", encoding="utf-8")


class LocalReferences(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in {"href", "src"} and value:
                self.links.append(value)


def verify_baseline() -> dict:
    errors = []
    checks = []

    def check(condition: bool, message: str) -> None:
        checks.append({"name": message, "passed": bool(condition)})
        if not condition:
            errors.append(message)

    current = read_json(ROOT / "assets/design/current.json")
    manifest = read_json(ASSET / "baseline-manifest.json")
    tokens = read_json(ASSET / "design-tokens.json")
    pages = read_json(ASSET / "page-registry.json")
    components = read_json(ASSET / "component-registry.json")
    trace = read_json(ASSET / "requirements-design-map.json")
    check(current["direction_id"] == "C" and current["baseline_id"] == manifest["baseline_id"] == BASELINE, "Current selection and baseline identity")
    for file in manifest["files"]:
        path = ROOT / file["path"]
        check(path.is_file() and path.stat().st_size == file["bytes"] and digest(path) == file["sha256"], "Frozen bytes: " + file["path"])
    reference = ASSET / "reference"
    board = reference / "C-柚子创作社-原始设计稿.png"
    check(digest(board) == digest(SOURCE / "C-柚子创作社.png") == BOARD_HASH, "Original selected image retained byte-for-byte")
    for name in PAGE_NAMES:
        check(digest(reference / f"C-{name}.png") == digest(SOURCE / f"pages/C-{name}.png"), "Original page crop retained: " + name)
    check(digest(reference / "C-原始提示词.txt") == digest(SOURCE / "prompts/C-柚子创作社.txt"), "Original prompt retained")
    for path in reference.glob("*.png"):
        with Image.open(path) as picture:
            picture.load()
            check(picture.format == "PNG" and min(picture.size) > 300, "PNG decode and dimensions: " + path.name)
            if path == board:
                check(picture.size == (1536, 1024), "Original board size is 1536x1024")
    check(len(list(DOC.glob("*.md"))) == 9, "Nine design documents including entry point")
    page_ids = {page["id"] for page in pages["pages"]}
    component_ids = {component["id"] for component in components["components"]}
    check(page_ids == {f"D{index:02d}" for index in range(1, 24)} and len(pages["pages"]) == 23, "23 unique page/interaction units")
    check(component_ids == {f"K{index:02d}" for index in range(1, 23)} and len(components["components"]) == 22, "22 unique components")
    for page in pages["pages"]:
        check(set(page["components"]) <= component_ids and set(page["next"]) <= page_ids and bool(page["states"]), "Page references and states: " + page["id"])
        if page["reference"]:
            check((ASSET / page["reference"]).is_file(), "Page reference file: " + page["id"])
    check([page["id"] for page in pages["pages"] if page["reference"]] == ["D01", "D04", "D11"], "Only three pages claim high-fidelity references")
    check([tab["page"] for tab in tokens["navigation"]["tabs"]] == ["D01", "D04", "D10"], "Three root navigation destinations")
    check(trace == build_trace(pages) and trace["requirement_count"] == 50, "50 requirements mapped to design responsibilities")
    future = {f"P01-F{item['requirement']:02d}" for item in pages["future_extensions"]}
    check(future == {row["requirement"] for row in trace["requirements"] if row["priority"] != "P0"}, "P1/P2 stay future design scope")
    contrast_report = create_contrast_report(tokens)
    check(contrast_report == read_json(ASSET / "contrast-report.json") and contrast_report["status"] == "PASS", "All 15 production solid-color text pairs reach 4.5")
    check(tokens["controls"]["touch_min"] >= 44 and tokens["controls"]["primary_height_min"] >= 52 and min(style["size"] for style in tokens["typography"].values()) >= 12, "Touch, button and typography size floors")

    report_path = ASSET / "verification-report.json"
    if not report_path.exists():
        write_json(report_path, {"status": "RUNNING"})
    link_count = 0
    documents = [*DOC.glob("*.md"), ASSET / "README.md", ROOT / "README.md", ROOT / "docs/设计/五种视觉方向选型-2026-10-27.md", ROOT / "docs/01-产品需求PRD.md", ROOT / "docs/设计/小程序优先与预设素材包-2026-10-27.md"]
    for document in documents:
        for target in re.findall(r"\]\(([^)]+)\)", document.read_text(encoding="utf-8")):
            if "://" in target or target.startswith("#"):
                continue
            link_count += 1
            path = (document.parent / unquote(target.split("#")[0])).resolve()
            check(path.exists(), "Document link: " + rel(document) + " -> " + target)
    galleries = [reference / "index.html", SOURCE / "index.html"]
    node = shutil.which("node")
    check(bool(node), "Native Node.js available for gallery syntax check")
    for gallery in galleries:
        source = gallery.read_text(encoding="utf-8")
        parser = LocalReferences()
        parser.feed(source)
        for target in parser.links:
            if "://" in target or target.startswith(("#", "data:")):
                continue
            check((gallery.parent / unquote(target)).is_file(), "Gallery local asset: " + target)
        for script in re.findall(r"<script>([\s\S]*?)</script>", source):
            if node:
                result = subprocess.run([node, "--check"], input=script, text=True, encoding="utf-8", capture_output=True)
                check(result.returncode == 0, "Gallery JavaScript syntax: " + rel(gallery))
        check("__SELECTED_ID__" not in source and "__DESIGNS_JSON__" not in source, "Gallery template resolved: " + rel(gallery))
    old = read_json(SOURCE / "designs.json")
    check(old.get("selection", {}).get("direction_id") == "C" and old["status"] == "DIRECTION_SELECTED_CURRENT_BASELINE_C", "Historical comparison honors user selection C")
    check("const selectedId='C'" in (SOURCE / "index.html").read_text(encoding="utf-8"), "Historical gallery defaults to C")

    archive_hash = digest(ARCHIVE)
    check(ARCHIVE.with_suffix(".zip.sha256").read_text(encoding="utf-8").split()[0] == archive_hash, "Archive SHA-256 matches sidecar")
    with zipfile.ZipFile(ARCHIVE) as archive:
        expected = {file["path"] for file in manifest["files"]} | {rel(ASSET / "baseline-manifest.json")}
        check(set(archive.namelist()) == expected and len(archive.namelist()) == len(expected), "Archive contains exact baseline file set")
        for file in manifest["files"]:
            check(digest_bytes(archive.read(file["path"])) == file["sha256"], "Archive content: " + file["path"])
        check(archive.read(rel(ASSET / "baseline-manifest.json")) == (ASSET / "baseline-manifest.json").read_bytes(), "Archive manifest matches retained manifest")
    report = {
        "baseline_id": BASELINE, "checked_at": datetime.now(timezone.utc).isoformat(),
        "status": "PASS" if not errors else "FAIL", "check_count": len(checks),
        "design_document_count": 9, "page_spec_count": 23, "component_spec_count": 22,
        "requirement_count": 50, "high_fidelity_reference_count": 3, "retained_png_count": 4,
        "document_links_checked": link_count, "contrast_pairs_checked": 15,
        "archive": {"path": rel(ARCHIVE), "bytes": ARCHIVE.stat().st_size, "sha256": archive_hash, "entries": len(manifest["files"]) + 1},
        "not_executed": ["Mini-program implementation", "Real device rendering, native permissions, payment and album", "User research and screen reader validation", "Backend/model/provider/product acceptance"],
        "browser_used": False, "virtualization_used": False, "errors": errors, "checks": checks,
    }
    write_json(report_path, report)
    if errors:
        raise ValueError("Baseline verification failed: " + "; ".join(errors))
    print(json.dumps({key: report[key] for key in ["baseline_id", "status", "check_count", "page_spec_count", "component_spec_count", "requirement_count", "high_fidelity_reference_count", "archive"]}, ensure_ascii=False))
    return report


REFERENCE_GALLERY = r'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>一品成片 · C设计基线 v1.0</title>
<style>
:root{color-scheme:light;--orange:#ff7948;--cream:#fffaee;--ink:#263b32;--mint:#cfe9d6;--yellow:#ffd766;--link:#c04420;--line:#d8e0d8}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.6 "Microsoft YaHei","PingFang SC",sans-serif}a{color:var(--link);text-underline-offset:4px}a:focus-visible,button:focus-visible{outline:3px solid var(--ink);outline-offset:4px}header,main,footer{max-width:1536px;margin:auto;padding:28px 32px}header{display:flex;gap:24px;justify-content:space-between;align-items:end}.eyebrow{font-size:12px;font-weight:700;letter-spacing:.1em}h1{font-size:clamp(28px,4vw,44px);line-height:1.2;margin:10px 0 14px;font-weight:800}h1 span{box-shadow:inset 0 -8px var(--yellow)}p{margin:0 0 12px}.description{color:#5a6a61;max-width:800px}.status{display:inline-block;padding:7px 12px;border-radius:9px;background:var(--mint);font-weight:700;font-size:13px;white-space:nowrap}.links{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;margin-top:12px}main{padding-top:0}.toolbar{display:flex;justify-content:space-between;gap:18px;align-items:center;margin:8px 0 16px}.views{display:flex;gap:7px;flex-wrap:wrap}.views button{font:inherit;font-size:14px;background:white;border:1px solid var(--line);color:var(--ink);border-radius:999px;min-height:44px;padding:9px 18px;cursor:pointer}.views button[aria-pressed=true]{background:var(--orange);border-color:var(--link);font-weight:700}.original-link{font-size:14px;white-space:nowrap}figure{margin:0;background:white;border:1px solid var(--line);border-radius:16px;overflow:hidden}figure img{display:block;width:100%;height:auto;margin:auto}figure.single{padding:20px}figure.single img{width:auto;max-width:100%;max-height:950px}figcaption{font-size:13px;color:#5a6a61;margin:10px 0 24px}.info{display:grid;grid-template-columns:1fr 1fr;gap:20px}.box{padding:24px;background:white;border:1px solid var(--line);border-radius:16px}h2{font-size:20px;line-height:1.4;margin:0 0 14px}.colors{display:flex;gap:12px;flex-wrap:wrap}.color{font-size:12px}.color i{display:block;width:56px;height:46px;border-radius:10px;border:1px solid #263b3220;margin-bottom:6px}.box li{margin:8px 0}.box ul{padding-left:20px;margin:0}footer{font-size:13px;color:#5a6a61;padding-top:8px}footer p{max-width:1100px}@media(max-width:750px){header{display:block}header,main,footer{padding-left:16px;padding-right:16px}.status{margin-top:10px}.toolbar{align-items:start;flex-direction:column;gap:12px}.views{gap:5px}.views button{padding:8px 12px}.info{grid-template-columns:1fr}.box{padding:18px}figure.single{padding:10px}}@media print{.toolbar{display:none}header,main,footer{padding:10px}.info{display:block}.box{margin-top:12px}}
</style></head><body>
<header><div><div class="eyebrow">一品成片 / C 已选定 / DESIGN BASELINE 1.0.0</div><h1><span>柚子创作社</span></h1><p class="description">果橙、奶白、深绿墨。商品照片像一套可以取走的创作印样，社区方案有清楚的作者与来源。</p><nav class="links" aria-label="设计交付"><a href="../../../../../docs/设计/定型/C-柚子创作社-v1.0/README.md">设计定型文档</a><a href="../design-tokens.json">设计tokens</a><a href="../baseline-manifest.json">留存清单</a><a href="../../archives/一品成片-C-设计定型-v1.0-20261027.zip">下载归档包</a></nav></div><span class="status">用户已确认视觉方向 · 2026.10.27</span></header>
<main><div class="toolbar"><div class="views" aria-label="查看原始稿与单页参照"><button data-page="0" aria-pressed="true">三页原稿</button><button data-page="1" aria-pressed="false">拍照制作</button><button data-page="2" aria-pressed="false">方案社区</button><button data-page="3" aria-pressed="false">素材领取</button></div><a id="original" class="original-link" href="C-柚子创作社-原始设计稿.png" target="_blank" rel="noopener">打开原尺寸图片 ↗</a></div><figure id="stage"><img id="preview" src="C-柚子创作社-原始设计稿.png" width="1536" height="1024" alt="C柚子创作社：拍照制作、方案社区、素材领取原始设计稿"></figure><figcaption id="caption">保留原始生成图字节；三张单页为原画裁图。原稿表达视觉方向，精确实现以定型规范为准。</figcaption>
<div class="info"><section class="box"><h2>定型色板</h2><div class="colors"><div class="color"><i style="background:#ff7948"></i>果橙<br>#FF7948</div><div class="color"><i style="background:#fffaee"></i>奶白<br>#FFFAEE</div><div class="color"><i style="background:#263b32"></i>深绿墨<br>#263B32</div><div class="color"><i style="background:#cfe9d6"></i>浅薄荷<br>#CFE9D6</div><div class="color"><i style="background:#ffd766"></i>柚黄<br>#FFD766</div></div></section><section class="box"><h2>实现时按规范修正</h2><ul><li>保留果橙主按钮，文字与图标改深绿墨，数学对比度约4.61。</li><li>视频完整预览遵循真实9:16，数量、时长和费用取当前合同。</li><li>照片印样仅用于有限品牌区域；确认付款、权限、退款和错误保持清晰。</li><li>已有3页高保真参照；23交互单元、22类组件已有规格，尚未实现。</li></ul></section></div></main>
<footer><p>产品名称仍为一品成片。原稿由用户指定的Sub2技能生成，模型gpt-image-2.5；本次定型仅留存并建立规范。蓝色榨汁杯为虚构示例；此画册用于设计参照，不是运行中的小程序。</p><a href="source-record.json">查看来源记录</a> · <a href="../verification-report.json">查看核验结果</a></footer>
<script>
const pages=[['C-柚子创作社-原始设计稿.png','三页原稿'],['C-拍照制作.png','拍照制作'],['C-方案社区.png','方案社区'],['C-素材领取.png','素材领取']];const preview=document.getElementById('preview');const buttons=Array.from(document.querySelectorAll('[data-page]'));buttons.forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.page);preview.src=pages[index][0];preview.alt='C柚子创作社 · '+pages[index][1]+' · 已选设计参照';preview.removeAttribute('width');preview.removeAttribute('height');document.getElementById('stage').classList.toggle('single',index>0);document.getElementById('original').href=pages[index][0];buttons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));document.getElementById('caption').textContent=index===0?'保留原始生成图字节；三张单页为原画裁图。原稿表达视觉方向，精确实现以定型规范为准。':'单页裁图：'+pages[index][1]+'。用于查阅布局与视觉；正式交互与状态按定型规范实现。'}));
</script></body></html>'''


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true", help="Verify retained files without repackaging or model calls")
    args = parser.parse_args()
    if not args.verify:
        create_baseline()
    verify_baseline()

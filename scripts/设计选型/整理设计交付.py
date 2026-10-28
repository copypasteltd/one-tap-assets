"""核验生成图片，输出本地选型画册及独立页面预览；不调用模型。"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output/imagegen/2026-10-27-设计选型"
MANIFEST = OUT / "designs.json"
PAGE_NAMES = ["拍照制作", "方案社区", "素材领取"]
CROPS = {
    "A": [(75, 96, 500, 1005), (548, 95, 983, 1004), (1032, 95, 1467, 1005)],
    "B": [(103, 79, 506, 996), (586, 79, 986, 997), (1069, 80, 1470, 997)],
    "C": [(84, 75, 514, 1002), (552, 75, 978, 1003), (1024, 75, 1451, 1002)],
    "D": [(65, 130, 515, 1014), (543, 131, 994, 1014), (1021, 130, 1473, 1015)],
    "E": [(74, 113, 516, 998), (548, 113, 992, 998), (1023, 113, 1467, 998)],
}
REVIEWS = {
    "A": {
        "observation": "照片输入、方案双列卡、保存动作层级清晰，晴蓝主操作贯穿三页。",
        "implementation_notes": ["完成页的视频封面容器应按真实 9:16 素材适配或提供明确的完整预览入口。"],
    },
    "B": {
        "observation": "胶片照片带和宽幅方案剧照形成独立视觉语言，红色行动入口清楚，与成片定位贴合。",
        "implementation_notes": ["视频封面按真实比例实现；片场装饰不转化为手动剪辑要求。", "手写字只保留在作品封面，操作文字统一使用清晰的系统字体。"],
    },
    "C": {
        "observation": "橙色动作、照片印样和社区作者行有亲和感，方案卡包含产出缩略图。",
        "implementation_notes": ["纸张、印章和叠卡只用于有限的品牌区域，控制页面装饰密度。", "视频封面按真实素材比例适配。"],
    },
    "D": {
        "observation": "大幅商品摄影和克制的灰绿色突出商品质感，宋体短标题与其余方案形成区别。",
        "implementation_notes": ["大卡降低同屏方案数量，需完善筛选和连续浏览。", "实现时补齐社区卡的作者、产出数量等元数据；视频预览按真实比例适配。"],
    },
    "E": {
        "observation": "深紫媒体画布和分层片页具有辨识度，浅紫按钮与商品图形成明显对比。",
        "implementation_notes": ["首页的底部导航选中状态需校正为拍照制作；其余页面按真实路由计算。", "顶部一张商品图的概念文案应统一为拍摄 3–5 张商品照。", "视频封面按真实比例适配，并验证日光下文字对比。"],
    },
}


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_deliverables() -> None:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    selection_path = ROOT / "assets/design/current.json"
    selection = json.loads(selection_path.read_text(encoding="utf-8")) if selection_path.exists() else None
    selected_id = selection["direction_id"] if selection else "B"
    previews = OUT / "pages"
    previews.mkdir(exist_ok=True)
    gallery_designs = []
    for design in data["designs"]:
        path = ROOT / design["image_file"]
        with Image.open(path) as source:
            source.load()
            if source.format != "PNG" or source.size != (1536, 1024):
                raise ValueError(f"Unexpected image format/size: {path.name}: {source.format} {source.size}")
            design["actual_size"] = list(source.size)
            design["format"] = source.format
            page_files = []
            for title, box in zip(PAGE_NAMES, CROPS[design["id"]], strict=True):
                page = previews / f"{design['id']}-{title}.png"
                source.crop(box).save(page)
                page_files.append(page.relative_to(OUT).as_posix())
        design["bytes"] = path.stat().st_size
        design["sha256"] = file_hash(path)
        design["status"] = "GENERATED_VISUALLY_REVIEWED_CONCEPT"
        design["selected_by_user"] = bool(selection and design["id"] == selected_id)
        design["review"] = REVIEWS[design["id"]]
        design["page_previews"] = page_files
        if design["id"] == "A":
            design["strength"] = "较利于首用理解与双小程序一致性，适合作为商家工具方向。"
        gallery_designs.append({
            "id": design["id"], "name": design["name"],
            "positioning": design["positioning"], "signature": design["signature"],
            "tradeoff": design["tradeoff"], "palette": design["palette"],
            "image": path.name, "pages": page_files,
            "observation": design["review"]["observation"],
            "notes": design["review"]["implementation_notes"],
        })

    data["status"] = "DIRECTION_SELECTED_CURRENT_BASELINE_C" if selection else "FIVE_DIRECTIONS_GENERATED_REVIEWED_AWAITING_USER_SELECTION"
    data["generated_count"] = len(gallery_designs)
    data["verified_at"] = datetime.now(timezone.utc).isoformat()
    recommendation = {
        "primary": "B", "alternative": "A",
        "reason": "B 与一品成片的品牌和成片叙事贴合；A 更侧重操作清晰。属于设计判断，尚无用户实验数据。",
    }
    if selection:
        data["selection"] = selection
        data["historical_recommendation"] = data.pop("recommendation", recommendation)
    else:
        data["recommendation"] = recommendation
    data["limitations"] = [
        "图像生成的视觉概念，尚未组件化，不代表已实现功能。",
        "正式实现须校正视频预览比例、导航状态与文字，并补齐确认、支付、生成进度、异常和授权等流程。",
        "商品为虚构示例，各方向独立生成，未执行生产级商品身份一致性验收。",
    ]
    MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    make_contact_sheet(data["designs"], selection)
    payload = json.dumps(gallery_designs, ensure_ascii=False).replace("<", "\\u003c")
    message = "用户已选定 C「柚子创作社」。当前设计基线为C v1.0；其余方向保留作历史比较。" if selection else "建议优先考虑 B「片场手记」；若优先追求首用清晰，可选 A。"
    document = GALLERY.replace("__DESIGNS_JSON__", payload).replace("__SELECTED_ID__", selected_id).replace("__SELECTION_MESSAGE__", message)
    (OUT / "index.html").write_text(document, encoding="utf-8")
    verify_links()
    print(json.dumps({"images_verified": len(gallery_designs), "dimensions": "1536x1024", "page_previews": 15, "gallery": str(OUT / "index.html"), "status": data["status"]}, ensure_ascii=False))


def make_contact_sheet(designs: list[dict], selection: dict | None) -> None:
    margin, gap, card_w, label_h = 36, 24, 732, 52
    card_h = label_h + 488
    sheet = Image.new("RGB", (margin * 2 + card_w * 2 + gap, 118 + card_h * 3 + gap * 2 + margin), "#F2F5F7")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 23)
    bold = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 33)
    draw.text((margin, 24), "一品成片 · 五种视觉方向", font=bold, fill="#24324B")
    draw.text((margin, 76), "每套均含：拍照制作 / 方案社区 / 素材领取 · 视觉概念稿", font=font, fill="#526275")
    for index, design in enumerate(designs):
        x = margin + index % 2 * (card_w + gap)
        y = 118 + index // 2 * (card_h + gap)
        draw.rectangle((x, y, x + card_w, y + card_h), fill="white")
        draw.text((x + 18, y + 10), f"{design['id']} / {design['name']}", font=font, fill="#24324B")
        with Image.open(ROOT / design["image_file"]) as source:
            thumb = ImageOps.contain(source.convert("RGB"), (card_w, 488), Image.Resampling.LANCZOS)
            sheet.paste(thumb, (x, y + label_h))
    x = margin + card_w + gap
    y = 118 + 2 * (card_h + gap)
    heading = "已选定 C / 柚子创作社" if selection else "建议优先考虑 B / 片场手记"
    lines = ["用户已确认当前视觉方向。", "后续以C设计定型v1.0为基线。", "其余方向保留作历史比较。"] if selection else ["品牌与成片叙事更贴合。", "若首版优先追求操作清晰，可选 A。", "最终以你的选型为准。"]
    draw.text((x + 28, y + 34), heading, font=bold, fill="#24324B")
    for line_index, line in enumerate(lines):
        draw.text((x + 28, y + 110 + line_index * 45), line, font=font, fill="#526275")
    sheet.save(OUT / "五种视觉方向总览.jpg", quality=94)


def verify_links() -> None:
    document = ROOT / "docs/设计/五种视觉方向选型-2026-10-27.md"
    missing = []
    for link in re.findall(r"\]\(([^)]+)\)", document.read_text(encoding="utf-8")):
        if "://" not in link and not (document.parent / link).resolve().is_file():
            missing.append(link)
    if missing:
        raise FileNotFoundError(f"Broken delivery links: {missing}")
    gallery = OUT / "index.html"
    for link in re.findall(r'href="([^"]+)"', gallery.read_text(encoding="utf-8")):
        if "://" not in link and not (gallery.parent / link).resolve().is_file():
            raise FileNotFoundError(f"Broken gallery link: {link}")


GALLERY = r'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>一品成片 · 五种视觉方向选型</title>
<style>
:root{color-scheme:light;--ink:#24324b;--muted:#5d6b7b;--line:#dce3eb;--paper:#f2f5f7;--accent:#c63e39}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif;line-height:1.65}
button,a{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #176fe6;outline-offset:4px}a{color:inherit;text-underline-offset:4px}
header{max-width:1560px;margin:auto;padding:32px 36px 22px;display:flex;gap:24px;align-items:flex-end;justify-content:space-between}
.eyebrow{font-size:12px;letter-spacing:.12em;font-weight:700;color:var(--muted)}h1{font-size:clamp(25px,3vw,40px);line-height:1.3;margin:8px 0 10px;letter-spacing:-.03em}header p{margin:0;color:var(--muted);font-size:14px}.header-links{display:flex;gap:16px;white-space:nowrap;font-size:13px}
main{max-width:1560px;margin:0 auto;padding:0 36px 36px}.directions{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:0 0 20px}.direction{background:#fff;border:1px solid var(--line);border-radius:10px;text-align:left;padding:14px 16px;color:var(--ink);min-height:83px;transition:border-color .15s,background .15s}.direction[aria-selected=true]{border:2px solid var(--ink);padding:13px 15px;background:#eaf0f5}.direction strong{display:block;font-size:16px}.direction span{font-size:12px;color:var(--muted)}.direction b{font-size:11px;color:var(--accent);margin-left:7px}
.review{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.7fr);gap:32px;padding:22px 0 26px;border-top:1px solid var(--line)}h2{font-size:25px;line-height:1.3;margin:0 0 9px}p{margin:0 0 10px}.positioning{font-size:17px}.observation,.tradeoff{color:var(--muted);font-size:14px}.tradeoff strong{color:var(--ink)}.palette{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.swatch{width:28px;height:28px;border-radius:50%;border:1px solid #25334a22}.recommended{font-size:12px;padding:3px 8px;background:#ffe8e4;color:#a63430;border-radius:5px;margin-left:12px;vertical-align:middle}.signature{font-size:14px;margin-bottom:10px}
.toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}.views{display:flex;gap:4px;background:#e3e9ee;padding:4px;border-radius:9px}.view{border:0;border-radius:6px;background:transparent;color:var(--muted);padding:8px 15px;font-size:13px}.view[aria-pressed=true]{background:white;color:var(--ink);box-shadow:0 1px 2px #24324b18}.open{font-size:13px;white-space:nowrap}.stage{margin:0;background:#e6ecf1;border:1px solid var(--line);border-radius:12px;overflow:hidden;min-height:320px;text-align:center}.stage img{display:block;width:100%;height:auto;margin:auto}.stage.single img{width:auto;max-width:100%;max-height:900px}.stage.single{padding:20px}.stage-caption{font-size:12px;color:var(--muted);margin:9px 0 20px}
details{background:#fff;border:1px solid var(--line);border-radius:10px;padding:15px 19px;font-size:13px;color:var(--muted)}summary{cursor:pointer;color:var(--ink);font-weight:700}ul{margin:12px 0 6px;padding-left:20px}.bottom{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding-top:18px;font-size:12px;color:var(--muted)}.bottom p{max-width:900px}.bottom a{white-space:nowrap}
@media(max-width:850px){header{display:block;padding:24px 18px 18px}.header-links{margin-top:16px}main{padding:0 18px 24px}.directions{display:flex;overflow-x:auto;padding-bottom:4px}.direction{flex:0 0 168px}.review{grid-template-columns:1fr;gap:8px}.toolbar{align-items:flex-start;flex-direction:column;gap:9px}.views{width:100%}.view{flex:1;padding:8px 6px}.stage{border-radius:7px;min-height:0}.stage.single{padding:10px}.stage.single img{max-height:800px}.bottom{display:block}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}@media print{header,main{padding:12px}.directions,.toolbar,details{display:none}.review{display:block}.stage{border:0}.bottom{font-size:10px}}
</style></head>
<body>
<header><div><div class="eyebrow">一品成片 / DESIGN SELECTION / 2026.10.27</div><h1>同一条制作流程，五种不同气质。</h1><p>支付宝与抖音小程序优先。每套包含拍照制作、方案社区、素材领取三个页面。</p></div><nav class="header-links" aria-label="交付文件"><a href="五种视觉方向总览.jpg" target="_blank" rel="noopener">查看五套总览 ↗</a><a href="../../../docs/设计/五种视觉方向选型-2026-10-27.md">设计评估文档 ↗</a></nav></header>
<main><div class="directions" id="directions" role="tablist" aria-label="选择设计方向"></div>
<section class="review" id="review" role="tabpanel" aria-live="polite"><div><h2 id="name"></h2><p class="positioning" id="positioning"></p><p class="observation" id="observation"></p></div><div><p class="signature" id="signature"></p><p class="tradeoff"><strong>取舍：</strong><span id="tradeoff"></span></p><div class="palette" id="palette" aria-label="方向色板"></div></div></section>
<div class="toolbar"><div class="views" aria-label="预览页面"><button class="view" data-view="-1" aria-pressed="true">三页全览</button><button class="view" data-view="0" aria-pressed="false">拍照制作</button><button class="view" data-view="1" aria-pressed="false">方案社区</button><button class="view" data-view="2" aria-pressed="false">素材领取</button></div><a class="open" id="original" target="_blank" rel="noopener">打开原尺寸 PNG ↗</a></div>
<figure class="stage" id="stage"><img id="preview" width="1536" height="1024" alt=""></figure><p class="stage-caption">概念设计图 · 可切换单页放大查看 · 页面裁图仅用于选型预览</p>
<details><summary>正式实现时需调整的细节</summary><ul id="notes"></ul><p>还需依据 v3.0 需求补齐商品识别纠错、内容与费用确认、支付、制作进度、异常及相册授权。当前三页只用于视觉选型。</p></details>
<footer class="bottom"><p>__SELECTION_MESSAGE__ 图片为虚构商品的生成式视觉概念，未实现为小程序。</p><a href="designs.json">生成参数与核验记录 ↗</a></footer></main>
<script type="application/json" id="data">__DESIGNS_JSON__</script>
<script>
const designs=JSON.parse(document.getElementById('data').textContent);const selectedId='__SELECTED_ID__';let current=designs.findIndex(d=>d.id===selectedId),view=-1;const el=id=>document.getElementById(id);const pageNames=['拍照制作','方案社区','素材领取'];
const tabs=designs.map((d,index)=>{const button=document.createElement('button');button.className='direction';button.id='direction-'+d.id;button.setAttribute('role','tab');button.setAttribute('aria-controls','review');const strong=document.createElement('strong');strong.textContent=d.id+' / '+d.name;if(d.id===selectedId){const badge=document.createElement('b');badge.textContent='已选定';strong.append(badge)}const span=document.createElement('span');span.textContent=['清楚易用','成片叙事','社区亲和','商品质感','AI 创意'][index];button.append(strong,span);button.addEventListener('click',()=>{current=index;render()});button.addEventListener('keydown',event=>{let next=null;if(event.key==='ArrowRight')next=(index+1)%designs.length;if(event.key==='ArrowLeft')next=(index+designs.length-1)%designs.length;if(event.key==='Home')next=0;if(event.key==='End')next=designs.length-1;if(next!==null){event.preventDefault();current=next;render();tabs[next].focus()}});el('directions').append(button);return button});
document.querySelectorAll('.view').forEach(button=>button.addEventListener('click',()=>{view=Number(button.dataset.view);render()}));
function render(){const d=designs[current];tabs.forEach((t,i)=>{t.setAttribute('aria-selected',String(i===current));t.tabIndex=i===current?0:-1});el('review').setAttribute('aria-labelledby','direction-'+d.id);el('name').textContent=d.id+' / '+d.name;if(d.id===selectedId){const badge=document.createElement('span');badge.className='recommended';badge.textContent='用户已选定';el('name').append(badge)}el('positioning').textContent=d.positioning;el('observation').textContent=d.observation;el('signature').textContent='视觉记忆：'+d.signature;el('tradeoff').textContent=d.tradeoff;el('palette').replaceChildren(...Object.entries(d.palette).map(([name,color])=>{const s=document.createElement('span');s.className='swatch';s.style.background=color;s.title=name+' '+color;s.setAttribute('role','img');s.setAttribute('aria-label',name+' '+color);return s}));el('notes').replaceChildren(...d.notes.map(text=>{const li=document.createElement('li');li.textContent=text;return li}));el('stage').classList.toggle('single',view>=0);el('preview').src=view<0?d.image:d.pages[view];el('preview').alt=d.id+' '+d.name+' · '+(view<0?'拍照制作、方案社区、素材领取':pageNames[view]);el('preview').removeAttribute('width');el('preview').removeAttribute('height');el('original').href=view<0?d.image:d.pages[view];document.querySelectorAll('.view').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.view)===view)));document.title=d.id+' '+d.name+' · 一品成片选型'}render();
</script></body></html>'''


if __name__ == "__main__":
    make_deliverables()

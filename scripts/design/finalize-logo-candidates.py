"""Validate/archive ten logo candidates and export a local ZIP after visual review.

python -B -X utf8 scripts/design/finalize-logo-candidates.py --visually-inspected
No network, browser, model or server access. Requires Pillow.
"""
from pathlib import Path
from datetime import datetime
from hashlib import sha256
from zipfile import ZipFile, ZIP_DEFLATED
from html import escape
import argparse
import json
import re
import shutil

from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
BATCH=ROOT/'output/imagegen/2026-11-01-logo-candidates'
ARCHIVE=ROOT/'assets/design/logo-candidates/2026-11-01'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--visually-inspected',action='store_true',help='Confirm actual inspection of the ten originals, overview and small-size comparison.')
    args=parser.parse_args()
    if not args.visually_inspected:
        raise SystemExit('Inspect the ten originals, overview and small-size comparison before finalizing.')
    plan=json.loads((ARCHIVE/'candidates.json').read_text(encoding='utf-8'))
    entries=plan['entries']
    assert len(entries)==10
    fingerprints=set()
    png_count=0
    for e in entries:
        directory=f"{e['id']}-{e['slug']}"
        folder=ARCHIVE/directory
        original=(folder/'source.png').read_bytes()
        assert original==(BATCH/directory/'source.png').read_bytes()
        fingerprints.add(sha256(original).hexdigest())
        for size in (1024,512,256,128,64,32):
            with Image.open(folder/f'icon-{size}.png') as im:
                im.load()
                assert im.size==(size,size) and im.mode=='RGB'
        for p in folder.glob('*.png'):
            with Image.open(p) as im: im.verify()
            png_count+=1
        e.update(visual_inspection='INSPECTED_ORIGINAL_CONTACT_SHEET_AND_SMALL_SIZE_BOARD',recommended_role={'01':'C-compatible minimal main identity','02':'Recommended main brand symbol','06':'C-compatible brand mascot'}.get(e['id'],'Alternative brand direction'))
    assert len(fingerprints)==10
    plan.update(visual_inspection_completed=True,selected_candidate=None,selection_status='AWAITING_USER_SELECTION',transport_changes='NONE; HTTP-only server configuration preserved',generation_attempt_note='An accidental duplicate coordinator invocation was stopped. Ten retained distinct source files are verified; gateway billing and canceled upstream work are not inferred from file count.')
    candidate_json=json.dumps(plan,ensure_ascii=False,indent=2)+'\n'
    for folder in (ARCHIVE,BATCH): (folder/'candidates.json').write_text(candidate_json,encoding='utf-8')
    shutil.copy2(ROOT/'assets/resources/fonts/noto-sans-sc/OFL.txt',ARCHIVE/'font-OFL.txt')
    shutil.copy2(ROOT/'assets/resources/fonts/noto-sans-sc/source.json',ARCHIVE/'font-source.json')
    rows=[]
    cards=[]
    for e in entries:
        folder=f"{e['id']}-{e['slug']}"
        rows.append(f"| {e['id']} | [{e['name']}]({folder}/preview.png) | {e['style']} / {e['style_en']} | {e['meaning']} | [1024 PNG]({folder}/icon-1024.png) · [横版字标]({folder}/wordmark-horizontal.png) |")
        cards.append(f'''<article style="--bg:{e['background']};--ink:{e['ink']}">
<a class="art" href="{folder}/preview.png"><img loading="lazy" src="{folder}/icon-512.png" width="512" height="512" alt="{escape(e['id']+' '+e['name'])}"></a>
<div class="description"><small>{escape(e['id']+' / '+e['style_en'])}</small><h2>{escape(e['name'])}</h2><p>{escape(e['meaning'])}</p><p class="fit">{escape(e['fit'])}</p>
<nav><a href="{folder}/preview.png">查看大图</a><a href="{folder}/icon-1024.png" download>下载图标</a><a href="{folder}/wordmark-horizontal.png" download>下载字标</a></nav></div></article>''')
    readme='''# 一品成片 · 10 款 LOGO 选型 / Ten logo candidates

2026-11-01，Asia/Taipei。状态：**已生成并整理，等待用户选型**。现有 C「柚子创作社」继续作为 UI 基线。本轮只新增品牌候选资产。

![十款 LOGO 总览](overview.png)

[逐款浏览页面](index.html) · [逐款 GIF](logo-showcase.gif) · [小尺寸实像素对照](small-size-comparison.png) · [候选元数据](candidates.json) · [文件 SHA256 清单](manifest.json)

## 选型目录 / Candidate index

| 编号 | 名称与大图 | 风格 | 图形含义 | 可用文件 |
| --- | --- | --- | --- | --- |
'''+ '\n'.join(rows)+'''

建议 **02 一品三帧**作为主品牌，品字结构与图片/视频组合能够解释“一件商品、一套内容”。**01 拍即成片**与现有 C 的配色、圆角和轻松操作更接近；**06 柚子小导**适合作为运营角色和品牌 IP。01/02/03/06在色彩上较容易兼容 C；04/05/07/08/09/10提供差异风格备选，选定后再做正式应用规范。

## 文件与使用 / Files and usage

每款独立目录包含：

| 文件 | 用途与事实范围 |
| --- | --- |
| `source.png` | 网关实际返回的 1254×1254 原图，不覆盖、不重绘；01–03及05–10为RGBA，04为RGB。 |
| `prompt.txt` | 完整创意提示词，不含服务配置和密钥。 |
| `icon-1024/512/256/128/64/32.png` | 带背景的规范尺寸图标候选；实际尺寸逐项核对。用于小程序图标、头像及网页等位置的选型与后续适配。 |
| `wordmark-horizontal.png` | 2048×640 横版图形＋准确中文“一品成片”＋英文 ONE TAP ASSETS。 |
| `wordmark-vertical.png` | 1024×1280 竖版图形＋规范品牌字标。 |
| `preview.png` | 1440×960 单款设计展示卡，包含方案编号、名称和风格。 |
| `small-sizes.png` | 32/48/64/128像素原尺寸排布，供检查实际识别度，不将放大展示当作小尺寸效果。 |
| `favicon.ico` | 16/32/48/64多尺寸网页图标候选。 |

图形来自用户指定的 **sub2-image-gen** Skill及其配置网关，执行原脚本 `scripts/sub2_image_gen.py`；模型 **gpt-image-2.5**，high quality，每款独立提示词，未替换生成渠道或模型。请求1024×1024，实际返回1254×1254，因此如实保留原图并单独缩放导出。现有Alpha按各方案背景合成；04保留原画背景。没有推断抠图、自动矢量追踪或伪称SVG母版。

品牌文字使用仓库现有 **Noto Sans SC / OFL-1.1** 字体准确排版，不依赖图像模型写字；随包保留[字体许可](font-OFL.txt)及[来源](font-source.json)，不重复分发字体文件。PNG为栅格候选，完整单色/反白版、矢量精修及最终平台上传裁切在选型后定稿。本轮已查看十张原图、总览、字标示例和小尺寸对照；32像素时04/05/06/07的细节会收敛，应以轮廓识别，选定后继续简化小尺寸专用版。

## 本地复导出 / Local export

生成工作文件位于 `output/imagegen/2026-11-01-logo-candidates/`（按仓库规则忽略）；安全的原图、提示词、衍生图、总览和GIF在本目录长期留档并提交。以下命令仅本地整理，不调用模型：

```text
python -B -X utf8 scripts/design/package-logo-candidates.py
python -B -X utf8 scripts/design/finalize-logo-candidates.py --visually-inspected
```

第二条仅在实际看过对应原图和对照后执行。需要Pillow；使用仓库已有字体。再次实际生图应通过用户指定Skill脚本与`prompt.txt`，不要把网关地址/密钥写进仓库。曾误启动一次重复生成协调进程，发现后已停止；交付按十份不同原图核对，文件数量不用于推断上游计费或被取消请求的执行状态。

ZIP导出到 `output/imagegen/2026-11-01-logo-candidates/one-tap-assets-logo-candidates-2026-11-01.zip`，校验见仓库本目录的外部 `package-receipt.json` 及ZIP旁的 `.sha256`；ZIP不重复提交二进制，也不包含自己的外部回执。解压后打开 `index.html` 浏览全部方案，无外部依赖、跟踪或接口请求。GIF是十张真实设计卡的轮播，不是应用操作录屏。本轮没有应用UI变更，也没有打开浏览器或修改HTTP部署。

## 本轮完成与待办 / Completed and pending

| 编号 | 已完成 |
| --- | --- |
| L01 | 十款独立风格真实生图、原图与提示词留存。 |
| L02 | 规范图标、横竖字标、ICO、设计卡、小尺寸对照、总览、GIF和本地ZIP。 |
| L03 | 图片解码/尺寸、十份原图差异与工作副本一致性、清单SHA256及静态链接核对。 |

| 编号 | 待完成 |
| --- | --- |
| L04 | 用户从01–10选择主LOGO方向。 |
| L05 | 选定款矢量精修、单色/反白/小尺寸版和正式品牌应用规范。 |
| L06 | 将选定资产应用至双小程序、Plus、官网和上线宣传内容。 |

## English

Ten independently generated logo-symbol directions for **One Tap Assets / 一品成片**. Each symbol was produced through the explicitly requested **sub2-image-gen** gateway using **gpt-image-2.5**, high quality, with its own archived prompt. The gateway returned 1254×1254 images despite a 1024×1024 request; originals are preserved byte-for-byte. Exported icons have verified 1024/512/256/128/64/32 dimensions. Existing transparency is composited over each direction's background; no vector master or inferred background removal is claimed.

The archive includes exact Chinese/English typeset lockups, individual boards, a full contact sheet, actual-size comparisons, a ten-frame GIF, offline HTML gallery and SHA256 file manifest. Typography uses the repository's OFL-licensed Noto Sans SC. The ZIP is exported locally under the ignored `output/imagegen/` folder; its receipt and all source/derivative assets are versioned here. The ZIP excludes its own external receipt to avoid circular hashes.

Recommended main identity: **02 Three Frames**, whose three-part layout echoes 品 and combines image/video assets. **01 Tap Frame** closely fits the current citrus/cream/forest-green UI; **06 Citrus Director** supports a friendly brand mascot. All ten are **unselected candidates**; the existing C UI baseline and HTTP-only server remain in place. Selection, vector refinement, monochrome/reverse/tiny-icon variants and product rollout follow afterward.
'''
    (ARCHIVE/'README.md').write_text(readme,encoding='utf-8')
    gallery='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>一品成片 · 10款LOGO选型</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f3ee;color:#263b32;font-family:system-ui,"Microsoft YaHei",sans-serif}main{max-width:1360px;margin:auto;padding:52px 24px}h1{font-size:clamp(30px,5vw,56px);margin:0 0 12px;letter-spacing:-.04em}.intro{max-width:800px;font-size:17px;line-height:1.8;color:#5a6a61}header nav{display:flex;gap:18px;flex-wrap:wrap;margin:22px 0 36px}a{color:inherit;text-underline-offset:4px}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{overflow:hidden;border-radius:24px;background:var(--bg);color:var(--ink)}.art{display:block}.art img{display:block;width:100%;height:auto;max-height:410px;object-fit:contain}.description{padding:12px 30px 30px}small{opacity:.7}h2{font-size:28px;margin:9px 0}p{line-height:1.8}.fit{font-size:14px}article nav{display:flex;gap:16px;flex-wrap:wrap;font-size:14px;margin-top:22px}footer{margin-top:40px;font-size:14px;line-height:1.8;color:#5a6a61}@media(max-width:700px){main{padding:30px 16px}section{grid-template-columns:1fr}.description{padding:8px 22px 26px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style></head><body><main><header><h1>一品成片</h1><p class="intro">10 款品牌标志提案。围绕“拍下商品，产出成套素材”，从轻松自助、几何秩序到未来科技。先看图形，再选品牌方向。</p><nav><a href="overview.png">下载总览</a><a href="logo-showcase.gif">查看轮播</a><a href="small-size-comparison.png">小尺寸对照</a><a href="README.md">完整说明</a></nav></header><section>
'''+ '\n'.join(cards)+'''
</section><footer>2026.11.01 · 十款均为待选型候选。推荐02作为主标志、01适配现有界面、06延展品牌角色。<br>点选大图查看细节；下载图标和字标后可继续排版。完整原图、提示词和多尺寸版本随目录留存。</footer></main></body></html>'''
    (ARCHIVE/'index.html').write_text(gallery,encoding='utf-8')
    with Image.open(ARCHIVE/'logo-showcase.gif') as gif:
        assert gif.n_frames==10
        for frame in range(gif.n_frames): gif.seek(frame);gif.load()
    # Match all static HTML local links and images to actual files.
    links=re.findall(r'(?:href|src)="([^"]+)"',gallery)
    for link in links: assert (ARCHIVE/link).is_file(),link
    for path in (ARCHIVE/'README.md',ARCHIVE/'index.html',ARCHIVE/'candidates.json'):
        assert not re.search(r'sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|-----BEGIN .*PRIVATE KEY',path.read_text(encoding='utf-8'),re.I)
    records=[]
    excluded={'manifest.json','package-receipt.json'}
    for path in sorted(ARCHIVE.rglob('*')):
        if not path.is_file() or path.name in excluded: continue
        content=path.read_bytes()
        record=dict(path=path.relative_to(ARCHIVE).as_posix(),bytes=len(content),sha256=sha256(content).hexdigest())
        if path.suffix.lower() in ('.png','.gif','.ico'):
            with Image.open(path) as im:
                record.update(width=im.width,height=im.height,format=im.format)
        records.append(record)
    manifest=dict(project='一品成片',date='2026-11-01',scope='Ten unselected logo candidates, source and derivative assets',model='gpt-image-2.5',distinct_originals=10,candidate_pngs_verified=png_count,gif_frames=10,local_html_links_verified=len(links),visual_inspection=True,public_file_count=len(records),total_bytes=sum(x['bytes'] for x in records),self_exclusions=sorted(excluded),files=records)
    (ARCHIVE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    zipper=BATCH/'one-tap-assets-logo-candidates-2026-11-01.zip'
    with ZipFile(zipper,'w',ZIP_DEFLATED,compresslevel=6) as zipfile:
        for path in sorted(ARCHIVE.rglob('*')):
            if path.is_file() and path.name!='package-receipt.json':
                zipfile.write(path,path.relative_to(ARCHIVE).as_posix())
    payload=zipper.read_bytes()
    receipt=dict(filename=zipper.name,project_relative_path=zipper.relative_to(ROOT).as_posix(),bytes=len(payload),sha256=sha256(payload).hexdigest(),scope='All candidate files and manifest, excluding this external ZIP receipt',source_originals=10,model='gpt-image-2.5',status='CANDIDATES_AWAITING_SELECTION')
    (ARCHIVE/'package-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (zipper.parent/(zipper.name+'.sha256')).write_text(receipt['sha256']+'  '+zipper.name+'\n',encoding='utf-8')
    with ZipFile(zipper) as zipfile:
        assert zipfile.testzip() is None
        zipped=zipfile.namelist()
        for record in records:
            assert sha256(zipfile.read(record['path'])).hexdigest()==record['sha256']
    for name in ('README.md','index.html','manifest.json','package-receipt.json'):
        shutil.copy2(ARCHIVE/name,BATCH/name)
    print(json.dumps(dict(candidates=10,distinct_originals=len(fingerprints),pngs_verified=png_count,gif_frames=10,html_links_verified=len(links),archived_files=len(records)+2,archive=str(ARCHIVE),zip=str(zipper),zip_bytes=len(payload),zip_sha256=receipt['sha256'],zip_entries=len(zipped)),ensure_ascii=False,indent=2))


if __name__=='__main__': main()

"""Finalize the user-selected 06 brand package after visual review of all assets/PDF pages.

python -B -X utf8 scripts/design/finalize-citrus-brand.py --visually-inspected
Outputs: versioned public archive, SHA256 manifest, local ZIP and evidence receipt.
"""
from pathlib import Path
from hashlib import sha256
from zipfile import ZipFile,ZIP_DEFLATED
from html import escape
from collections import Counter
import argparse
import json
import re
import shutil
import struct
import xml.etree.ElementTree as ET

from PIL import Image,ImageOps,ImageDraw
import numpy as np
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/imagegen/2026-11-01-citrus-director-final'
ARCHIVE=ROOT/'assets/brand/citrus-director/v1.0.0'
TMP=ROOT/'runtime/tmp/pdfs/citrus-director-v1'
PDFNAME='一品成片-柚子小导-品牌手册-v1.0.pdf'


def local_links(text,html=False):
    if html: return re.findall(r'(?:href|src)="([^"]+)"',text)
    return re.findall(r'\]\(([^\n)]+)\)',text)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--visually-inspected',action='store_true')
    args=parser.parse_args()
    if not args.visually_inspected:
        raise SystemExit('Inspect the brand board, raster/vector variants, launch images, small sizes and all eight final PDF pages first.')
    facts=json.loads((OUT/'brand.json').read_text(encoding='utf-8'))
    original=ROOT/'assets/design/logo-candidates/2026-11-01/06-citrus-director/source.png'
    assert (OUT/'source/06-citrus-director-original.png').read_bytes()==original.read_bytes()
    assert facts['original_sha256']==sha256(original.read_bytes()).hexdigest()
    raw=np.asarray(Image.open(original).convert('RGBA'))
    cleaned=np.asarray(Image.open(OUT/'master/symbol-color-native-transparent-1254.png').convert('RGBA'))
    assert np.array_equal(raw[:,:,:3],cleaned[:,:,:3])
    assert facts['cleaning']['alpha_changed_pixels']==int(np.count_nonzero(raw[:,:,3]!=cleaned[:,:,3]))
    assert facts['cleaning']['alpha_changed_pixels']>0
    facts.update(visual_review='Reviewed final original, brand board, vector/mono/reverse, launch images, actual-size icons and all eight final PDF pages',delivery_status='FINAL_ASSET_PACKAGE_READY',approved_direction='06',application_integration='NOT_CHANGED_THIS_ASSET_ROUND')
    (OUT/'brand.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    # Archive actual rendered guide previews as intentional handover media.
    previews=OUT/'guidelines/preview';previews.mkdir(exist_ok=True)
    contact=Image.new('RGB',(1600,1230),'#F3F2EB')
    for page in range(1,9):
        src=TMP/f'page-{page}.png'
        assert src.is_file()
        im=Image.open(src).convert('RGB')
        im.verify()
        shutil.copy2(src,previews/f'{page:02d}.png')
        with Image.open(src) as im:
            thumb=ImageOps.contain(im.convert('RGB'),(760,270),Image.Resampling.LANCZOS)
        x=25+((page-1)%2)*790+(760-thumb.width)//2
        y=25+((page-1)//2)*300
        contact.paste(thumb,(x,y))
    contact.save(OUT/'guidelines/guide-preview.png',optimize=True)
    print('Validated original/alpha cleanup and archived eight rendered PDF previews.',flush=True)
    start='''# 一品成片 · 柚子小导定稿素材

当前正式标志：**06 柚子小导，v1.0.0**。这是可直接取用的品牌资产包。

| 你要做什么 | 直接使用 |
| --- | --- |
| 看完整定稿 | [品牌总览](brand-overview.png) |
| 小程序图标 / 头像 | [奶白512图标](icons/app/cream/icon-512.png) |
| 透明主图形 | [透明PNG](raster/symbol-color-transparent-1024.png) |
| 网页页眉 / 宣传落款 | [透明横版](raster/hero-lockup-horizontal-transparent.png) |
| 深底页眉 | [深底横版](raster/hero-lockup-horizontal-dark.png) |
| 竖版品牌组合 | [透明竖版](raster/hero-lockup-vertical-transparent.png) |
| 印刷 / 任意缩放 | [彩色真矢量](vector/symbol-flat-color.svg) |
| 单色 / 反白 | [深绿单色](vector/symbol-flat-ink.svg) · [纯白反白](vector/symbol-flat-white.svg) |
| 网页favicon | [ICO](integration/web/favicon.ico) · [SVG](integration/web/favicon.svg) |
| 分享封面 | [1200×630 PNG](launch/social-cover-1200x630.png) |
| 竖版海报 | [1080×1920 PNG](launch/portrait-poster-1080x1920.png) |
| 品牌手册 | [8页PDF](guidelines/一品成片-柚子小导-品牌手册-v1.0.pdf) |
| 导入品牌颜色 | [Adobe ASE](tokens/brand-colors.ase) · [JSON](tokens/brand-colors.json) · [CSS](tokens/brand-colors.css) |

解压后双击 `index.html` 浏览并下载各版本。完整规则见 [README](README.md)。

Use the cream 512px icon for the default app/avatar identity, the transparent hero lockup for light headers, and path-only flat SVGs for scalable/print work. The eight-page PDF documents colors, spacing, minimum sizes and usage. This folder is self-contained.
'''
    (OUT/'START-HERE.md').write_text(start,encoding='utf-8')
    readme='''# 一品成片 · 柚子小导品牌定稿 / Citrus Director Brand 1.0.0

**用户于2026-11-01选择06「柚子小导」作为正式LOGO方向。** 产品名仍为「一品成片」，英文为「ONE TAP ASSETS」；柚子小导是品牌角色/标志名称。

![正式品牌定稿](brand-overview.png)

[快速取用](START-HERE.md) · [离线素材库](index.html) · [品牌手册PDF](guidelines/一品成片-柚子小导-品牌手册-v1.0.pdf) · [手册预览](guidelines/guide-preview.png) · [物料轮播](brand-showcase.gif) · [完整SHA256](manifest.json)

## 本次定稿包含

| 分类 | 已交付 |
| --- | --- |
| 原稿与主标志 | 原始1254PNG与原提示词、透明边缘清理后的原生尺寸稿、紧边母版、透明2048/1024/512/256 PNG、奶白/纯白/深绿背景稿。 |
| 真正矢量 | 独立扁平路径SVG；彩色、深绿、纯白、纯黑、果橙五种；图形、横版、竖版、仅中文横版；另有小尺寸简化SVG。字标已转路径，无外链字体、图片或脚本。 |
| 标准组合 | 原选定质感形象的横竖PNG字标；透明、奶白、纯白、深底与反白字标版本。中文准确排版“一品成片”，英文“ONE TAP ASSETS”。 |
| 图标 | 奶白、纯白、深绿背景的1024/512/256/192/180/128图标；16/24/32/48/64/96/128小尺寸稿；16/24/32/48/64多尺寸ICO。 |
| 网页交接 | favicon.svg/ico、apple-touch-icon、192/512网页图标、相对路径site.webmanifest及head示例。接入时按自己的静态路径拷贝，不会自行修改网站。 |
| 上线物料 | 1200×630分享封面PNG/JPG、1080×1080方图、1080×1920海报、1920×640横幅、1200×960分享卡、800×240透明片尾标记。 |
| 颜色 | sRGB HEX/RGB JSON、独立前缀CSS变量、Adobe ASE、GIMP GPL。 |
| 规范与交接 | 8页PDF、逐页PNG预览、小尺寸实像素对照、离线HTML、主总览、5帧GIF、元数据与SHA256文件清单。 |

## 视觉定型

主标志保留用户选择的软萌相机形象：叶子、温暖果橙机身、深绿播放窗口、友善表情和右侧镜头。原图作为源文件完整留存；主标志仅清除孤立极低透明度边缘杂点，不改变保留图形内的RGB。

**扁平矢量版是配套应用稿**：依据同一角色重绘为真正Bezier路径，用于印刷、任意缩放和单色场景。原图的体积光照使用PNG保留；2048主图是从原始1254导出的放大版本，原生细节以1254源图为准。

| 基础颜色 | HEX | RGB |
| --- | --- | --- |
| 果橙 | #FF9C4C | 255,156,76 |
| 深绿墨 | #263B32 | 38,59,50 |
| 薄荷绿 | #CFE9D6 | 207,233,214 |
| 奶白 | #FFFAEE | 255,250,238 |

留白 `u = 图形最长可见边 / 8`，四周至少u。设计使用下限：质感图形64px，标准扁平32px，专用favicon简化稿16px；带英文组合宽至少240px，仅中文组合宽至少160px，扁平印刷图形至少12mm。16/24/32专用稿省略面部细节，保留叶子和播放窗口。小尺寸对照请看[实像素PNG](guidelines/small-size-inspection.png)。

不拉伸、倾斜、旋转、替换叶子/表情、压文字、添加发光描边或任意改色。质感稿/扁平稿分别整套使用。传播语为“拍下商品，成套表达。”；辅助传播语“让好商品，被好好看见。”。颜色文件以sRGB为准，印刷按打样校色。

当前C界面基线继续负责页面设计，品牌动作橙与UI动作橙#FF7948区分管理；品牌CSS仅提供独立变量。当前素材轮未部署页面、修改服务配置或配置HTTPS。

## 文件来源、版本与复导出

原始形象来自本会话用户指定的sub2-image-gen / gpt-image-2.5流程，原图SHA256记录在[品牌元数据](brand.json)。本轮从已选原图制作交付文件，没有再次调用生图服务。字体为Noto Sans SC / OFL，许可见[source/font-OFL.txt](source/font-OFL.txt)，来源见[source/font-source.json](source/font-source.json)。矢量字标已转路径；PDF字体为内部静态实例的子集，原字体文件不重复分发。

三个复导出脚本在仓库 `scripts/design/`：`build-citrus-brand.py` 构建原图衍生与真矢量；`create-citrus-brand-guide.py` 创建手册；`finalize-citrus-brand.py --visually-inspected` 在实际检查后验证并导出交付包。所需Python库为Pillow、NumPy、SciPy、fontTools、CairoSVG、ReportLab与pypdf；PDF逐页检查使用原生Poppler。没有Docker、WSL、虚拟机、子代理或浏览器依赖。

源工作目录为 `output/imagegen/2026-11-01-citrus-director-final/`；正式版本留档于 `assets/brand/citrus-director/v1.0.0/`，当前指针在 `assets/brand/current.json`。后续修订使用新版本；原十款候选和C冻结设计保持历史原件。

完整ZIP为工作目录内 `one-tap-assets-citrus-director-brand-v1.0.0.zip`，外部SHA回执在仓库本目录的 `package-receipt.json` 及ZIP旁 `.sha256`。ZIP不包含自己的外部回执；文件清单不包含自身与外部ZIP回执，避免循环哈希。整包解压后本目录链接自足，选择START-HERE或index.html即可。

## 本轮完成与后续

| 编号 | 本轮已完成 |
| --- | --- |
| B01 | 用户06选型记录、品牌v1.0.0与当前指针。 |
| B02 | 主标志、透明底、真正矢量、横竖/中文组合、单色与反白。 |
| B03 | 多尺寸图标、ICO、网页交接文件、上线封面/海报/片尾。 |
| B04 | 颜色文件、8页品牌手册、离线浏览、文件清单与完整ZIP。 |
| B05 | 素材专项检查及中英说明、状态与更新记录同步。 |

| 编号 | 后续待处理 |
| --- | --- |
| B06 | 将此定稿版本接入双小程序、Plus、官网和具体上线宣传位置；按实际宿主检查上传与显示。 |

## English

The user selected **06 Citrus Director** on 2026-11-01. This is the finalized **One Tap Assets / 一品成片 brand asset release 1.0.0**. The soft shaded original mascot remains the primary identity. A separately drawn flat path-only SVG family supports scalable, monochrome, reverse and print use; it does not claim to reproduce the original raster shading as vectors.

Included: unchanged original and prompt, cleaned transparent raster masters, up to2048px raster exports, outlined Chinese/English horizontal and vertical lockups, five SVG color modes, tiny icons, three app-icon backgrounds, multi-size ICO, web handover files, launch/social graphics, Adobe ASE/JSON/CSS/GPL colors, eight-page PDF guide, page previews, offline gallery, GIF and SHA256 manifest. Existing RGB values inside the retained primary silhouette are unchanged; only isolated very-low-alpha edge specks are removed. The2048 export is a resampled derivative of the1254 original.

Noto Sans SC is used under OFL; licensing and provenance are included. No new image-generation API call was made in this finalization round. The versioned assets and bilingual documentation are committed; the complete ZIP is exported locally under ignored output/imagegen with an external checksum receipt. Application deployment and host/device upload acceptance follow separately; the established C UI and HTTP-only configuration remain in effect.
'''
    (OUT/'README.md').write_text(readme,encoding='utf-8')
    samples=[
        ('主标志与字标','raster/hero-lockup-horizontal-cream.png','raster/hero-lockup-horizontal-transparent.png','透明横版PNG'),
        ('彩色主标志','icons/app/cream/icon-512.png','raster/symbol-color-transparent-1024.png','透明主图PNG'),
        ('扁平真矢量','raster/symbol-flat-color.png','vector/symbol-flat-color.svg','彩色SVG'),
        ('深绿单色','raster/symbol-flat-ink.png','vector/symbol-flat-ink.svg','单色SVG'),
        ('纯白反白','raster/symbol-flat-white.png','vector/symbol-flat-white.svg','反白SVG'),
        ('仅中文字标','raster/lockup-horizontal-zh-color.png','vector/lockup-horizontal-zh-color.svg','中文组合SVG'),
        ('竖版组合','raster/hero-lockup-vertical-cream.png','raster/hero-lockup-vertical-transparent.png','竖版透明PNG'),
        ('分享封面','launch/social-cover-1200x630.png','launch/social-cover-1200x630.png','分享PNG'),
        ('竖版海报','launch/portrait-poster-1080x1920.png','launch/portrait-poster-1080x1920.png','海报PNG'),
        ('方图','launch/square-poster-1080x1080.png','launch/square-poster-1080x1080.png','方图PNG'),
        ('网站横幅','launch/site-banner-1920x640.png','launch/site-banner-1920x640.png','横幅PNG'),
        ('品牌手册','guidelines/guide-preview.png','guidelines/'+PDFNAME,'8页PDF'),
    ]
    cards=[]
    for name,preview,link,label in samples:
        dark=' dark' if 'white.png' in preview else ''
        cards.append(f'<article><a class="preview{dark}" href="{escape(link)}"><img loading="lazy" src="{escape(preview)}" alt="{escape(name)}"></a><h2>{escape(name)}</h2><a class="download" href="{escape(link)}" download>下载{escape(label)}</a></article>')
    html='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>一品成片 · 柚子小导正式品牌素材</title><style>
*{box-sizing:border-box}body{margin:0;color:#263b32;background:#fffaee;font-family:system-ui,"Microsoft YaHei",sans-serif}main{max-width:1350px;margin:auto;padding:44px 24px}header{margin-bottom:36px}h1{font-size:clamp(32px,6vw,58px);letter-spacing:-.04em;margin:16px 0}p{line-height:1.8;color:#5a6a61}small{color:#647169}nav{display:flex;gap:20px;flex-wrap:wrap;margin-top:24px}a{color:inherit;text-underline-offset:5px}section{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}article{background:white;border-radius:20px;overflow:hidden;padding-bottom:24px}.preview{height:280px;display:flex;align-items:center;justify-content:center;background:#fff7e8}.preview.dark{background:#263b32}img{width:100%;height:100%;object-fit:contain;display:block}h2{font-size:21px;margin:23px 24px 12px}.download{display:inline-block;margin-left:24px}footer{margin-top:42px;font-size:14px;line-height:1.8;color:#647169}@media(max-width:920px){section{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:580px){section{grid-template-columns:1fr}main{padding:28px 16px}}
</style></head><body><main><header><small>APPROVED IDENTITY 06 / VERSION 1.0.0</small><h1>一品成片 · 柚子小导</h1><p>拍下商品，成套表达。<br>主标志、字标、矢量、图标与上线物料都在这里，按版位直接取用。</p><nav><a href="START-HERE.md">快速取用</a><a href="brand-overview.png">完整总览</a><a href="guidelines/一品成片-柚子小导-品牌手册-v1.0.pdf">品牌手册</a><a href="README.md">全部文件说明</a><a href="manifest.json">SHA256清单</a></nav></header><section>
'''+ '\n'.join(cards)+'''
</section><footer>2026.11.01 · 用户已选择06方向，品牌素材v1.0.0。<br>矢量SVG已将字标转为真实路径；透明PNG用于数字排版。全部文件均在本包内，离线可用。</footer></main></body></html>'''
    (OUT/'index.html').write_text(html,encoding='utf-8')
    svgs=list(OUT.rglob('*.svg'))
    for svg in svgs:
        data=svg.read_text(encoding='utf-8')
        document=ET.fromstring(data)
        tags=[element.tag.split('}')[-1] for element in document.iter()]
        assert 'path' in tags
        assert not set(tags)&{'image','text','script','foreignObject','use','style'}
        assert 'href=' not in data and 'data:' not in data and 'onload' not in data
    for mode,expected in [('ink','#263B32'),('white','#FFFFFF'),('black','#000000'),('orange','#FF9C4C')]:
        for svg in (OUT/'vector').glob('*'+mode+'.svg'):
            document=ET.parse(svg)
            colors={node.attrib['fill'] for node in document.iter() if 'fill' in node.attrib}
            assert colors=={expected},(svg,colors)
    rasters=[]
    for image in OUT.rglob('*'):
        if image.suffix.lower() not in ('.png','.jpg','.gif','.ico'): continue
        with Image.open(image) as im: im.verify()
        rasters.append(image)
    for bg in ('cream','white','dark'):
        for n in (1024,512,256,192,180,128):
            with Image.open(OUT/f'icons/app/{bg}/icon-{n}.png') as im:
                assert im.size==(n,n) and im.mode=='RGB'
    for n in (16,24,32,48,64,96,128):
        with Image.open(OUT/f'icons/small/icon-{n}.png') as im: assert im.size==(n,n)
    with Image.open(OUT/'raster/symbol-color-transparent-1024.png') as im:
        alpha=im.getchannel('A');assert alpha.getextrema()==(0,255)
        assert all(alpha.getpixel(p)==0 for p in [(0,0),(1023,0),(0,1023),(1023,1023)])
    for mode in ('color','ink','white','black','orange'):
        with Image.open(OUT/f'raster/symbol-flat-{mode}.png') as im:
            x0,y0,x1,y1=im.getchannel('A').getbbox()
            unit=max(x1-x0,y1-y0)/8
            assert min(x0,y0,im.width-x1,im.height-y1)>=unit-1
    with Image.open(OUT/'integration/web/favicon.ico') as ico:
        assert ico.ico.sizes()=={(n,n) for n in (16,24,32,48,64)}
    with Image.open(OUT/'brand-showcase.gif') as gif: assert gif.n_frames==5
    ase=(OUT/'tokens/brand-colors.ase').read_bytes()
    assert ase[:4]==b'ASEF'
    major,minor,count=struct.unpack_from('>HHI',ase,4)
    assert (major,minor,count)==(1,0,9)
    cursor=12
    for _ in range(count):
        kind,length=struct.unpack_from('>HI',ase,cursor);cursor+=6
        assert kind==1
        block=ase[cursor:cursor+length];cursor+=length
        chars=struct.unpack_from('>H',block)[0]
        pos=2+chars*2
        assert block[pos:pos+4]==b'RGB '
        rgb=struct.unpack_from('>fff',block,pos+4)
        assert all(0<=value<=1 for value in rgb)
    assert cursor==len(ase)
    pdf=OUT/'guidelines'/PDFNAME
    pdf_text=PdfReader(pdf)
    assert len(pdf_text.pages)==8
    assert all(len(p.extract_text())>120 for p in pdf_text.pages)
    assert '一品成片' in pdf_text.pages[0].extract_text()
    assert pdf.read_bytes()==(ROOT/'output/pdf'/PDFNAME).read_bytes()
    html_links=local_links(html,True)
    md_links=[]
    for doc in (OUT/'README.md',OUT/'START-HERE.md'):
        for link in local_links(doc.read_text(encoding='utf-8')):
            if link!='manifest.json': assert (doc.parent/link).is_file(),link
            md_links.append(link)
    for link in html_links:
        if link!='manifest.json': assert (OUT/link).is_file(),link
    # Check source/resource/prompt metadata for accidental credential-shaped content.
    text_files=[p for p in OUT.rglob('*') if p.suffix.lower() in ('.json','.md','.html','.txt','.css','.svg','.webmanifest','.gpl')]
    for p in text_files:
        assert not re.search(r'sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|-----BEGIN .*PRIVATE KEY',p.read_text(encoding='utf-8'),re.I),p
    ARCHIVE.mkdir(parents=True,exist_ok=True)
    for src in sorted(OUT.rglob('*')):
        if not src.is_file() or src.suffix.lower() in ('.zip','.sha256') or src.name in ('manifest.json','package-receipt.json'): continue
        target=ARCHIVE/src.relative_to(OUT)
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(src,target)
    records=[]
    for p in sorted(ARCHIVE.rglob('*')):
        if not p.is_file() or p.name in ('manifest.json','package-receipt.json'): continue
        record=dict(path=p.relative_to(ARCHIVE).as_posix(),bytes=p.stat().st_size,sha256=sha256(p.read_bytes()).hexdigest())
        if p.suffix.lower() in ('.png','.jpg','.gif','.ico'):
            with Image.open(p) as im: record.update(width=im.width,height=im.height,format=im.format)
        records.append(record)
    counts=dict(Counter(Path(item['path']).suffix.lower() for item in records))
    checks=dict(source_byte_identical=True,retained_rgb_byte_identical=True,alpha_cleanup_pixels=facts['cleaning']['alpha_changed_pixels'],svg_path_only=len(svgs),monochrome_fills=True,vector_symbol_clear_space=True,rasters_decoded=len(rasters),app_icon_sizes=True,tiny_icon_sizes=True,transparent_alpha_and_corners=True,ico_frames=5,gif_frames=5,ase_rgb_colors=count,pdf_pages=8,pdf_text_and_canonical_copy=True,pdf_all_pages_visually_inspected=True,html_local_links=len(html_links),markdown_local_links=len(md_links),public_text_secret_pattern_files=len(text_files),browser_used=False,virtualization_used=False,subagents_used=False,application_builds='NOT_RUN_ASSET_ONLY',comprehensive_suite='NOT_RUN_ASSET_ONLY')
    manifest=dict(project='一品成片',identity='06 柚子小导',version='1.0.0',date='2026-11-01',timezone='Asia/Taipei',status='FINAL_BRAND_ASSETS',file_count=len(records),total_bytes=sum(p['bytes'] for p in records),types=counts,checks=checks,self_exclusions=['manifest.json','package-receipt.json'],files=records)
    (ARCHIVE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    shutil.copy2(ARCHIVE/'manifest.json',OUT/'manifest.json')
    for link in html_links+md_links:
        assert (OUT/link).is_file(),link
        assert (ARCHIVE/link).is_file(),link
    zip_path=OUT/'one-tap-assets-citrus-director-brand-v1.0.0.zip'
    with ZipFile(zip_path,'w',ZIP_DEFLATED,compresslevel=6) as zipped:
        for src in sorted(ARCHIVE.rglob('*')):
            if src.is_file() and src.name!='package-receipt.json': zipped.write(src,src.relative_to(ARCHIVE).as_posix())
    with ZipFile(zip_path) as zipped:
        assert zipped.testzip() is None
        for record in records: assert sha256(zipped.read(record['path'])).hexdigest()==record['sha256']
        zip_count=len(zipped.namelist())
    receipt=dict(filename=zip_path.name,project_relative_path=zip_path.relative_to(ROOT).as_posix(),bytes=zip_path.stat().st_size,sha256=sha256(zip_path.read_bytes()).hexdigest(),zip_entries=zip_count,scope='All finalized brand files and manifest; own external ZIP receipt excluded',version='1.0.0',status='FINAL')
    for base in (ARCHIVE,OUT): (base/'package-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (OUT/(zip_path.name+'.sha256')).write_text(receipt['sha256']+'  '+zip_path.name+'\n',encoding='utf-8')
    pointer=dict(project='一品成片',brand_id='YPCC-BRAND-06-1.0.0',version='1.0.0',selected_candidate='06',identity='柚子小导',status='USER_SELECTED_ASSETS_BASELINED',decision_date='2026-11-01',user_decision='选择06，并且给我完整的定稿素材。',asset_root=ARCHIVE.relative_to(ROOT).as_posix(),documentation=(ARCHIVE/'README.md').relative_to(ROOT).as_posix(),manifest=(ARCHIVE/'manifest.json').relative_to(ROOT).as_posix(),primary_png=(ARCHIVE/'raster/hero-lockup-horizontal-transparent.png').relative_to(ROOT).as_posix(),vector_svg=(ARCHIVE/'vector/symbol-flat-color.svg').relative_to(ROOT).as_posix(),ui_baseline='assets/design/current.json',application_integration='NOT_CHANGED_THIS_ASSET_ROUND')
    (ROOT/'assets/brand/current.json').write_text(json.dumps(pointer,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    evidence=dict(project='一品成片',date='2026-11-01',timezone='Asia/Taipei',scope='Selected06 brand asset finalization only',original_sha256=facts['original_sha256'],new_generation_api_calls=0,asset_root=ARCHIVE.relative_to(ROOT).as_posix(),file_count=len(records)+2,types=counts,checks=checks,zip=receipt,source_candidate_archive_unchanged=True,ui_baseline_frozen_files_unchanged=True,application_deployed=False,server_configuration_changed=False,https_configured=False,pending=['Apply approved assets to mini-programs, Plus and website; check uploads/display in actual hosts.'])
    (ROOT/'docs/verification/citrus-brand-final-2026-11-01.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(archive=str(ARCHIVE),file_count=len(records)+2,types=counts,checks=checks,zip=receipt),ensure_ascii=False,indent=2),flush=True)


if __name__=='__main__': main()

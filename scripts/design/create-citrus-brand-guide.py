"""Create the eight-page brand guide after building the approved logo assets.

Requires ReportLab, fontTools, Pillow. Render and inspect every final PDF page.
"""
from pathlib import Path
import shutil

from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont as PDFTTFont
from reportlab.lib.utils import ImageReader
from reportlab.lib.colors import HexColor
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/imagegen/2026-11-01-citrus-director-final'
TMP=ROOT/'runtime/tmp/pdfs/citrus-director-v1'
FONT=ROOT/'assets/resources/fonts/noto-sans-sc/NotoSansSC[wght].ttf'
W,H=960,680
INK='#263B32';CREAM='#FFFAEE';ORANGE='#FF9C4C';MINT='#CFE9D6'


def main():
    TMP.mkdir(parents=True,exist_ok=True)
    for name,weight in [('Regular',450),('Bold',750)]:
        target=TMP/f'NotoSansSC-{name}-brand-v2.ttf'
        if not target.exists():
            instance=instantiateVariableFont(TTFont(FONT),{'wght':weight},inplace=True)
            # Distinct PostScript names prevent PDF font caching from merging weights.
            changed_ids={1,2,4,6,16,17}
            instance['name'].names=[n for n in instance['name'].names if n.nameID not in changed_ids]
            names={1:'YPCC Brand Sans',2:name,4:'YPCC Brand Sans '+name,6:'YPCCBrandSans-'+name,16:'YPCC Brand Sans',17:name}
            for ident,value in names.items():
                instance['name'].setName(value,ident,3,1,0x409)
                instance['name'].setName(value,ident,1,0,0)
            instance['OS/2'].usWeightClass=weight
            instance.save(target)
        pdfmetrics.registerFont(PDFTTFont(name,str(target)))
    pdf=ROOT/'output/pdf/一品成片-柚子小导-品牌手册-v1.0.pdf'
    pdf.parent.mkdir(parents=True,exist_ok=True)
    c=canvas.Canvas(str(pdf),pagesize=(W,H),pageCompression=1)
    c.setTitle('一品成片 - 柚子小导品牌标志手册 v1.0.0')
    c.setAuthor('One Tap Assets / 一品成片')
    c.setSubject('Approved logo 06, color, vector, monochrome, spacing and launch assets')

    def rect(x,y,w,h,fill,radius=0,stroke=None):
        c.setFillColor(HexColor(fill))
        if stroke: c.setStrokeColor(HexColor(stroke))
        if radius: c.roundRect(x,H-y-h,w,h,radius,fill=1,stroke=1 if stroke else 0)
        else: c.rect(x,H-y-h,w,h,fill=1,stroke=1 if stroke else 0)

    def text(x,y,value,size=14,bold=False,color=INK):
        c.setFont('Bold' if bold else 'Regular',size)
        c.setFillColor(HexColor(color))
        c.drawString(x,H-y,value)

    def paragraph(x,y,value,width,size=14,color=INK,leading=None,bold=False):
        lines=[];line='';face='Bold' if bold else 'Regular'
        for char in value:
            if char=='\n': lines.append(line);line='';continue
            if line and pdfmetrics.stringWidth(line+char,face,size)>width:
                lines.append(line);line=char
            else: line+=char
        if line: lines.append(line)
        for n,line in enumerate(lines): text(x,y+n*(leading or size*1.65),line,size,bold,color)
        return y+len(lines)*(leading or size*1.65)

    def pic(path,x,y,w,h):
        image=Image.open(OUT/path).convert('RGBA')
        c.drawImage(ImageReader(image),x,H-y-h,w,h,preserveAspectRatio=True,anchor='c',mask='auto')

    def start(number,title,kicker):
        rect(0,0,W,H,CREAM)
        text(52,35,'ONE TAP ASSETS  /  BRAND IDENTITY',10,True,color='#647169')
        text(52,89,title,31,True)
        text(54,119,kicker,12,color='#647169')
        c.setStrokeColor(HexColor('#D8E0D8'));c.setLineWidth(.6)
        c.line(52,38,W-52,38)
        text(52,H-21,'一品成片 · 柚子小导 / v1.0.0 / 2026.11.01',9,color='#647169')
        text(W-85,H-21,f'{number:02d} / 08',9,color='#647169')

    def finish(): c.showPage()

    # 1 - Cover.
    start(1,'','')
    text(60,237,'一品成片',68,True)
    text(65,294,'品牌标志定稿手册',27,True)
    text(66,340,'06 柚子小导  /  Citrus Director',17)
    text(66,382,'拍下商品，成套表达。',21)
    rect(66,425,82,7,ORANGE,3)
    pic('raster/symbol-color-transparent-1024.png',500,133,400,400)
    paragraph(66,562,'用户已选定06方向。本手册与随包文件共同构成品牌资产 v1.0.0，用于小程序、Plus、网页与上线传播。',806,15)
    finish()

    # 2 - Primary mark and distinct vector representation.
    start(2,'一个角色，两类生产文件','原始质感形象用于主要展示；扁平矢量版用于缩放、印刷和受限场景。')
    rect(52,152,536,330,'#FFFFFF',20)
    pic('raster/hero-lockup-horizontal-transparent.png',65,220,510,153)
    text(77,449,'主标志 / 彩色质感版',17,True)
    rect(610,152,298,330,'#FFFFFF',20)
    pic('raster/symbol-flat-color.png',650,163,220,220)
    text(634,449,'扁平矢量版',17,True)
    paragraph(57,526,'识别锚点：一片叶子、温暖果橙机身、深绿播放窗口、友善表情和右侧镜头。两类文件保持角色语义一致；不要互相叠加或拼成新标志。',839,15)
    paragraph(57,593,'源图为1254×1254。2048版属于放大导出；需要任意尺寸或印刷时使用真正路径SVG。',839,12,color='#647169')
    finish()

    # 3 - Color / typography.
    start(3,'配色与品牌文字','标志使用果橙、深绿墨、薄荷绿和奶白；颜色均按sRGB定义。')
    colors=[('果橙',ORANGE,'255 / 156 / 76'),('深绿墨',INK,'38 / 59 / 50'),('薄荷绿',MINT,'207 / 233 / 214'),('奶白',CREAM,'255 / 250 / 238')]
    for i,(name,value,rgb) in enumerate(colors):
        x=52+i*219
        rect(x,163,200,154,value,16,stroke='#D8E0D8' if name=='奶白' else None)
        fg='#FFFFFF' if name=='深绿墨' else INK
        text(x+18,205,name,18,True,fg)
        text(x+18,244,value,15,False,fg)
        text(x+18,282,'RGB '+rgb,10,False,fg)
    text(58,379,'一品成片',49,True)
    text(61,420,'ONE TAP ASSETS',21)
    paragraph(490,371,'中文字标：一品成片\n英文字标：ONE TAP ASSETS\n标准字：Noto Sans SC。中文750字重，英文与说明450字重。\n矢量组合已转路径，可独立使用。',397,14)
    paragraph(58,505,'主传播语：拍下商品，成套表达。\n辅助传播语：让好商品，被好好看见。\n使用深绿文字配奶白背景；橙色更适合图形和强调，不作为小号浅底正文颜色。',835,15)
    text(58,607,'UI已有动作橙#FF7948保持独立；品牌色文件不自动覆盖C界面tokens。印刷以打样确认颜色。',11,color='#647169')
    finish()

    # 4 - Monochrome / reverse.
    start(4,'单色、反白与横竖组合','使用随包的独立版本，不对彩色PNG直接套滤镜。')
    for i,(mode,bg,labelname) in enumerate([('ink',CREAM,'深绿单色'),('white',INK,'纯白反白'),('black','#FFFFFF','纯黑单色'),('orange','#FFFFFF','果橙单色')]):
        x=52+i*219
        rect(x,155,200,250,bg,18)
        pic(f'raster/symbol-flat-{mode}.png',x+15,162,170,170)
        text(x+22,377,labelname,13,True,'#FFFFFF' if mode=='white' else INK)
    rect(52,432,536,168,'#FFFFFF',18)
    pic('raster/lockup-horizontal-ink.png',60,439,518,154)
    rect(610,432,298,168,INK,18)
    pic('raster/lockup-horizontal-white.png',619,456,280,96)
    text(623,581,'深底使用白色字标和反白符号',10,color='#FFFFFF')
    finish()

    # 5 - Clear space and minimums.
    start(5,'留白与最小尺寸','留白随图形一起缩放；小尺寸使用专用简化稿。')
    flat=Image.open(OUT/'raster/symbol-flat-color.png').convert('RGBA')
    tight=flat.crop(flat.getbbox())
    rect(63,167,414,377,'#FFFFFF',18)
    extent=230;u=extent/8
    scale=extent/max(tight.size)
    rw,rh=tight.width*scale,tight.height*scale
    x=145;y=245
    c.drawImage(ImageReader(tight),x,H-y-rh,rw,rh,mask='auto')
    c.setStrokeColor(HexColor(ORANGE));c.setDash(5,4);c.setLineWidth(1)
    c.rect(x-u,H-y-rh-u,rw+u*2,rh+u*2,stroke=1,fill=0)
    c.setDash();c.setStrokeColor(HexColor('#D8E0D8'))
    c.rect(x,H-y-rh,rw,rh,stroke=1,fill=0)
    text(100,196,'u = 图形最长可见边 / 8',13,True)
    text(100,523,'四周至少保留u；不得贴边或放入干扰元素。',11)
    paragraph(520,191,'设计使用下限',348,21,bold=True)
    specs=[('彩色质感图形','至少64px'),('标准扁平图形','至少32px'),('专用favicon简化图','16px起'),('带英文横版组合','至少240px宽'),('仅中文横版组合','至少160px宽'),('扁平印刷图形','至少12mm')]
    for i,(labelname,value) in enumerate(specs):
        top=247+i*43
        text(521,top,labelname,14)
        text(772,top,value,13,True)
    paragraph(522,535,'避免拉伸、旋转、替换叶子/表情、描边发光、低对比叠加或在主体上压文字。16/24/32px专用稿省略面部细节，保留叶子和播放窗口。',350,12)
    finish()

    # 6 - Launch channel assets.
    start(6,'上线与传播素材','按版位选择文件；这些是品牌物料，不是已上线页面或平台审核证明。')
    rect(52,154,527,307,'#FFFFFF',18)
    pic('launch/social-cover-1200x630.png',63,169,505,265)
    text(73,447,'横版分享封面 / 1200×630',12,True)
    rect(599,154,171,397,'#FFFFFF',18)
    pic('launch/portrait-poster-1080x1920.png',607,164,155,276)
    text(615,484,'竖版品牌海报',11,True)
    text(615,507,'1080×1920',11)
    rect(789,154,119,397,'#FFFFFF',18)
    pic('icons/app/cream/icon-256.png',797,173,103,103)
    paragraph(801,311,'小程序\n与头像\n图标',91,14,bold=True)
    paragraph(57,515,'还提供1080×1080方图、1920×640横幅、1200×960分享卡、透明片尾标记，以及奶白/纯白/深绿背景图标。具体上传尺寸以当次平台表单为准。',518,13)
    finish()

    # 7 - File routing.
    start(7,'找到该用的文件','推荐入口在START-HERE.md；全部版本均可从离线页面直接查看。')
    rows=[
        ('官网与Plus页眉','raster/hero-lockup-horizontal-transparent.png'),
        ('主标志透明底','raster/symbol-color-transparent-1024.png'),
        ('小程序图标','icons/app/cream/icon-512.png'),
        ('网页favicon','integration/web/favicon.ico + favicon.svg'),
        ('印刷 / 任意缩放','vector/symbol-flat-color.svg'),
        ('深底反白','vector/lockup-horizontal-white.svg'),
        ('单色制作','vector/symbol-flat-ink.svg 或 -black.svg'),
        ('颜色工具导入','tokens/brand-colors.ase / .css / .json'),
        ('宣传与分享','launch/ 目录'),
    ]
    for i,(purpose,path) in enumerate(rows):
        y=161+i*44
        rect(52,y,856,39,'#FFFFFF' if i%2==0 else '#F4F0E4',8)
        text(67,y+25,purpose,12,True)
        text(280,y+25,path,11)
    paragraph(58,594,'SVG图形和字标均为真实路径；没有外链图片或字体。PNG透明稿用于数字排版，不能把放大PNG当作原生矢量文件。',841,12)
    finish()

    # 8 - Provenance, decisions and handover.
    start(8,'定稿记录与交付边界','本轮完成品牌素材定稿；应用页面接入可以继续使用此版本。')
    text(60,187,'选择记录',18,True)
    paragraph(60,222,'2026-11-01，用户明确选择06“柚子小导”。当前品牌资产版本为1.0.0，后续修订新建版本。原十款候选与C界面设计稿作为历史参照保留。',835,15)
    text(60,312,'图形与字体来源',18,True)
    paragraph(60,347,'主图源自本会话指定的sub2-image-gen / gpt-image-2.5生成流程。原始PNG完整留存，透明边缘仅清理孤立极低透明度杂点。扁平矢量是依据选定角色制作的独立路径稿。Noto Sans SC使用OFL许可，许可和来源随包保存。',835,14)
    text(60,461,'交付与校验',18,True)
    paragraph(60,496,'完整包包含原图、透明PNG、真矢量SVG、横竖字标、单色/反白、大小图标、上线物料、颜色文件、离线浏览和本手册。文件清单记录SHA256，ZIP校验值由独立回执记录。',835,14)
    paragraph(60,598,'没有更改服务器协议或启用真实交易；本手册不等同于宿主真机验证或平台审核通过。',835,11,color='#647169')
    finish()
    c.save()
    shutil.copy2(pdf,OUT/'guidelines'/pdf.name)
    print(f'Created 8-page guide: {pdf}',flush=True)


if __name__=='__main__': main()

"""Build the approved 06 Citrus Director identity from its archived source.

Native Python only: Pillow, NumPy, SciPy, fontTools, CairoSVG. No generation API.
The raster source is preserved; flat SVGs are an explicitly separate vector redraw.
Run from the project root. Outputs remain inside this project.
"""
from pathlib import Path
from functools import lru_cache
from hashlib import sha256
from html import escape
import json
import shutil
import struct

import numpy as np
from scipy.ndimage import label, binary_dilation
from PIL import Image, ImageDraw, ImageFont, ImageOps
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import cairosvg

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/imagegen/2026-11-01-citrus-director-final'
ARCHIVE=ROOT/'assets/brand/citrus-director/v1.0.0'
SOURCE=ROOT/'assets/design/logo-candidates/2026-11-01/06-citrus-director'
FONT=ROOT/'assets/resources/fonts/noto-sans-sc/NotoSansSC[wght].ttf'
COLORS=dict(orange='#FF9C4C',orange_shadow='#F28B39',ink='#263B32',mint='#CFE9D6',leaf='#76A983',cream='#FFFAEE',white='#FFFFFF',black='#000000',ui_orange='#FF7948')
LANCZOS=Image.Resampling.LANCZOS


def ensure(path):
    path.parent.mkdir(parents=True,exist_ok=True)
    return path


def save(im,path):
    im.save(ensure(OUT/path),optimize=True)


@lru_cache(maxsize=64)
def font(size,bold=False):
    value=ImageFont.truetype(str(FONT),size)
    value.set_variation_by_axes([750 if bold else 450])
    return value


def draw_text(im,xy,value,size=32,color='#263B32',bold=False,anchor=None):
    ImageDraw.Draw(im).text(xy,value,font=font(size,bold),fill=color,anchor=anchor)


def composite(im,bg):
    result=Image.new('RGBA',im.size,bg)
    result.alpha_composite(im.convert('RGBA'))
    return result.convert('RGB')


def glyph_path(text,size,x,baseline,weight=750):
    glyphs=TYPEFACE.getGlyphSet(location={'wght':weight})
    cmap=TYPEFACE.getBestCmap()
    units=TYPEFACE['head'].unitsPerEm
    scale=size/units
    pieces=[]
    for char in text:
        name=cmap[ord(char)]
        pen=SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(pen,(scale,0,0,-scale,x,baseline)))
        pieces.append(pen.getCommands())
        x+=glyphs[name].width*scale
    return ''.join(pieces)


def outlined_text(text,size,x,baseline,color,weight=750):
    return f'<path fill="{color}" d="{glyph_path(text,size,x,baseline,weight)}"/>'


def advance(text,size,weight=450):
    glyphs=TYPEFACE.getGlyphSet(location={'wght':weight})
    cmap=TYPEFACE.getBestCmap()
    return sum(glyphs[cmap[ord(char)]].width for char in text)*size/TYPEFACE['head'].unitsPerEm


BODY='M465 312C303 312 188 405 178 557L174 708C172 815 245 869 379 872L617 872C721 872 777 827 779 737L779 563C774 405 648 312 465 312Z'
LENS='M758 553L889 466Q930 440 938 482L938 742Q937 787 900 770L765 696Z'
LEAF='M531 325C415 322 338 253 351 176C364 118 488 141 551 190C584 220 584 279 549 324Z'
BELLY='M375 520H610Q685 520 685 595V745Q685 820 610 820H375Q300 820 300 745V595Q300 520 375 520Z'
PLAY='M454 583Q438 574 438 596V744Q438 763 455 753L564 689Q582 678 564 667Z'
EYES='M394 441A25 25 0 1 0 344 441A25 25 0 1 0 394 441ZM640 441A25 25 0 1 0 590 441A25 25 0 1 0 640 441Z'
SMILE='M455 453C460 439 470 446 478 456Q493 469 507 455C516 443 525 446 529 457C526 488 474 499 455 466Z'


def mascot(mode='color',tiny=False):
    color=COLORS.get(mode,mode)
    if mode=='color':
        out=f'<path fill="{COLORS["orange_shadow"]}" d="{LENS}"/><path fill="{COLORS["mint"]}" d="{LEAF}"/>'
        if not tiny: out+=f'<path d="M399 182Q510 210 541 308" fill="none" stroke="{COLORS["leaf"]}" stroke-width="14" stroke-linecap="round"/>'
        out+=f'<path fill="{COLORS["orange"]}" d="{BODY}"/><path fill="{COLORS["ink"]}" d="{BELLY}"/><path fill="{COLORS["cream"]}" d="{PLAY}"/>'
        if not tiny: out+=f'<path fill="{COLORS["ink"]}" d="{EYES}{SMILE}"/>'
        return out
    return f'<path fill="{color}" d="{LENS}{LEAF}"/><path fill="{color}" fill-rule="evenodd" d="{BODY}{BELLY}{EYES}{SMILE}"/><path fill="{color}" d="{PLAY}"/>'


def svg_document(body,width=1024,height=1024,title='一品成片 - 柚子小导'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img" aria-label="{escape(title)}"><title>{escape(title)}</title>{body}</svg>\n'


def centered_mascot(mode='color',tiny=False):
    # Center the visible silhouette in its square and preserve >=1/8 clear space.
    return '<g transform="translate(-44 0)">'+mascot(mode,tiny)+'</g>'


def svg_export(name,body,width=1024,height=1024,render_width=None):
    source=svg_document(body,width,height)
    target=ensure(OUT/f'vector/{name}.svg')
    target.write_text(source,encoding='utf-8')
    png=ensure(OUT/f'raster/{name}.png')
    cairosvg.svg2png(bytestring=source.encode(),write_to=str(png),output_width=render_width or width)
    return Image.open(png).convert('RGBA')


def hero_canvas(size):
    result=Image.new('RGBA',(size,size),(0,0,0,0))
    placed=ImageOps.contain(HERO_CROP,(round(size*.8),round(size*.8)),LANCZOS)
    result.alpha_composite(placed,((size-placed.width)//2,(size-placed.height)//2))
    return result


def make_hero_lockup(vertical=False,dark=False):
    ink=COLORS['white'] if dark else COLORS['ink']
    if vertical:
        im=Image.new('RGBA',(1200,1500),(0,0,0,0))
        im.alpha_composite(hero_canvas(1130),(35,10))
        draw_text(im,(600,1216),'一品成片',146,ink,True,'mm')
        draw_text(im,(600,1360),'ONE TAP ASSETS',40,ink,False,'mm')
    else:
        im=Image.new('RGBA',(2400,720),(0,0,0,0))
        im.alpha_composite(hero_canvas(700),(0,10))
        draw_text(im,(752,147),'一品成片',252,ink,True)
        draw_text(im,(767,468),'ONE TAP ASSETS',58,ink)
    return im


def panel_title(im,title,sub):
    draw_text(im,(72,44),title,48,bold=True)
    draw_text(im,(75,113),sub,23,color='#647169')


def make_launch_assets():
    og=Image.new('RGB',(1200,630),COLORS['cream'])
    og.paste(composite(hero_canvas(490),COLORS['cream']),(38,93))
    draw_text(og,(553,176),'一品成片',98,bold=True)
    draw_text(og,(562,310),'ONE TAP ASSETS',26)
    draw_text(og,(560,405),'拍下商品，成套表达。',32)
    draw_text(og,(562,542),'商品拍照 · 风格预设 · 成套素材',19,color='#5A6A61')
    save(og,'launch/social-cover-1200x630.png')
    og.save(ensure(OUT/'launch/social-cover-1200x630.jpg'),quality=95,subsampling=0)
    square=Image.new('RGB',(1080,1080),COLORS['cream'])
    square.paste(composite(hero_canvas(740),COLORS['cream']),(170,42))
    draw_text(square,(540,818),'一品成片',115,bold=True,anchor='mm')
    draw_text(square,(540,930),'拍下商品，成套表达。',33,anchor='mm')
    save(square,'launch/square-poster-1080x1080.png')
    portrait=Image.new('RGB',(1080,1920),COLORS['cream'])
    draw_text(portrait,(96,111),'一品成片',76,bold=True)
    draw_text(portrait,(101,222),'ONE TAP ASSETS',26)
    draw_text(portrait,(95,375),'让好商品，',98,bold=True)
    draw_text(portrait,(95,519),'被好好看见。',98,bold=True)
    portrait.paste(composite(hero_canvas(1000),COLORS['cream']),(40,650))
    draw_text(portrait,(540,1694),'拍下商品，成套表达。',46,bold=True,anchor='mm')
    draw_text(portrait,(540,1795),'商品拍照 · 风格预设 · 成套素材',27,anchor='mm')
    save(portrait,'launch/portrait-poster-1080x1920.png')
    header=Image.new('RGB',(1920,640),COLORS['cream'])
    header.paste(composite(hero_canvas(590),COLORS['cream']),(92,20))
    draw_text(header,(790,166),'一品成片',160,bold=True)
    draw_text(header,(803,391),'拍下商品，成套表达。',39)
    save(header,'launch/site-banner-1920x640.png')
    card=Image.new('RGB',(1200,960),COLORS['cream'])
    card.paste(composite(hero_canvas(660),COLORS['cream']),(270,28))
    draw_text(card,(600,735),'一品成片',115,bold=True,anchor='mm')
    draw_text(card,(600,855),'拍下商品，成套表达。',33,anchor='mm')
    save(card,'launch/share-card-1200x960.png')
    watermark=make_hero_lockup().resize((800,240),LANCZOS)
    save(watermark,'launch/video-endmark-transparent-800x240.png')


def make_board():
    board=Image.new('RGB',(2200,1600),'#F3F2EB')
    panel_title(board,'一品成片 · 柚子小导','06 方向正式定稿  /  BRAND IDENTITY 1.0.0  /  2026.11.01')
    d=ImageDraw.Draw(board)
    d.rounded_rectangle((60,182,1372,790),30,fill=COLORS['cream'])
    board.paste(composite(make_hero_lockup().resize((1260,378),LANCZOS),COLORS['cream']),(83,270))
    draw_text(board,(99,725),'主标志 · 彩色质感版',23)
    d.rounded_rectangle((1400,182,2140,790),30,fill=COLORS['cream'])
    flat=Image.open(OUT/'raster/symbol-flat-color.png').convert('RGBA')
    board.paste(composite(flat.resize((510,510),LANCZOS),COLORS['cream']),(1515,203))
    draw_text(board,(1444,725),'扁平矢量版 · 可无限缩放',23)
    for i,(mode,bg,ink) in enumerate([('ink','#FFFAEE','#263B32'),('white','#263B32','#FFFFFF'),('orange','#FFFFFF','#FF9C4C')]):
        x=60+i*450
        d.rounded_rectangle((x,820,x+420,1270),28,fill=bg)
        mono=Image.open(OUT/f'raster/symbol-flat-{mode}.png').convert('RGBA').resize((340,340),LANCZOS)
        board.paste(composite(mono,bg),(x+40,842))
        draw_text(board,(x+42,1210),{'ink':'深绿单色','white':'纯白反白','orange':'果橙单色'}[mode],24,ink)
    d.rounded_rectangle((1430,820,2140,1270),28,fill=COLORS['white'])
    avatar=Image.open(OUT/'icons/app/cream/icon-256.png')
    board.paste(avatar.resize((265,265),LANCZOS),(1460,866))
    draw_text(board,(1754,898),'小程序图标',27,bold=True)
    draw_text(board,(1754,955),'透明底 / 矢量',22)
    draw_text(board,(1754,1001),'横版 / 竖版',22)
    draw_text(board,(1754,1047),'单色 / 反白',22)
    draw_text(board,(1754,1093),'社交 / 分享',22)
    draw_text(board,(1470,1210),'源图、图标与规范完整留档',24)
    for i,key in enumerate(('orange','ink','mint','cream')):
        x=60+i*525
        d.rounded_rectangle((x,1325,x+490,1450),22,fill=COLORS[key])
        color=COLORS['white'] if key=='ink' else COLORS['ink']
        draw_text(board,(x+28,1358),{'orange':'果橙','ink':'深绿墨','mint':'薄荷绿','cream':'奶白'}[key],25,color,True)
        draw_text(board,(x+28,1400),COLORS[key],21,color)
    draw_text(board,(66,1515),'ONE TAP ASSETS  /  正式品牌资产 · 主标志与矢量应用版分别留存',23,color='#647169')
    save(board,'brand-overview.png')
    save(board.resize((1100,800),LANCZOS),'brand-overview-web.png')


def main():
    global HERO_CROP,TYPEFACE
    for folder in ('source','master','vector','raster','icons/app/cream','icons/app/white','icons/app/dark','icons/small','integration/web','launch','guidelines','tokens'):
        (OUT/folder).mkdir(parents=True,exist_ok=True)
    TYPEFACE=TTFont(FONT)
    shutil.copy2(SOURCE/'source.png',OUT/'source/06-citrus-director-original.png')
    shutil.copy2(SOURCE/'prompt.txt',OUT/'source/original-prompt.txt')
    original=Image.open(SOURCE/'source.png').convert('RGBA')
    rgba=np.array(original)
    alpha=rgba[:,:,3].copy()
    regions,n=label(alpha>16)
    sizes=np.bincount(regions.ravel());sizes[0]=0
    main_region=regions==int(sizes.argmax())
    support=binary_dilation(main_region,iterations=3)
    updated=np.where(support & (alpha>=3),alpha,0).astype('uint8')
    rgba[:,:,3]=updated
    clean=Image.fromarray(rgba)
    save(clean,'master/symbol-color-native-transparent-1254.png')
    HERO_CROP=clean.crop(clean.getbbox())
    save(HERO_CROP,'master/symbol-color-tight-native.png')
    print('Preserved source and cleaned isolated near-transparent edge specks.',flush=True)
    for size in (2048,1024,512,256):
        save(hero_canvas(size),f'raster/symbol-color-transparent-{size}.png')
    for bg in ('cream','white','ink'):
        save(composite(hero_canvas(1024),COLORS[bg]),f'raster/symbol-color-{bg}-1024.png')
    for mode in ('color','ink','white','black','orange'):
        symbol=centered_mascot(mode)
        svg_export('symbol-flat-'+mode,symbol)
        color=COLORS['ink'] if mode=='color' else COLORS.get(mode,mode)
        for vertical in (False,True):
            if vertical:
                parts=f'<g transform="translate(20 0) scale(.94)">{symbol}</g>'
                parts+=outlined_text('一品成片',170,172,1120,color)
                parts+=outlined_text('ONE TAP ASSETS',38,(1024-advance('ONE TAP ASSETS',38))/2,1225,color,450)
                svg_export('lockup-vertical-'+mode,parts,1024,1340)
            else:
                parts=f'<g transform="translate(0 -10) scale(.46)">{symbol}</g>'
                parts+=outlined_text('一品成片',190,500,287,color)
                parts+=outlined_text('ONE TAP ASSETS',36,507,362,color,450)
                svg_export('lockup-horizontal-'+mode,parts,1450,480,render_width=2400)
                zh=f'<g transform="translate(0 -10) scale(.46)">{symbol}</g>'+outlined_text('一品成片',190,500,320,color)
                svg_export('lockup-horizontal-zh-'+mode,zh,1450,480,render_width=2400)
    small_svg=svg_document(centered_mascot('color',tiny=True))
    (OUT/'vector/symbol-small.svg').write_text(small_svg,encoding='utf-8')
    for size in (16,24,32,48,64,96,128):
        content=small_svg if size<=32 else svg_document(centered_mascot('color'))
        png=cairosvg.svg2png(bytestring=content.encode(),output_width=size,output_height=size)
        import io
        im=Image.open(io.BytesIO(png)).convert('RGBA')
        save(im,f'icons/small/symbol-{size}.png')
        save(composite(im,COLORS['cream']),f'icons/small/icon-{size}.png')
    for bgname,bg in [('cream',COLORS['cream']),('white',COLORS['white']),('dark',COLORS['ink'])]:
        for size in (1024,512,256,192,180,128):
            save(composite(hero_canvas(size),bg),f'icons/app/{bgname}/icon-{size}.png')
    for vertical in (False,True):
        shape='vertical' if vertical else 'horizontal'
        light=make_hero_lockup(vertical)
        dark=make_hero_lockup(vertical,True)
        save(light,f'raster/hero-lockup-{shape}-transparent.png')
        save(composite(light,COLORS['cream']),f'raster/hero-lockup-{shape}-cream.png')
        save(composite(light,COLORS['white']),f'raster/hero-lockup-{shape}-white.png')
        save(composite(dark,COLORS['ink']),f'raster/hero-lockup-{shape}-dark.png')
        save(dark,f'raster/hero-lockup-{shape}-reverse-transparent.png')
    web=OUT/'integration/web'
    for size in (192,512): shutil.copy2(OUT/f'icons/app/cream/icon-{size}.png',web/f'web-app-icon-{size}.png')
    shutil.copy2(OUT/'icons/app/cream/icon-180.png',web/'apple-touch-icon.png')
    (web/'favicon.svg').write_text(small_svg,encoding='utf-8')
    import io
    favicon=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=small_svg.encode(),output_width=128,output_height=128))).convert('RGBA')
    favicon=composite(favicon,COLORS['cream'])
    favicon.save(web/'favicon.ico',format='ICO',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64)])
    manifest=dict(name='一品成片',short_name='一品成片',description='拍下商品，成套表达。',lang='zh-CN',start_url='/',scope='/',display='standalone',background_color=COLORS['cream'],theme_color=COLORS['orange'],icons=[dict(src=f'web-app-icon-{n}.png',sizes=f'{n}x{n}',type='image/png',purpose='any') for n in (192,512)])
    (web/'site.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (web/'head-snippet.html').write_text('''<!-- Brand assets only. Copy this folder under your own static /brand/ path. -->
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="alternate icon" href="/brand/favicon.ico">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<link rel="manifest" href="/brand/site.webmanifest">
<meta name="theme-color" content="#FF9C4C">
''',encoding='utf-8')
    palette=[]
    blocks=[]
    for name,value in COLORS.items():
        rgb=tuple(int(value[j:j+2],16) for j in (1,3,5))
        palette.append(dict(name=name,hex=value,rgb=list(rgb),space='sRGB'))
        color_name=(name+'\0').encode('utf-16-be')
        content=struct.pack('>H',len(name)+1)+color_name+b'RGB '+struct.pack('>fffH',*(v/255 for v in rgb),2)
        blocks.append(struct.pack('>HI',1,len(content))+content)
    (OUT/'tokens/brand-colors.ase').write_bytes(b'ASEF'+struct.pack('>HHI',1,0,len(blocks))+b''.join(blocks))
    (OUT/'tokens/brand-colors.json').write_text(json.dumps(dict(version='1.0.0',space='sRGB',colors=palette),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    css='/* One Tap Assets brand identity 06, v1.0.0. Explicit opt-in variables. */\n:root {\n'+''.join(f'  --ypcc-brand-{k.replace("_","-")}: {v};\n' for k,v in COLORS.items())+'}\n'
    (OUT/'tokens/brand-colors.css').write_text(css,encoding='utf-8')
    (OUT/'tokens/brand-colors.gpl').write_text('GIMP Palette\nName: One Tap Assets - Citrus Director\nColumns: 4\n# sRGB brand palette v1.0.0\n'+''.join(f'{p["rgb"][0]:3d} {p["rgb"][1]:3d} {p["rgb"][2]:3d}  {p["name"]}\n' for p in palette),encoding='utf-8')
    comparison=Image.new('RGB',(1480,330),COLORS['cream'])
    draw_text(comparison,(32,21),'小尺寸专用稿与标准扁平稿 / 实像素',23,bold=True)
    for i,size in enumerate((16,24,32,48,64,96,128)):
        im=Image.open(OUT/f'icons/small/icon-{size}.png').convert('RGB')
        x=40+i*204+(128-size)//2
        comparison.paste(im,(x,87+(128-size)//2))
        draw_text(comparison,(104+i*204,264),f'{size}px',20,anchor='mm')
    save(comparison,'guidelines/small-size-inspection.png')
    make_launch_assets()
    make_board()
    # Five actual final-asset cards form a simple showcase.
    slideshow=[]
    for name in ('brand-overview.png','launch/social-cover-1200x630.png','launch/square-poster-1080x1080.png','raster/hero-lockup-horizontal-cream.png','raster/hero-lockup-horizontal-dark.png'):
        image=Image.open(OUT/name).convert('RGB')
        canvas=Image.new('RGB',(960,640),COLORS['cream'])
        fitted=ImageOps.contain(image,(960,640),LANCZOS)
        canvas.paste(fitted,((960-fitted.width)//2,(640-fitted.height)//2))
        slideshow.append(canvas.quantize(colors=192,method=Image.Quantize.MEDIANCUT))
    slideshow[0].save(OUT/'brand-showcase.gif',save_all=True,append_images=slideshow[1:],duration=1900,loop=0,optimize=False,disposal=2)
    for name in ('OFL.txt','source.json'):
        shutil.copy2(FONT.parent/name,OUT/'source'/('font-'+name))
    facts=dict(project='一品成片',english_name='One Tap Assets',identity='柚子小导 / Citrus Director',version='1.0.0',selected_candidate='06',selected_by='User: 选择06，并且给我完整的定稿素材。',date='2026-11-01',timezone='Asia/Taipei',status='USER_SELECTED_BRAND_ASSET_BASELINE',source_model='gpt-image-2.5',source_skill='sub2-image-gen',original_sha256=sha256((SOURCE/'source.png').read_bytes()).hexdigest(),original_size=list(original.size),primary='Original soft shaded citrus-camera mascot; colors/shape preserved',vector='Separate flat vector redraw based on the selected mascot; true paths, outlined text, no embedded raster',colors=COLORS,ui_baseline='C 柚子创作社; logo brand tokens do not modify frozen UI tokens',cleaning=dict(method='Keep largest alpha>16 connected component plus 3-pixel antialias support; alpha<3 removed; RGB values inside retained geometry preserved',alpha_changed_pixels=int(np.count_nonzero(alpha!=updated)),original_alpha_bbox=list(original.getbbox()),clean_alpha_bbox=list(clean.getbbox())),resolution_note='Original 1254x1254 preserved; 2048 hero exports are resampled derivatives and do not add source detail. SVG flat artwork scales independently.',clear_space='u = maximum visible symbol dimension / 8; leave at least u clear space',minimums=dict(full_color_symbol_px=64,flat_color_symbol_px=32,tiny_favicon_px=16,bilingual_horizontal_px=240,zh_only_horizontal_px=160,flat_print_mm=12),deployed_to_application=False,https_changes=False)
    (OUT/'brand.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Brand artwork built at {OUT}',flush=True)


if __name__=='__main__': main()

"""Package separately generated Sub2API logo symbols; never calls a model.

Run from the project root after the ten source.png files exist:
    python -B -X utf8 scripts/design/package-logo-candidates.py
Requires Pillow. Uses the project's existing OFL-licensed Noto Sans SC font.
"""
from pathlib import Path
from datetime import datetime
from functools import lru_cache
import argparse
import json
import shutil

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
FONT = ROOT / 'assets/resources/fonts/noto-sans-sc/NotoSansSC[wght].ttf'
RESAMPLE = Image.Resampling.LANCZOS


@lru_cache(maxsize=64)
def font(size, bold=False):
    result = ImageFont.truetype(str(FONT), size)
    result.set_variation_by_axes([750 if bold else 450])
    return result


def centered(draw, xy, text, size, fill, bold=False):
    draw.text(xy, text, font=font(size, bold), fill=fill, anchor='mm')


def opaque_symbol(source, background, size):
    with Image.open(source) as original:
        layer = ImageOps.contain(original.convert('RGBA'), (size, size), RESAMPLE)
    result = Image.new('RGBA', (size, size), background)
    result.alpha_composite(layer, ((size-layer.width)//2, (size-layer.height)//2))
    return result.convert('RGB')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--batch',default='output/imagegen/2026-11-01-logo-candidates')
    parser.add_argument('--archive',default='assets/design/logo-candidates/2026-11-01')
    args = parser.parse_args()
    batch = (ROOT / args.batch).resolve()
    archive = (ROOT / args.archive).resolve()
    for path in (batch,archive):
        if not path.is_relative_to(ROOT):
            raise SystemExit('All inputs and outputs must remain in the project.')
    plan = json.loads((batch/'generation-plan.json').read_text(encoding='utf-8'))
    entries = plan['entries']
    if len(entries)!=10 or len({e['id'] for e in entries})!=10:
        raise SystemExit('Expected ten distinct logo candidates.')
    for entry in entries:
        with Image.open(batch/entry['source']) as im:
            im.verify()
    archive.mkdir(parents=True,exist_ok=True)
    frames=[]
    inspection=[]
    overview=Image.new('RGB',(2360,1390),'#F5F3EE')
    od=ImageDraw.Draw(overview)
    od.text((66,42),'一品成片',font=font(58,True),fill='#263B32')
    od.text((68,121),'10 款品牌标志提案  /  ONE TAP ASSETS',font=font(25),fill='#647169')
    od.text((2294,76),'2026.11.01',font=font(24),fill='#647169',anchor='rm')
    od.text((2294,121),'先选图形 · 再定品牌应用',font=font(24),fill='#647169',anchor='rm')
    for i,e in enumerate(entries):
        directory=f"{e['id']}-{e['slug']}"
        out=batch/directory
        source=out/'source.png'
        bg=e['background']
        ink=e['ink']
        with Image.open(source) as original:
            original.load()
            source_properties=dict(width=original.width,height=original.height,mode=original.mode,format=original.format,has_alpha='A' in original.getbands())
        symbol=opaque_symbol(source,bg,1024)
        for size in (1024,512,256,128,64,32):
            symbol.resize((size,size),RESAMPLE).save(out/f'icon-{size}.png',optimize=True)
        symbol.save(out/'favicon.ico',format='ICO',sizes=[(16,16),(32,32),(48,48),(64,64)])
        # Exact brand lettering is deterministic, not generated pseudo-characters.
        lockup=Image.new('RGB',(2048,640),bg)
        lockup.paste(symbol.resize((600,600),RESAMPLE),(18,20))
        ld=ImageDraw.Draw(lockup)
        ld.text((690,130),'一品成片',font=font(205,True),fill=ink)
        ld.text((702,416),'ONE TAP ASSETS',font=font(48),fill=ink)
        lockup.save(out/'wordmark-horizontal.png',optimize=True)
        vertical=Image.new('RGB',(1024,1280),bg)
        vertical.paste(symbol,(0,0))
        vd=ImageDraw.Draw(vertical)
        centered(vd,(512,1086),'一品成片',106,ink,True)
        centered(vd,(512,1193),'ONE TAP ASSETS',29,ink)
        vertical.save(out/'wordmark-vertical.png',optimize=True)
        preview=Image.new('RGB',(1440,960),'#F5F3EE')
        pd=ImageDraw.Draw(preview)
        pd.rounded_rectangle((40,40,1400,920),radius=30,fill=bg)
        pd.text((84,75),f"{e['id']}  {e['name']}",font=font(30,True),fill=ink)
        pd.text((1354,78),e['style'],font=font(24),fill=ink,anchor='ra')
        preview.paste(symbol.resize((650,650),RESAMPLE),(65,169))
        pd.text((754,280),'一品成片',font=font(122,True),fill=ink)
        pd.text((766,445),'ONE TAP ASSETS',font=font(27),fill=ink)
        pd.text((766,550),e['style'],font=font(39,True),fill=ink)
        pd.text((766,613),e['style_en'],font=font(22),fill=ink)
        for n,color in enumerate(e['palette']):
            pd.ellipse((768+n*53,682,800+n*53,714),fill=color,outline=ink,width=1)
        pd.text((87,865),'品牌候选方案 · 图形原图与规范字标分开保留',font=font(19),fill=ink)
        preview.save(out/'preview.png',optimize=True)
        # A real 32/48/64/128-pixel raster inspection board, not just a big mockup.
        small=Image.new('RGB',(960,260),bg)
        sd=ImageDraw.Draw(small)
        sd.text((24,19),f"{e['id']}  小尺寸实像素",font=font(19,True),fill=ink)
        for n,size in enumerate((32,48,64,128)):
            icon=symbol.resize((size,size),RESAMPLE)
            small.paste(icon,(90+n*225+(128-size)//2,65+(128-size)//2))
            centered(sd,(154+n*225,221),f'{size}px',18,ink)
        small.save(out/'small-sizes.png',optimize=True)
        inspection.append(small)
        x=66+(i%5)*450
        y=190+(i//5)*560
        od.rounded_rectangle((x,y,x+430,y+535),radius=22,fill=bg)
        tile=symbol.resize((390,390),RESAMPLE)
        overview.paste(tile,(x+20,y+4))
        centered(od,(x+215,y+395),'一品成片',36,ink,True)
        centered(od,(x+215,y+456),f"{e['id']}  {e['name']}",26,ink,True)
        centered(od,(x+215,y+499),e['style'],21,ink)
        frames.append(preview.resize((900,600),RESAMPLE).quantize(colors=192,method=Image.Quantize.MEDIANCUT))
        e.update(status='GENERATED_UNSELECTED',actual_source=source_properties,visual_inspection='REQUIRED_BEFORE_FINAL_DELIVERY',derivative_sizes=[1024,512,256,128,64,32],wordmark_font='Noto Sans SC, OFL-1.1, repository font',background_handling='Original preserved; existing alpha composited over specified background; square containment and Lanczos resizing; no vector tracing or inferred cutout')
        target=archive/directory
        target.mkdir(exist_ok=True)
        for p in sorted(out.iterdir()):
            if p.is_file(): shutil.copy2(p,target/p.name)
        print(f"Packaged {e['id']} {e['name']}; source {source_properties['width']}x{source_properties['height']} {source_properties['mode']}")
    od.text((68,1343),'LOGO CANDIDATES  /  图形：gpt-image-2.5 · 字标：规范字体排版 · 待选型',font=font(20),fill='#647169')
    overview.save(batch/'overview.png',optimize=True)
    overview.resize((1180,695),RESAMPLE).save(batch/'overview-web.png',optimize=True)
    frames[0].save(batch/'logo-showcase.gif',save_all=True,append_images=frames[1:],duration=1600,loop=0,optimize=False,disposal=2)
    checks=Image.new('RGB',(960,2600),'white')
    for i,small in enumerate(inspection): checks.paste(small,(0,i*260))
    checks.save(batch/'small-size-comparison.png',optimize=True)
    for name in ('overview.png','overview-web.png','logo-showcase.gif','small-size-comparison.png'):
        shutil.copy2(batch/name,archive/name)
    plan.update(status='TEN_GENERATED_CANDIDATES_AWAITING_USER_SELECTION',selection=None,existing_design_baseline='C 柚子创作社 remains the UI baseline',requested_size='1024x1024',source_size_note='Gateway returned actual dimensions recorded per source; original pixels preserved, icon derivatives normalized to named sizes.',generation_route='Each source generated by the unmodified sub2-image-gen/scripts/sub2_image_gen.py via its configured gateway; default gpt-image-2.5 model, high quality; no alternate provider.',packaging_script='scripts/design/package-logo-candidates.py',packaged_at=datetime.now().astimezone().isoformat())
    (archive/'candidates.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (batch/'candidates.json').write_bytes((archive/'candidates.json').read_bytes())
    print(f'Packaged ten candidates: {archive}')


if __name__=='__main__':
    main()

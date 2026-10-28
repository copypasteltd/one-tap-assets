"""Prepare five distinct mobile mini-program art directions for Sub2 image generation."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output/imagegen/2026-10-27-设计选型"

COMMON = """Create a polished high-fidelity UI DESIGN PRESENTATION BOARD, landscape 1536 x 1024, for a real Chinese merchant mini-program called 一品成片. This is an original product interface art direction, not an advertisement, not a website, not a dashboard. Design for small merchants who photograph a product, choose a preset from an official/community library, automatically receive a complete pack of images and a video, and save the files to their phone album. Core clients are Alipay and Douyin mini-programs; use a neutral original brand identity with a restrained native mini-program capsule at top right. No platform logos.

BOARD COMPOSITION: place THREE LARGE complete flat mobile app screens side by side, straight-on and parallel, equally scaled, approximately 390 x 844 each inside this landscape board, with slim gutters. Each screen must be readable, substantial, and cropped to nothing: include status bar, mini-program title/capsule, scroll content, bottom controls and safe area. No physical phones, no 3D perspective, no device mockup shadows, no desktop navigation. A slim top margin identifies the direction. Small external column captions say 拍照制作 / 方案社区 / 素材领取. Fill the board with actual usable interface design, not decorative moodboard swatches. All text should be clear simplified Chinese, with comfortable mobile sizes and strong hierarchy. Render exactly the short labels requested; do not generate paragraphs of tiny filler text.

COMMON CONTENT ACROSS ALL THREE SCREENS:
The fictional example product is a blue portable blender: a transparent cylindrical cup, a blue motor base and blue lid. Keep that blue product recognizably consistent in every photo, thumb and preview; photorealistic product imagery even in playful UI. It is an illustrative fictional SKU, no brand logos or made-up performance claims. Use tasteful sunlit counter/studio backgrounds for its product images; one AI life-scene variant may show it in a kitchen. Imagery must be crisp, refined and relevant to product advertising.

SCREEN 1 — HOME / TAKE PHOTOS. Header brand 一品成片. A strong headline 拍下商品，成套出片 and a concise support line 拍3–5张，自动识别商品与特点. A signature visual explains how a few product photos become an organized media pack. Show three photo thumbnails/slots labelled 整体 / 角度 / 细节, then the dominant button 拍照做素材. Below, a small section 试试这些方案 with a compact preview, not analytics. Bottom navigation 拍照制作 / 方案社区 / 我的素材, with the first active. There is no product information form, no prompt box, no manual editing timeline, no upload-video requirement.

SCREEN 2 — CHOOSE A PRESET. Header 方案社区. A compact recognized-product strip says 已识别：蓝色便携榨汁杯 with an optional quiet correction link 识别有误. Filter tabs 推荐 / 官方 / 社区, and a few compact style chips. Show visually rich preset cards, with meaningful typography, author badge and image/video counts. Include 清新日常 with 官方 and 4图 · 12秒, 轻奢细节 with 官方 and 5图 · 15秒, and at least one community preset 夏日快闪 with 社区作者 and 3图 · 8秒. Cards may feature the same blue blender in different creative scenes/layouts. Distinguish the 清新日常 AI scene version with AI场景 / AI演绎; selected card has a clear selection affordance. A bottom primary action 用这个方案 opens a later purchase confirmation, not an instant payment. No fake prices, fabricated usage statistics or popularity counts. Bottom nav has 方案社区 active. For an editorial direction, 2 larger cards plus part of the next card is acceptable; other directions can use a two-column gallery.

SCREEN 3 — COMPLETE MEDIA PACK. Header 我的素材 or 素材已就绪. Clear pack name 清新日常 and summary 4张图片 · 1条视频. A large 9:16 video-cover preview of the blue blender in a kitchen, with a play control, 00:12 and a discreet AI演绎 badge. Show four smaller images labelled 主图 / 角度 / 细节 / 海报, organized for easy checking. Include secondary action 复制文案 and a large fixed primary action 保存整套素材. Bottom navigation has 我的素材 active. No ZIP export, no technical controls, no forced sharing. This is a completed-state design, not a production screenshot or a claim of a live service.

PRODUCT USABILITY CONSTRAINTS: one dominant task per screen; large touch targets, legible contrast, comfortable spacing, clear active states. All five directions must keep these same core functions and texts, while expressing truly different layout/type/material/signature ideas. Do not put model names, API keys, engines, resolution registries, workflow nodes, server status or developer explanations in the interface. Avoid unsupported promises such as 秒出 or guaranteed free generation. No price figures at all. No made-up sales/efficacy facts. No giant generic camera icon floating in empty space. Do not turn it into a generic SaaS marketing landing page. Keep the actual blue product visually central.
"""

DESIGNS = [
    {
        "id": "A", "slug": "晴蓝工具箱", "name": "晴蓝工具箱", "positioning": "清晰、可信、低学习成本的商家工具",
        "palette": {"晴蓝": "#176FE6", "冰白": "#F1F8FF", "墨蓝": "#173149", "纯白": "#FFFFFF", "杏橙": "#FFAE62"},
        "type": {"display": "宽字面中粗黑体，强调动词", "body": "系统无衬线常规字重", "utility": "等宽数字和清晰的状态短标签"},
        "signature": "取景框连接三张商品照与一套有序素材，照片成为主视觉",
        "layout": "上部品牌与大标题，中部完整照片工作台，下部单一蓝色主按钮；社区双列卡片，成品按用途整齐排列。",
        "wireframe": "标题/一句说明 → 三张照片工作台 → 拍照做素材 → 示例方案；识别摘要 → 双列方案 → 用这个方案；视频封面 → 四张图 → 保存整套素材。",
        "strength": "双小程序一致性和首用自助最强，适合首版默认方向。",
        "tradeoff": "品牌张力较克制，需依靠优秀商品图片和拍照工作台形成记忆。",
        "prompt": """DIRECTION A / 晴蓝工具箱 — precise, approachable merchant utility with clear sky-blue identity. Board background very pale cool blue. UI palette: #176FE6 blue, #F1F8FF ice white, #173149 ink navy, pure white, tiny #FFAE62 apricot selection accents. Use broad clean sans-serif Chinese headings, readable neutral sans body and tabular digits. Medium 16px-like radii and quiet thin borders, no glass, no gradient hero. Calm structured spacing.
Signature: the HOME visual is a beautifully arranged three-photo contact sheet of the blue blender inside restrained crop-corner brackets, visually flowing into a neat pack thumbnail, not a camera icon. This photo workspace occupies real space and makes the task understandable instantly. Make the 拍照做素材 button a long confident saturated blue rectangle with rounded corners. The community is an orderly two-column white-card gallery with consistent photo ratios and a small distinct selected outline. Finished pack feels like a tidy file tray, with a large video and an even row of four clear photo thumbnails. White surfaces and navy text. Brand trust comes from layout/legibility, not payment logos. This direction should feel effortless and useful, sufficiently original through the photo-to-pack signature.""",
    },
    {
        "id": "B", "slug": "片场手记", "name": "片场手记", "positioning": "把拍商品到成片的过程表达为轻量片场体验",
        "palette": {"雾白": "#F4F6FA", "片场蓝": "#24324B", "珊瑚红": "#EF645D", "胶片灰": "#DDE3EB", "暖白": "#FFFFFF"},
        "type": {"display": "紧凑厚黑体，标题有片名字感", "body": "现代无衬线，短句优先", "utility": "等宽时码数字，仅用于视频时长"},
        "signature": "真实商品画面的胶片接触印样与叙事帧列",
        "layout": "首页以横向三帧说明商品到生活场景，社区用宽幅剧照卡与作者行，成品页聚焦视频封面与章节缩略图。",
        "wireframe": "片名式标题 → 三帧照片带 → 拍照做素材；识别条 → 剧照卡 → 用这个方案；大视频 → 图包/文案 → 保存整套素材。",
        "strength": "与一品成片名称、AI连续多镜能力贴合，成片感与品牌识别突出。",
        "tradeoff": "需要控制片场元素，不能让普通用户误以为要剪辑或配置分镜。",
        "prompt": """DIRECTION B / 片场手记 — an original quiet film-production notebook translated into a SIMPLE mobile merchant app. Use cool off-white #F4F6FA, slate/navy #24324B, coral red #EF645D as a small bold action accent, pale film gray #DDE3EB and white. These are light UI screens, not a dark cinema dashboard. Chinese headlines are compact heavy sans with a film-title character, body is calm modern sans, time digits feel like actual film time labels. Mostly crisp geometry with small 6–10px corner rounding, excellent optical alignment.
Signature: a restrained film contact strip with tiny perforations around PRODUCT PHOTOS, representing actual captured frames and the final product scene. HOME shows three blender photo frames, not video uploads, linked into a final scene still. A minimal red action underline/pill anchors the main photo button. Community cards are wider cinematic stills with strong short titles and author lines, favor 1 large featured card plus two compact cards; this layout must differ from A's neat two-column catalogue. Finished screen has a compelling vertical video poster, a very small three-frame narrative strip, plus the four deliverable photo thumbnails. Film language is visual only: DO NOT expose editable timelines, storyboard tasks, camera settings, clapperboards or directors' control panels. One tap task remains obvious.""",
    },
    {
        "id": "C", "slug": "柚子创作社", "name": "柚子创作社", "positioning": "温暖、有活力、鼓励用同款和社区创作",
        "palette": {"果橙": "#FF7948", "奶白": "#FFFAEE", "深绿墨": "#263B32", "浅薄荷": "#CFE9D6", "柚黄": "#FFD766"},
        "type": {"display": "圆润粗黑体，少量字形个性", "body": "友好的系统无衬线", "utility": "短标签和作者署名保持规整"},
        "signature": "商品照片卡像一套可取走的创作印样，作者印章作为社区标识",
        "layout": "首页使用照片卡叠放和大橙色行动区，社区突出作者/用同款与错落卡片，成品像一套排好的印样。",
        "wireframe": "友好标题 → 照片印样叠卡 → 大橙按钮；识别条 → 作者/方案照片卡 → 用这个方案；印样套装 → 复制文案/保存整套。",
        "strength": "社区氛围鲜明、适合个体商家，容易形成有温度的品牌。",
        "tradeoff": "装饰和颜色必须克制，避免遮盖商品或削弱专业质感。",
        "prompt": """DIRECTION C / 柚子创作社 — cheerful independent creative co-op, sophisticated and friendly rather than childish. Palette fruit orange #FF7948, milk white #FFFAEE, deep green ink #263B32, pale mint #CFE9D6, small pomelo-yellow #FFD766. Rounded expressive heavy Chinese display type, straightforward readable sans body. Generous touch targets, soft 20–24px cards. Matte paper, one or two cut-paper edges or small author stamps; keep the surface clean. NO serif/terracotta luxury look, no cartoon mascot, no excessive stickers.
Signature: real blue-blender product photos as a small collection of print-proof postcards; a tiny maker/author stamp differentiates official and community. HOME uses three slightly offset photo cards that still read as actual useful input slots, set in a warm open composition, and a large orange CTA. COMMUNITY has a curated gently staggered photo-card arrangement, tangible author rows and a strong 用这个方案 action. FINISHED pack looks like an organized set of delivered prints plus a playable video, not a shopping cart. Use dark ink text and orange action fills with readable contrast. Product photography stays realistic blue and never recolored to the brand palette. Aim for adult independent makers and everyday merchants, not children's crafts.""",
    },
    {
        "id": "D", "slug": "品物画廊", "name": "品物画廊", "positioning": "商品优先、安静精致的品牌内容工具",
        "palette": {"冷瓷白": "#FAFCFD", "松墨": "#273B34", "灰松绿": "#507A68", "雾绿": "#E5EEEB", "淡丁香": "#DDD5E6"},
        "type": {"display": "克制使用现代宋体标题", "body": "清楚的系统黑体操作文字", "utility": "细小但高对比的图注与等宽数字"},
        "signature": "像画廊挂画一样展示商品主体，素材包具有统一的封面秩序",
        "layout": "更大商品图与留白，社区单列大卡/局部下一张预览，领取页以视频封面和一组精致缩略图形成出版感。",
        "wireframe": "短标题 → 大商品摄影 → 拍照做素材；识别摘要 → 大幅方案作品 → 用这个方案；成片封面 → 四张商品图 → 保存。",
        "strength": "商品质感和高客单品牌适配突出，素材结果有可感知价值。",
        "tradeoff": "同屏方案数量较少，社区浏览效率需要筛选和收藏补充。",
        "prompt": """DIRECTION D / 品物画廊 — a contemporary product gallery and quiet editorial mobile tool. Very cool porcelain white #FAFCFD, deep pine ink #273B34, muted pine green #507A68, mist green #E5EEEB, a tiny pale lilac #DDD5E6 accent. Refined modern Chinese Song-style display headings used sparingly, with extremely clear sans-serif Chinese body and button text. Spacious but not empty; imagery is the hero. No warm beige/terracotta, no broadsheet columns, no decorative hairline grid, no ornate calligraphy.
Signature: gallery-like framing of the blue product photographs, with controlled white margins and small purposeful captions. HOME is an elegant full-height product-photo window plus three tiny input crops and one clear pine-green button. COMMUNITY features 1–2 large editorial preset artwork cards with type beneath the image, a visible author/source label, and hints of the next card; this must NOT look like A's tiled utility grid. FINISHED has a tall meticulously framed video cover and four carefully spaced deliverable prints. Action affordances remain unmistakable, with comfortable filled buttons, not tiny hidden text. Premium quality should come from composition and photograph scale, not costly-looking gold flourishes or luxury shopping tropes. Keep the mini-program a self-service tool, not a fashion magazine cover.""",
    },
    {
        "id": "E", "slug": "光谱实验室", "name": "光谱实验室", "positioning": "更大胆、适合AI创意内容的媒体工作室",
        "palette": {"夜紫": "#292143", "纸紫白": "#F5F2FF", "雾紫": "#B2A8F0", "珊瑚粉": "#FF9FA7", "冰青": "#B9E8E6"},
        "type": {"display": "有张力的几何黑体，宽标题", "body": "浅色系统无衬线，高对比优先", "utility": "整齐的时长/媒体数量胶囊标签"},
        "signature": "同一商品的照片、场景和素材包像三层透明片页展开",
        "layout": "深紫媒体画布、浅色文字与淡色主行动按钮；社区紧凑作品画廊，成品采用沉浸式视频和分层素材托盘。",
        "wireframe": "浅色大标题 → 三层商品片页 → 拍照做素材；识别胶囊 → 深色作品画廊 → 用这个方案；沉浸视频 → 素材托盘 → 保存。",
        "strength": "AI创意氛围强、视频预览沉浸、展示时辨识明显。",
        "tradeoff": "需要测试明亮环境的可读性和保守商家的接受度，少用发光效果。",
        "prompt": """DIRECTION E / 光谱实验室 — a bold violet media studio for approachable AI creative output. Colored midnight violet #292143 (not black), paper lavender-white #F5F2FF, mist lilac #B2A8F0, restrained coral-pink #FF9FA7 and ice cyan #B9E8E6. Use expressive geometric sans Chinese display headlines, readable near-white sans body, clean pill metadata. Most interface surfaces remain dark violet with subtle tonal depth; the single primary action is a very pale lavender solid fill with dark ink, NOT low contrast purple on purple.
Signature: three overlapping translucent print-film panes of the SAME real blue blender: input photo, life-scene preview, neatly ordered finished pack. This is an intentional visual metaphor for turning a product into assets, not a workflow node graph. HOME uses these media panes as the central composition. COMMUNITY is a rich dark gallery with visually striking full-bleed preset thumbnails, clear author/source rows and decisive selection outlines. FINISHED is an immersive video-first surface with a lower tray of four images and an obvious save button. Differentiate it from B: B is light analog film contact sheets; E is colored violet optical sheets and contemporary media depth. No neon-green accents, no generic sci-fi circuits, no black-and-acid dashboard, no glowing AI robot, no generic gradient blobs. Keep all text legible, supporting UI restrained, and photographic product identity consistent.""",
    },
]


def main() -> None:
    if (OUT / "designs.json").exists():
        raise SystemExit("五方向设计产物已存在；不覆盖原始提示词、生成记录或用户已选基线。新的选型请另建版本目录。")
    prompt_dir = OUT / "prompts"
    prompt_dir.mkdir(parents=True, exist_ok=True)
    entries = []
    for d in DESIGNS:
        stem = f"{d['id']}-{d['slug']}"
        prompt = COMMON + "\n\n" + d["prompt"] + f"\n\nBoard title, outside the screens: {d['id']} / {d['name']}. Final reminder: THREE complete, large, detailed mobile screens, not one screen, not wireframes. All requested Chinese labels legible."
        path = prompt_dir / f"{stem}.txt"
        path.write_text(prompt, encoding="utf-8")
        entry = {k: v for k, v in d.items() if k != "prompt"}
        entry.update({"prompt_file": str(path.relative_to(ROOT)).replace('\\', '/'), "image_file": str((OUT / f"{stem}.png").relative_to(ROOT)).replace('\\', '/'), "model": "gpt-image-2.5", "requested_size": "1536x1024", "quality": "high", "status": "BRIEF_READY_NOT_GENERATED"})
        entries.append(entry)
    (OUT / "designs.json").write_text(json.dumps({"project": "一品成片", "requirements_version": "3.0", "status": "DESIGN_SELECTION_NOT_IMPLEMENTED_UI", "generator_skill": "sub2-image-gen", "comparison": "同一蓝色示例榨汁杯，同一拍照/社区/领取流程，比较五种视觉与布局", "designs": entries}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"directory": str(OUT), "directions": [d["id"] + " " + d["name"] for d in entries], "prompt_files": 5}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

# one-tap-ads：391条方案完整目录

2026-10-27｜固定提交1aab133｜上游ClipForge方案的只读研究导出。原作者xixihhhh，AGPL-3.0-only，保留来源与许可证；本目录不是一品成片已上线/已验收的方案库。

每条保留原名、文案意图、形态、脚本风格、全部运镜、Look和合成配置。镜头指令与Look是生成提示，不能视为已验证效果；AdTemplate本身不固定总时长、模型和图片/视频交付数量。

[案例深析](方案案例与生成流程深析-2026-10-27.md)｜[云端封装方案](../实施/方案驱动的云端服务与小程序封装-2026-10-27.md)｜[完整JSON](../../assets/research/one-tap-ads/方案完整目录-1aab133.json)｜[筛选用CSV](../../assets/research/one-tap-ads/方案筛选目录-1aab133.csv)｜[LICENSE](../../assets/research/one-tap-ads/LICENSE.upstream.txt)｜[NOTICE](../../assets/research/one-tap-ads/NOTICE.upstream.txt)

## 分组数量

| 分组 | 数量 |
| --- | --- |
| 商品展示 | 66 |
| 真人讲解 | 95 |
| 剧情叙事 | 69 |
| 生活种草 | 69 |
| 促销转化 | 34 |
| 创意视觉 | 58 |

## 商品展示

### 转台大片 · turntable_hero

影棚转台+微距质感，高客单价商品首选

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：痛点种草。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：转台展示（lazy_susan）；展示/演示：微距滑移（macro_glide）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"quality":"hd","productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：整体走高级影棚质感路线，突出材质细节与工艺感，文案克制有分量。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L71)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 开箱节奏 · unboxing_beat

甩镜开场+俯拍上手，节奏利落的开箱感

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：开箱。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；商品亮相：环绕展示（orbit_slow）；展示/演示：俯拍下降（overhead_top）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开箱动作干脆利落，逐层展示有惊喜感；建议关键镜头换成实拍上手画面更合规。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L97)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 美食食欲 · food_crave

食欲暖光+微距滑移，食品类目专用

- 适配标签：食品零食。画面形态：商品特写。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：微距滑移（macro_glide）；展示/演示：俯拍下降（overhead_top）；收尾引导：缓慢推近（slow_push）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：突出色泽、质地与热气蒸汽等食欲信号，文案调动味觉想象。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L136)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 科技酷感 · tech_pulse

冷调轮廓光+弧形环拍，数码3C质感流

- 适配标签：数码3C。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；商品亮相：弧形环移（arc_quarter）；展示/演示：焦点转移（focus_shift）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"energetic","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：克制的科技感文案，参数说人话，画面冷调背景干净。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L150)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 白底子弹时间 · bullet_time_white

电商白底+时间冻结环绕，主图级质感动起来

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：环绕展示（orbit_slow）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"energetic","bgmDuck":true,"quality":"hd","productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：纯白背景零杂物，商品是唯一主角，文案极简只留核心卖点。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L179)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 微距质感 · macro_texture

极致微距怼质地，材质党一眼上头

- 适配标签：美妆护肤、数码3C。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：微距滑移（macro_glide）；商品亮相：降镜聚焦（crane_down_close）；展示/演示：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：画面全程贴近材质表面，突出纹理、光泽与工艺细节，文案少而精。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L192)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 效果先行 · demo_first

首帧就是工作状态，功能比包装先说话

- 适配标签：家居日用、数码3C。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：第一镜直接展示商品正在解决问题的状态，不要包装不要铺垫，效果即钩子。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L206)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 极限测试 · extreme_test

防水抗摔承重硬核实测，眼见为实

- 适配标签：数码3C、家居日用。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：希区柯克变焦（dolly_zoom）；展示/演示：手持实拍感（handheld_real）；商品亮相：英雄仰拍（hero_rise）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：围绕一项极端条件测试展开全片，测试过程真实可信，结果不夸大。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L220)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 试穿走位 · fashion_walk

街头编辑部风试穿+跟拍，衣服穿上才会说话

- 适配标签：服饰鞋包。画面形态：人物讲解。脚本：场景安利。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；展示/演示：横移扫过（lateral_track）；商品亮相：跟随镜头（follow_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：模特向镜头自然走来展示上身效果，突出版型与垂感，街头时尚杂志感。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L234)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 拼贴快闪 · pack_flatlay

平铺拼贴+卡点快闪，剪辑门槛最低的爆量款

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：痛点种草。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；商品亮相：俯拍下降（overhead_top）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：画面以商品平铺与大字卖点为主，节奏跟音乐卡点，每镜信息量一句话说清。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L248)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 横测排位 · blind_ranking

五款排排站逐项打分，敢公布踩雷款

- 适配标签：美妆护肤、食品零食。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：横移扫过（lateral_track）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；背书：俯拍下降（overhead_top）；收尾引导：推近定住（push_then_hold）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：同品类多款排排站，统一标准逐项评分并公布排名；评分依据真实体验，可指出不足但不夸大贬低。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L710)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 原相机试色 · swatch_report

自然光原相机逐色试给你看，拒绝滤镜诈骗

- 适配标签：美妆护肤。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：微距滑移（macro_glide）；商品亮相：俯拍下降（overhead_top）；展示/演示：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"quality":"hd","productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：声明自然光原相机开场，多色号逐一上手/上唇展示，给不同肤色人群明确的色号建议，色彩还原真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L724)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 第一口试吃 · first_bite

开袋收音+怼拍拉丝爆汁，第一口反应即卖点

- 适配标签：食品零食。画面形态：商品特写。脚本：开箱。
- 运镜编排：开头钩子：微距滑移（macro_glide）；商品亮相：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none","bgmDuck":false,"quality":"hd","productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开袋/掰开的声音特写开场，怼拍拉丝流心爆汁瞬间，第一口真实反应收尾；保留原声不配BGM。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L740)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 清洁解压 · grime_satisfying

重度污渍一擦到底，去污高光即解压爽点

- 适配标签：家居日用。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：微距滑移（macro_glide）；痛点：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true,"quality":"hd","productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：重度污渍特写开场，喷涂静置擦除全程实拍，一擦到底的高光瞬间重点呈现；清洁效果真实不摆拍。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L882)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 懒人神器盘点 · lazy_gadget_list

每件一个「一秒见效」瞬间，懒人看了直点头

- 适配标签：家居日用。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；展示/演示：跟随镜头（follow_track）；商品亮相：急速推近（crash_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「懒人搭子TOP榜」展开，每件商品只给一个立竿见影的演示瞬间，编号推进，最后点名第一名。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L910)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 一件顶十件 · ten_in_one

十个用法连环快切，最后算一笔省钱账

- 适配标签：家居日用。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：甩镜切换（whip_pan）；商品亮相：转台展示（lazy_susan）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「它一个能干十件事」开场，用法连环快切配计数角标，结尾把替代品价格加总算省钱账，账要真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L952)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 一衣多穿 · one_piece_five_ways

同一件卡点换出五种风格，会过日子的时髦

- 适配标签：服饰鞋包。画面形态：人物讲解。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；展示/演示：横移扫过（lateral_track）；商品亮相：希区柯克变焦（dolly_zoom）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：同一单品连换多套搭配卡点切换，每套点出适合场合，单品全程高亮是主角。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L996)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 面料怼镜头 · fabric_closeup

揉搓垂坠透光逐项验货，行家只看质感

- 适配标签：服饰鞋包。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；商品亮相：降镜聚焦（crane_down_close）；收尾引导：缓慢推近（slow_push）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：手揉面料的声音与画面开场，垂坠感、弹力、透光度逐项怼拍验证，少说话多给质感证据。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1052)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 参数横评 · spec_showdown

三机同框逐项跑分，按人群给「选它」结论

- 适配标签：数码3C。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：横移扫过（lateral_track）；展示/演示：焦点转移（focus_shift）；商品亮相：弧形环移（arc_quarter）；背书：俯拍下降（overhead_top）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：同价位多款同框，逐项实测数据对比配表格字幕，结论按人群明确到「XX需求选它」，数据真实可核。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1096)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 仪式感开箱 · ritual_unboxing

揭膜排列点亮三连，慢节奏开箱的高级感

- 适配标签：数码3C。画面形态：商品特写。脚本：开箱。
- 运镜编排：开头钩子：降镜聚焦（crane_down_close）；商品亮相：微距滑移（macro_glide）；展示/演示：俯拍下降（overhead_top）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none","bgmDuck":false,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：顶光下慢节奏开箱，逐层揭膜配件排列成阵，开机点亮瞬间收尾；保留撕膜与摆放的原声。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1110)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 拆机看用料 · teardown_inside

开壳讲用料做工，以料服人的硬核测评

- 适配标签：数码3C。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；商品亮相：俯拍下降（overhead_top）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「拆开看看它凭什么卖这价」开场，开壳逐层讲用料做工，内部结构微距特写，结论就事论事。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1152)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 闭眼入盘点 · top_list

「这5样闭眼入」编号过品，TOP1压轴

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；商品亮相：转台展示（lazy_susan）；展示/演示：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「这几样闭眼入」清单开场，编号逐个过品每个只讲一个记忆点，TOP1压轴给最强理由。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1661)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 奢品定妆 · luxury_hero

大理石台面+黄金时刻光，编辑部级定妆照

- 适配标签：美妆护肤。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：缓慢推近（slow_push）；商品亮相：降镜聚焦（crane_down_close）；展示/演示：焦点转移（focus_shift）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：大理石/丝绒质感台面配窗边黄金时刻光，浅景深编辑部布光，画面奢而静，文案惜字如金。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2248)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 高客单慢展示 · premium_slow

开箱安装日用全流程，大件商品的耐心成交

- 适配标签：家居日用。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"quality":"hd","productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：面向大件高客单：开箱/安装/日常使用全流程慢节奏展示，细节触感与售后质保都讲到，不催单重信任。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2262)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 加速组装 · speed_assembly

顶拍加速的组装/备餐过程，快进的成就感

- 适配标签：食品零食、家居日用。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；展示/演示：焦点转移（focus_shift）；商品亮相：急速推近（crash_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以顶拍加速呈现组装/制作全过程，快进节奏配轻快音乐，成品揭晓瞬间放慢，反差出成就感。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2276)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 暗调扫光 · light_sweep

深色背景一道扫光掠过，克制的高级感

- 适配标签：数码3C。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：缓慢推近（slow_push）；商品亮相：转台展示（lazy_susan）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：深色背景商品缓慢旋转，一道受控扫光掠过勾勒轮廓与材质反光，保持商品原设计不做变形。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2332)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 本片实拍自证 · shot_on_this

「全片就是用它拍的」，作品即样张

- 适配标签：数码3C。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开场声明「本片全程用它拍摄」，之后每个画面都是样张自证（夜景/防抖/微距分段展示）；自证画面必须真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2460)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 游戏实测 · gaming_test

帧率温度全程压测，游戏党只看实战

- 适配标签：数码3C。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；商品亮相：弧形环移（arc_quarter）；收尾引导：推近定住（push_then_hold）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以热门游戏实机压测为主线，帧率/温度/续航数据角标同步上屏，实战体验说话；测试数据真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2474)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 单手带娃测 · one_hand_test

一手抱娃一手操作，单手过不了关就淘汰

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：一手抱娃开场（另一只手是妈妈全部生产力），单手完成收车/开扣/冲奶实测，卡壳旧品对照新品一秒过关；实测过程真实不摆拍。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3568)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 安全实测台 · safety_crash

碰撞台慢放加仪表读数，数据替宝宝说话

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；背书：横移扫过（lateral_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"none","quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：反问钩子开场（你的座椅敢上碰撞台吗），碰撞/拉力实测慢放+仪表读数，数据结论收尾；测试条件与数据须真实，不伪造检测结果，检测机构如实标注。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3581)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 开蚌取珠 · oyster_reveal

刀口慢镜开蚌取珠，开出几颗算几颗

- 适配标签：服饰鞋包。画面形态：商品特写。脚本：开箱。
- 运镜编排：开头钩子：希区柯克变焦（dolly_zoom）；展示/演示：微距滑移（macro_glide）；商品亮相：拉远揭示（pull_reveal）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"energetic","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：选蚌下单钩子，开蚌悬念（刀口慢镜），取珠清点量珠径评成色，现场加工成饰品收尾；严禁塞珠式造假，开蚌结果真实随机，不承诺成色。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3685)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 转腕火彩 · wrist_sparkle

转腕慢动作过灯，火彩闪到你猜不出价格

- 适配标签：服饰鞋包。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：微距滑移（macro_glide）；商品亮相：转台展示（lazy_susan）；展示/演示：焦点转移（focus_shift）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true,"quality":"hd","productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：无脸手部/颈部特写入场，转腕慢动作过灯火彩闪烁，三套场景搭配（通勤/晚宴/日常），价格反差收尾；材质成色表述真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3713)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 客厅健身房 · living_gym

5平米次卧开健身房，用完一键塞床底

- 适配标签：家居日用。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：拉远揭示（pull_reveal）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：空间痛点钩子（出租屋5平米），展开/折叠收纳演示+跟练片段，一键归位塞床底收尾；折叠尺寸与承重数据真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3754)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 暴雨营地测 · storm_test

台风预警正好验帐篷，晨起帐内验干燥

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"bold","bgm":"none","quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：极端天气预警钩子（台风黄色预警，正好验帐篷），雨中搭建/接缝漏水检查/大风拉扯，晨起帐内干燥度验货收尾；测试真实，安全前提下拍摄。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3768)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 万步暴走测 · step_test

替你走了21462步，分时段播报脚感

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：计步器清零钩子（替你走两万步），分时段脚感播报（3千/1万/2万步），晚间脱鞋验脚收尾；计步数据与脚感表述真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3859)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 容量极限装 · max_load

别看它小，往里塞了23样东西还不变形

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：小包大话钩子（这包看着小），逐件塞入计数（水瓶/电脑/伞…），拎起晃三下不变形收尾；塞入件数真实可复现。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3873)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 无脸包剧场 · faceless_bag

不露脸不废话，这个包一共有11个口袋

- 适配标签：服饰鞋包。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；商品亮相：转台展示（lazy_susan）；收尾引导：推近定住（push_then_hold）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：包体特写入场（不露脸不出声），开合五金声+隔层逐层展示，三种背法快切收尾；口袋数量与容量表述真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3901)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 分贝仪实测 · decibel_test

凌晨五点开机，分贝仪说话我不说话

- 适配标签：家居日用、数码3C。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"none"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：深夜场景钩子（凌晨5点打豆浆吵不吵），分贝仪贴机开机实测对比环境音，隔墙家人熟睡验证收尾；读数真实，测试条件一致。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3915)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 电费账单测 · power_bill

计量插座清零跑一个月，账单折算到每天

- 适配标签：家居日用、数码3C。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；背书：缓慢推近（slow_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：电表/计量插座清零钩子，连续使用一周/一月读数记录，月底晒账单折算「一天几毛钱」收尾；读数与折算真实，使用条件如实说明。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3929)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 一梳到底 · brush_through

一个月没梳的打结假发，看能不能一梳到底

- 适配标签：美妆护肤。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；商品亮相：缓慢推近（slow_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：炸毛/打结假发钩子，喷顺发喷雾+梳子一次梳通慢镜，光泽甩发+断发量对比收尾；对比条件一致，效果真实不加速造假。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3985)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 菌斑显色测 · plaque_test

嚼完显色片满口颜色，再看它怎么刷白

- 适配标签：美妆护肤。画面形态：场景演示。脚本：反转。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；商品亮相：缓慢推近（slow_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：自信提问钩子（觉得自己刷得很干净？），嚼显色片惊吓，电动牙刷/冲牙器清除后二次显色验证；显色测试真实，不做治疗类医疗宣称，效果因人而异。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3999)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 一学就会键 · one_button_demo

这台机器只有一个键，我妈三秒学会

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：操作恐惧钩子（爸妈学不会智能产品？），大字/大音量/一个键完成全流程演示，长辈「教一遍就会」验证收尾；操作演示真实，适老表述不夸大。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4053)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 轴体试音 · switch_sound

三款轴体同一句话，耳朵自己选

- 适配标签：数码3C。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；商品亮相：俯拍下降（overhead_top）；收尾引导：缓慢推近（slow_push）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none","bgmDuck":false}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：高保真敲击原声开场（无解说），同句文案换轴逐段对比，字幕报轴体名与价格，评论区选轴下单收尾；收音真实不加假音效。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4067)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 磁吸咔哒 · snap_stack

一甩咔哒，全家桶连环上身

- 适配标签：数码3C。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：甩镜切换（whip_pan）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：手机悬空一甩咔哒吸附钩子，卡点连续吸上支架/卡包/充电宝，磁吸声做节奏单元，全家福定格报价收尾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4081)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 降噪AB耳感 · anc_ab

捏一下，全世界安静了

- 适配标签：数码3C。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：缓慢推近（slow_push）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"standard","bgm":"none","bgmDuck":false}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：地铁/咖啡馆嘈杂原声轰炸两秒，捏耳机柄开降噪音频瞬间抽真空只剩人声，再开关一次对比+适用场景清单收尾；降噪对比用真实收音模拟，不夸大消噪效果。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4095)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 充电竞速赛 · charge_race

同时插电，猜谁先满

- 适配标签：数码3C。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；背书：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：两台手机同时插电+悬浮计时器「猜谁先满」钩子，延时快进关键节点报百分比，三十分钟差距揭晓输家还在半血；充电数据真实实测不虚标。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4109)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 掌心起飞 · palm_launch

摊开手掌，它自己飞起来了

- 适配标签：数码3C。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：英雄仰拍（hero_rise）；展示/演示：环绕展示（orbit_slow）；商品亮相：跟随镜头（follow_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：摊开手掌原地起飞的魔术感钩子，一键环绕/跟拍模式实录成片展示，「零门槛航拍」话术+新手套装收尾；飞行画面真实拍摄，提示遵守禁飞区规定。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4123)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 开汤审评 · tea_grading

干茶、汤色、叶底，三步见真章

- 适配标签：食品零食。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：抓一把干茶怼镜头看条索，白瓷盖碗开汤汤色对光特写，翻叶底定等级报价「这个价喝到这个叶底是捡漏」；审评流程真实，不虚标等级与产地。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4151)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 爆浆切面 · lava_cut

刀落下去的那一秒，馅自己涌出来

- 适配标签：食品零食。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：推近定住（push_then_hold）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：刀尖抵住的静止悬念一秒，缓慢下刀内馅熔岩状涌出的慢放特写，切面横截面怼镜+口味清单收尾；切面实拍不加假馅料。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4207)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 鸡蛋不碎测 · egg_test

整个人跪上去，鸡蛋一个没碎

- 适配标签：家居日用。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：推近定住（push_then_hold）；痛点：缓慢推近（slow_push）；展示/演示：急速推近（crash_push）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：生鸡蛋摆上床垫成年人整个跪压上去的捏汗钩子，揭晓鸡蛋完好，承托分散原理一句话+试睡政策收尾；实验真实可复现不摆拍。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4277)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 关掉大灯 · big_light_off

你家没氛围，就输在这盏顶灯

- 适配标签：家居日用。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：推近定住（push_then_hold）；展示/演示：弧形环移（arc_quarter）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开着惨白顶灯的房间「这就是你家没氛围的原因」钩子，啪一声关顶灯逐一点亮落地灯串灯壁灯，同机位冷暖对比定格+灯具清单收尾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4291)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 正午变午夜 · blackout_noon

中午十二点，一拉帘伸手不见五指

- 适配标签：家居日用。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：推近定住（push_then_hold）；展示/演示：急速推近（crash_push）；商品亮相：缓慢推近（slow_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：正午阳光刺眼的卧室+手机显示12点整钩子，窗帘一拉画面瞬黑伸手不见五指，照度计数字对比+补觉人群点名收尾；遮光数据真实实测。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4319)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 地毯进洗衣机 · rug_washer

打翻酱料别慌，拆下来扔洗衣机

- 适配标签：家居日用。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：俯拍下降（overhead_top）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：孩子/宠物打翻酱料在地毯上的「完了」钩子，拉开隐形拉链拆下毯面塞进洗衣机，洗后如新铺回+对比传统地毯送洗价收尾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4333)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 免钉承重测 · no_drill_test

不打孔的挂钩，最后吊了一个人

- 适配标签：家居日用。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：缓慢推近（slow_push）；展示/演示：推近定住（push_then_hold）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：租房不能打孔的痛点钩子，无痕贴挂上相框后开始加码——挂水瓶挂哑铃最后人吊上去，撕下墙面无痕特写+套装收尾；承重数字真实不虚标。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4347)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 白T无痕挑战 · white_tee_test

最挑内衣的白T，转一圈看不见痕

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：推近定住（push_then_hold）；痛点：焦点转移（focus_shift）；展示/演示：弧形环移（arc_quarter）；商品亮相：横移扫过（lateral_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：白T加强光侧拍「最挑内衣的穿搭」钩子，普通款痕迹明显vs无痕款360度转身无痕对比，肤色可选+尺码表收尾；按平台内衣类目规范隔衣外穿展示。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4361)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 下水实测 · swim_test

这套泳衣，敢不敢真下水

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「这套泳衣敢不敢下水」钩子，真实入水游两圈起身验三件事——不透不掉不勒痕，湿身状态色彩对比+速干计时收尾；下水画面真实拍摄。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4375)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 紫外灯验布 · uv_proof

看得见的紫外线，挡得住才叫防晒

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：紫外线手电照普通T恤测试卡秒变紫色钩子，同样照防晒衣卡面几乎不变色，UPF50+吊牌特写+全家防晒清单收尾；UPF＞40且UVA透射率＜5%方可宣称防晒，需检测报告支撑不虚标。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4417)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 测温枪凉感 · thermal_gun

暴晒车顶，一块52度一块38度

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：正午暴晒车顶铺两块面料钩子，测温枪逐一打点——普通面料52度凉感面料38度，数字大字上屏+接触凉感原理一句话收尾；温度数据真实实测。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4431)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 偏光验镜卡 · polarized_proof

隔着镜片看到图案，才是真偏光

- 适配标签：服饰鞋包。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：隔镜片看测试卡「看到图案才是真偏光」钩子，镜头透过镜片拍水面车漆反光瞬间消失，旋转镜片变黑的屏幕验证+防伪提醒收尾；光学演示真实可复现。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4445)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 评级出分揭晓 · grading_reveal

送评三个月，今天拆盲分

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：开箱。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「三个月前送评的卡回来了」悬念钩子，拆评级壳遮住分数逐张翻面，高分出现的尖叫时刻+同分卡市价对比收尾；严禁稳赚升值等投资承诺话术，注意未成年人保护，评级结果不构成收益暗示。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4512)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 老师傅对新手 · pro_vs_rookie

老木工和新手同装一个架，只差两分钟

- 适配标签：家居日用。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：横移扫过（lateral_track）；商品亮相：焦点转移（focus_shift）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：老木工和新手各领同一把电钻钩子，同一任务分屏计时装置物架，新手也只慢两分钟「工具好谁用都行」+套装收尾；对比条件公平真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4525)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 脏水显形浴 · strip_wash

你以为洗干净的毛巾，泡出一缸褐水

- 适配标签：家居日用。画面形态：场景演示。脚本：反转。
- 运镜编排：开头钩子：推近定住（push_then_hold）；痛点：微距滑移（macro_glide）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「你以为洗干净的毛巾」钩子，浴缸放水加剂泡入数小时后水变浑褐的震撼揭示，打捞对比+清洁剂配方收尾；实验真实不加色素摆拍。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4539)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 穿戴甲实战测 · nail_stress

美甲店同款19块9，戴着洗碗第七天

- 适配标签：美妆护肤。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：5分钟戴甲全程实拍「美甲店同款只要19块9」钩子，戴着打字开易拉罐洗碗的日常暴力实测，第7天完好特写+复用卸甲教学收尾；耐久测试真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4567)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 发际线急救 · hairline_fix

一夹一抓，发量当场翻倍

- 适配标签：美妆护肤。画面形态：场景演示。脚本：反转。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；痛点：缓慢推近（slow_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：低头俯拍发缝稀疏的扎心钩子「产后的我不敢扎马尾」，假发片一夹一抓融合发量翻倍，路人视角看不出破绽的验证+色号选择收尾；不做生发育发功效宣称。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4581)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 百亿补贴验真 · subsidy_verify

便宜800的手机，当场验序列号

- 适配标签：数码3C。画面形态：商品特写。脚本：开箱。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「比官网便宜800敢不敢买」钩子，下单→开箱→官网序列号查验→激活日期核对的全程实录，「验完是真的，省下的钱不香吗」收尾；验真过程真实实拍不得伪造，价差表述可比对。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4636)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 树上熟现摘 · tree_ripe

现摘现切，糖度计说话

- 适配标签：食品零食。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；背书：俯拍下降（overhead_top）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「别人摘七分熟催熟，我们树上熟现摘」钩子，镜头随手摘果当场切开糖度计实测数字特写，催熟对比科普+「今天摘今天发就抢这三天」收尾；糖度数据与树上熟表述必须真实，实景拍摄。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4864)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。


## 真人讲解

### 达人口播 · presenter_talk

素人主播直给口播+逐字卡拉OK字幕

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：口播直给有网感，重点句短促有力，适合逐字字幕强调。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L110)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 街访背书 · street_vox

街头采访多人背书，第三方视角更可信

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：第一视角（pov_walk）；背书：横移扫过（lateral_track）；展示/演示：跟随镜头（follow_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：受访者口吻真实多样，观点具体不夸大，像随机街采不像摆拍。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L164)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 专家背书 · expert_lab

白大褂讲成分讲原理，权威感拉满信任成交

- 适配标签：美妆护肤。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：微距滑移（macro_glide）；背书：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以研究员口吻讲成分与原理，术语说人话，结论克制不绝对化；资质背书需真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L263)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 车内口播 · car_talk

车内私密感安利，通勤间隙的真心推荐

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：焦点转移（focus_shift）；展示/演示：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"none","bgmDuck":false}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：坐在车内对镜头口播，像跟朋友打视频电话，语气松弛真诚不像广告。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L277)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 答疑拔草 · objection_qa

逐条化解三大顾虑，高客单信任型带货

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；背书：横移扫过（lateral_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开场点出用户最担心的问题，逐条正面回应给证据，最后才报价格。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L290)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 多人证言 · testimonial_stack

多位素人证言快剪，人多才是硬社证

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；背书：横移扫过（lateral_track）；展示/演示：跟随镜头（follow_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：多位不同身份的素人各说一句真实使用感受，每段短促直给，观点具体不重样。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L303)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 新闻播报 · news_flash

新闻台播报式上新，正经脸讲好物自带反差

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：情景短剧。
- 运镜编排：开头钩子：急速推近（crash_push）；背书：焦点转移（focus_shift）；展示/演示：横移扫过（lateral_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：主播以新闻播报口吻一本正经介绍商品，播报体与带货内容形成反差趣味，信息真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L316)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 保姆级教程 · tutorial_steps

分步教学顺手带货，学会即种草

- 适配标签：美妆护肤、家居日用。画面形态：场景演示。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：按第一步第二步分步教学，每步一个可跟做的动作，商品在步骤中自然出场。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L329)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 妆前妆后 · before_after_face

同机位同光线前后闪切，妆效眼见为实

- 适配标签：美妆护肤。画面形态：人物讲解。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：微距滑移（macro_glide）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：素颜自嘲开场，上妆过程快剪，妆后定格回眸；前后对比须同机位同光线真实呈现，不过度修饰。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L626)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 空瓶记 · empties_review

用空的才敢推，空瓶阵列就是口碑

- 适配标签：美妆护肤。画面形态：商品特写。脚本：人设口播。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；背书：转台展示（lazy_susan）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：倒出一堆空瓶开场，逐瓶讲用空理由与回购意向，挤压见底的动作特写增强真实感。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L654)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 肤质实测 · skin_type_test

大油皮/沙漠皮亲测打卡，只对同肤质负责

- 适配标签：美妆护肤。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：焦点转移（focus_shift）；背书：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以明确肤质人设开场（如大油皮），定时打卡实测持妆/保湿表现，结论只给同肤质人群，描述客观。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L682)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 配料表干净党 · clean_label

买零食先翻背面，红线划出配料表长短

- 适配标签：食品零食。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「买零食先翻背面」开场，背标怼拍对比配料表长短，字幕划重点；配料表信息必须与实物一致。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L866)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 入住红黑榜 · one_year_review

住了一年买对买错都敢说，过来人掏心窝

- 适配标签：家居日用。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；背书：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「入住一年这些东西买对/买错了」开场，红黑榜逐条盘点，敢讲缺点更可信，评价基于真实使用。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L924)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 身材痛点专场 · body_type_fix

梨形小个子微胖对号入座，先痛后解的版型经

- 适配标签：服饰鞋包。画面形态：人物讲解。脚本：痛点种草。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：横移扫过（lateral_track）；商品亮相：跟随镜头（follow_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：点名身材人群开场（如梨形/小个子），先展示常见踩雷款的问题，再上本命款前后对比，语气像同身材姐妹。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1010)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 多身材试穿 · multi_size_tryon

同一件多身高体重都上身，选码保姆级

- 适配标签：服饰鞋包。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；展示/演示：横移扫过（lateral_track）；背书：跟随镜头（follow_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：同一款多位不同身高体重的人逐个上身，身高体重角标标注，给各身型明确选码建议，数据真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1066)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 30天长测报告 · long_term_review

磨损指纹都给你看，优缺点各摆几条的实话

- 适配标签：数码3C、家居日用。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「用了30天说点实话」开场，使用痕迹特写增强真实感，优缺点各摆两三条，结论明确到谁该买谁别买。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1124)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 换新劝告 · upgrade_or_not

新旧同框AB测，反向劝冷静赢信任

- 适配标签：数码3C。画面形态：人物讲解。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；商品亮相：弧形环移（arc_quarter）；背书：横移扫过（lateral_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「老款用户要不要换」开场，新旧同框逐项对比，结尾反向点名「这几类人不用换」，克制反套路赢信任。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1194)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 好奇设问体 · question_hook

「为什么你的XX总是…」设问开场，答案就是商品

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：焦点转移（focus_shift）；展示/演示：跟随镜头（follow_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开场用一个用户本来就在想的疑问设问，中段逐步揭晓原因，商品作为答案自然承接，兑现开头的问题。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1210)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 数字冲击体 · number_shock

「99%的人不知道」大数字开场，反常识科普带货

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：焦点转移（focus_shift）；展示/演示：俯拍下降（overhead_top）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以大数字开场制造冲击（如「99%的人都做错了」），展开反常识科普后商品入场；引用数字需有依据不编造。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1223)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 价值标价体 · value_price_hook

「价值999的方法免费教」，先给干货再带货

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开场承诺免费教一个有价值的方法，中段真的交付可用干货，商品作为「想省事就用它」的选项收尾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1236)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 身份点名体 · identity_call

「小个子/油皮/宝妈听我说」，只对自己人说话

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：痛点种草。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开场直接点名目标人群身份，全片只围绕这一类人的场景与痛点展开，像圈内人给圈内人的建议。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1249)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 损失厌恶体 · loss_averse

「还在手动做XX就是在亏」，算清隐性成本

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：痛点种草。
- 运镜编排：开头钩子：希区柯克变焦（dolly_zoom）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开场点出维持现状的隐性损失（时间/金钱/精力），把账算具体，商品是止损方案；损失描述真实不贩卖焦虑。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1262)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 无限回购清单 · repurchase_list

回购N次的东西才配上榜，用钱包投票

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：人设口播。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；背书：转台展示（lazy_susan）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「回购了N次的东西」立信任开场，逐件讲回购理由与使用场景，回购事实真实，像老用户的口碑清单。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1412)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 避坑警告 · avoid_pitfalls

「别再乱买XX」坑点罗列，避坑顺手给正解

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：痛点种草。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：焦点转移（focus_shift）；展示/演示：微距滑移（macro_glide）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「买XX千万避开这几个坑」开场，逐条讲坑点及识别方法，最后给出正确选择；建议基于事实不制造焦虑。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1440)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 行业内幕 · insider_secrets

「柜姐不会告诉你的事」，压低声线的耳语爆料

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：缓慢推近（slow_push）；痛点：焦点转移（focus_shift）；展示/演示：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以从业者口吻爆料行业内幕，压低声线凑近镜头的耳语感，坦白自家哪里实在；内幕信息必须真实不编造。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1453)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 真心分享体 · share_close

「我必须分享给你们」，亲友式安利直给

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：手持实拍感（handheld_real）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「我必须分享」的兴奋感开场，像跟亲友安利一样直给，分享理由具体真实，热情但不夸大。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1481)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 陪伴唠嗑体 · companion_chat

怼脸长镜边聊边用，像老友视频通话

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：日常唠嗑开场不急着进主题，边聊近况边顺手用到商品，语气松弛像跟老朋友视频，带货像顺口一提。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1563)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 老铁信任口播 · trust_talk

「自家的货」掏心窝讲成本，不精致反而可信

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：急速推近（crash_push）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"none","bgmDuck":false}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「自家的货」开场掏心窝讲成本与利润逻辑，素人感不追求精致，方言感口吻更可信；成本描述真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1591)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 知识切片风 · knowledge_talk

冷知识开场讲原理，理性种草的脱口秀感

- 适配标签：数码3C。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；背书：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"none","bgmDuck":false}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以冷知识或辟谣开场，单口脱口秀式讲清一个原理，顺势过渡到商品如何应用这个原理，理性克制。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1604)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 地摊叫卖风 · street_vendor

户外摊位吆喝式带货，烟火气就是亲切感

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：情景短剧。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：手持实拍感（handheld_real）；商品亮相：俯拍下降（overhead_top）；背书：横移扫过（lateral_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以户外摊位吆喝的热闹劲开场，叫卖式话术带烟火气，量大实惠眼见为实；报价与份量真实不夸口。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1646)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 反向劝退体 · reverse_psychology

「XX的人千万别买」，越禁越想看的欲擒故纵

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：反转。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：焦点转移（focus_shift）；展示/演示：手持实拍感（handheld_real）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「XX的人千万别买它」反向开场，列的「劝退理由」实为放大卖点（如太上头/太好用），趣味反差不误导。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1741)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 合拍反应 · duet_react

分屏边看边真实反应，反应即背书

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：急速推近（crash_push）；背书：手持实拍感（handheld_real）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以分屏合拍结构：一侧播放素材（用户反馈/使用画面），一侧真人实时反应点评，反应真实不夸张。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1989)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 搜索答案体 · search_answer

开场复刻搜索词，步骤交付答案顺手带货

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开场一句话复刻用户会搜的问题（如「XX怎么选」），按步骤真的交付答案，商品在步骤中自然入位。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2015)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 新旧对打 · old_vs_new

旧方案痛点连击vs新品优势，你选哪个

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：左右对照结构：旧方案痛点逐条数（费时/费钱），新方案优势逐条对，结尾「你选哪个」；不点名贬低具体品牌。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2043)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 早知道体 · wish_i_knew

「这三件事我希望早点知道」，踩坑换来的觉悟

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以踩坑经验的反思口吻开场，逐条讲当年做错了什么，商品是那个教训的答案，语气真诚像过来人。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2069)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 换牌自述 · switch_story

「我把用了三年的换掉了」，换的理由讲具体

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：焦点转移（focus_shift）；展示/演示：微距滑移（macro_glide）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「用了多年的东西换掉了」开场，讲清换掉的具体原因与换后差异；不点名贬低原品牌，理由真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2082)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 用法纠错 · usage_fix

「别再这样用了」，错误示范对正确姿势

- 适配标签：家居日用、美妆护肤。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「别再这样用XX了」开场，先演示常见错误用法及后果，再给正确做法，商品是正确姿势的一部分。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2137)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 绿幕讲解 · green_screen

站在截图数据前指着讲，证据可视化口播

- 适配标签：数码3C。画面形态：图文混剪。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；背书：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以绿幕抠像站在截图/评论/数据图前逐条指点讲解，证据画面即背景；引用的截图与数据必须真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2164)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 一物三吃 · recipe_with

用它做三道菜，菜谱交付里顺手带货

- 适配标签：食品零食。画面形态：场景演示。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「用它能做三道菜」开场，每道菜快节奏交付可复刻的做法，商品是每道菜的关键一步，实用为先。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2418)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 谣言粉碎 · myth_busting

「别再信这些说法了」，逐条辟谣立专业

- 适配标签：美妆护肤、食品零食。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：焦点转移（focus_shift）；展示/演示：微距滑移（macro_glide）；背书：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「关于XX的几个流行说法都是错的」开场，逐条辟谣讲清依据，商品作为正确认知下的选择；辟谣依据可靠。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2504)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 店员自购榜 · staff_pick

「我是店员，这些是我自己花钱买的」

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；背书：手持实拍感（handheld_real）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以内部人自购视角开场（店员/员工），讲哪些自己真金白银回购、哪些不买，内部视角+自费事实必须真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2518)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 蒙眼盲测 · blindfold_test

盲测猜价格猜品牌，感官说了算

- 适配标签：食品零食、美妆护肤。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：手持实拍感（handheld_real）；背书：焦点转移（focus_shift）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：受试者蒙眼盲测（试吃/试用），只凭感官猜价格猜档次，揭晓瞬间的真实反应是核心；盲测过程真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2531)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 花冤枉钱自白 · confession_spend

「我烧了三千块才找到它」，试错史换信任

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以自嘲口吻坦白走过的弯路花过的冤枉钱，摆出试错清单，最后落在现在用的这一个；试错经历真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2559)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 反认知观点 · contrarian_view

「大家都教错了」，颠覆共识重立选购标准

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：焦点转移（focus_shift）；展示/演示：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以推翻一个流行观点开场（「选XX根本不用看XX」），论证给出新的选购标准，商品恰好符合新标准；论据真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2572)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 月度购物分享 · monthly_haul

这个月买了啥值不值，复盘式带货

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：人设口播。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；展示/演示：手持实拍感（handheld_real）；背书：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以月度复盘视角摊开这个月买的东西，逐件给值不值的判断，有买对有买亏更可信，评价真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2642)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 成本拆解账 · cost_breakdown

一件商品成本几何，账本摊开讲定价

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；背书：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：把商品的材料/工艺/环节成本摊开算账，解释定价逻辑「贵在哪/省在哪」；成本数字必须真实不虚构。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2669)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 快问快答 · faq_rapid

评论区高频十问连答，一条视频清空顾虑

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：焦点转移（focus_shift）；展示/演示：手持实拍感（handheld_real）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：把评论区高频问题做成快问快答，每题一句话答完立刻下一题，节奏干脆；回答真实不回避尖锐问题。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2724)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 猜价格挑战 · price_guess

路人上手猜价格，揭晓价差的惊讶即卖点

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：第一视角（pov_walk）；背书：横移扫过（lateral_track）；展示/演示：手持实拍感（handheld_real）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：让路人上手体验后猜价格，多数人猜高后揭晓真实价格制造惊讶；猜价反应真实不安排托。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2737)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 全办公室试用 · office_group_test

同事人手一份集体实测，投票结果见真章

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；背书：横移扫过（lateral_track）；展示/演示：手持实拍感（handheld_real）；商品亮相：俯拍下降（overhead_top）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：给全办公室同事人手一份集体试用，逐个收集一句话真实评价，最后公布投票结果；评价多样真实有好有坏。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2750)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 售后实测 · after_sale_proof

亲测退换货全流程，敢晒售后才敢买

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：亲测售后全流程（咨询响应/退换速度/运费险），过程截图与时间线实录；售后体验真实呈现不美化。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2776)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 十年老用户 · old_fan_story

「这个我用了十年」，时间就是最硬的背书

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：缓慢推近（slow_push）；背书：微距滑移（macro_glide）；展示/演示：手持实拍感（handheld_real）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以多年老用户身份开场，新旧对比展示用了多年的旧品与新购的同款，长情故事真实具体；使用年限不虚构。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2816)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 反种草清单 · de_influence

先劝退几个爆款，只留真正值得的一个

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「这几个爆款我劝你别买」开场逐个给出真实劝退理由，最后只留一个真正值得的收尾；劝退理由须基于真实体验，不点名贬损具体品牌。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2885)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 高调省钱 · loud_budgeting

不是买不起，是拒绝为溢价买单，现场算账

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：痛点种草。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；商品亮相：拉远揭示（pull_reveal）；展示/演示：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：当众拒绝一笔高价消费开场（我不是买不起，是不想为溢价买单），现场算账对比，给出预算内的选择；账目与价格对比须真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2898)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 快乐数学 · girl_math

按次均摊越算越值，歪理算账合理化下单

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；商品亮相：环绕展示（orbit_slow）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：用「按次均摊/一天不到一块钱」式歪理算账合理化购买，越算越好笑，结论「约等于免费」促单；幽默夸张但价格数据须真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2911)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 播客对谈 · fake_podcast

播客间双人对谈金句切片，聊着聊着种了草

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：横移扫过（lateral_track）；商品亮相：焦点转移（focus_shift）；背书：缓慢推近（slow_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"none"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：播客间双人对谈金句切片质感，仿佛无意间聊到产品体验，评论区式软性收尾；对谈内容须为真实体验，广告合作属性须如实标注。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2938)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 差评整改 · bad_review_fix

把差评读出来，连夜改完拍给你看

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：反转。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：读出一条真实差评开场（有人给我们1星因为X），承认或反驳，实拍演示改进结果Y；差评与整改过程须真实，不得虚构差评做戏。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2951)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 柜姐服务 · roleplay_consult

一对一柜姐视角，为你挑选试用配清单

- 适配标签：美妆护肤。画面形态：人物讲解。脚本：场景安利。
- 运镜编排：开头钩子：缓慢推近（slow_push）；痛点：焦点转移（focus_shift）；展示/演示：微距滑移（macro_glide）；商品亮相：转台展示（lazy_susan）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：扮演柜姐/顾问对观众一对一服务（欢迎回来，今天帮你把XX配齐），为「你」挑选并试用，开出专属清单收尾；服务人设不冒充专业资质。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3018)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 梯度排位 · tier_list

同类商品放上梯度板，S级只有一个

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：横移扫过（lateral_track）；商品亮相：焦点转移（focus_shift）；背书：缓慢推近（slow_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：把同类5-8件商品逐个放上S/A/B梯度板，每件一句理由，有褒有贬增可信，S级压轴挂车；评级理由须真实，不贬损点名竞品。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3196)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 热点引入 · topic_pitch

借当下热议话题开场，话题自然滑向商品

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：借当下热议话题/热梗开场吸引，话题自然滑向商品，使用效果收尾；话题与商品关联须自然真实，不硬蹭不消费灾难事件。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3237)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 原相机实测 · no_filter_test

承诺全程不开美颜不打光，原相机直出

- 适配标签：美妆护肤。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"none"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开场承诺「全程不开美颜不打光」，原相机实测过程，前后对比放大真实感；对比条件一致，效果不夸大。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3250)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 痛点三连问 · triple_pain

三个戳心问句连续轰炸，我知道因为我也是

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：痛点种草。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；商品亮相：拉远揭示（pull_reveal）；展示/演示：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：连续三个戳心问句轰炸开场，「我知道，因为我也是」共鸣转折，方案+证据链收尾；痛点真实存在，不制造焦虑不做功效承诺。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3277)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 听劝改版 · listen_advice

网友建议逐条截图，听劝全改了再来验收

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：反转。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：微距滑移（macro_glide）；商品亮相：拉远揭示（pull_reveal）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：上期网友建议逐条截图开场，「听劝，全改了」逐条对照落地展示，改后成果+继续征集下轮意见；引用建议与改进须真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3329)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 私信刷屏 · dm_flood

一天238条私信都在问它，行，扒出来了

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：拉远揭示（pull_reveal）；展示/演示：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：私信截图铺屏「求链接」开场，揭晓被问爆的同款，给出获取方式+饥饿感收尾；私信数量与截图须真实，不得伪造互动数据。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3342)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 家庭群转发 · family_forward

值得转进家庭群的实用提醒，商品是答案

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：实用提醒/安全科普定调（值得转发的有用感），「转给家里人看看」号召，商品作为解决方案自然嵌入；科普内容须准确有据。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3368)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 发疯文学 · meltdown_lit

情绪拉满夸张自嘲，商品是救命稻草

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；商品亮相：拉远揭示（pull_reveal）；收尾引导：推近定住（push_then_hold）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：情绪拉满的夸张自嘲开场（大声控诉打工人日常），发疯的理由=商品能解的痛点，商品作为「救命稻草」癫式收尾；夸张属情绪表达，事实与功效不虚构。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3409)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 废话文学 · nonsense_lit

这件衣服最大的优点是它真的是一件衣服

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：一本正经的废话句式把人逗留住，反差急转抛出真卖点，再补一句废话自嘲收尾；废话是钩子，中段卖点须扎实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3422)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 坦白恰饭 · honest_ad

先说清楚这期是广告，但话我照说

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开头直接自曝「这期广告」+利益相关声明，内容照常硬核不注水，「该夸夸该说说，不买也没关系」收尾；广告身份公开是核心信任机制。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3435)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 明贬暗褒 · mock_roast

通篇吐槽金主，槽点讲着讲着全是卖点

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：反转。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：甩镜切换（whip_pan）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：通篇「吐槽」产品开场（最大的问题就是让我找不到问题），槽点讲着讲着全变卖点，结尾摊手式软转化；吐槽是修辞，卖点信息须真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3448)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 硬核浓缩 · recut_dense

40分钟深度测评浓缩60秒，只留干货

- 适配标签：数码3C。画面形态：图文混剪。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：横移扫过（lateral_track）；商品亮相：焦点转移（focus_shift）；背书：缓慢推近（slow_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：长测评结论前置开场，高信息密度快讲核心数据与对比，「完整版看主页」收尾；数据结论须与完整测评一致，不断章取义。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3474)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 金牌月嫂帖 · nanny_pick

带过87个宝宝的月嫂，包里只带这三样

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：职业资历钩子开场（干了12年月嫂），实操护理手法演示中产品自然入镜，一句职业断言收尾；职业资历须真实不虚构，不做育儿医疗功效承诺。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3542)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 鉴定师日常 · appraiser_desk

粉丝网购件上仪器，做工成色逐项过堂

- 适配标签：服饰鞋包。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；背书：缓慢推近（slow_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"none"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：粉丝寄件/网购件上桌，放大镜+仪器逐项看做工镶嵌成色，报参考估值后顺势讲自家同价位对比；鉴定资质如实标注，估值仅供参考，不贬损点名他家。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3699)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 三数走坡法 · method_1230

不会跑步没关系，记住12、3、30就行

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；背书：缓慢推近（slow_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：数字钩子开场（记住三个数字：12坡度、3速度、30分钟），上机演示设置，30天体感与数据反馈收尾；体感表述真实，不承诺减脂效果。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3727)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 教练开处方 · coach_rx

镜前自测中招的往下看，三步动作方案

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：痛点自查钩子（久坐党先对镜自测这个动作），教练三步动作方案，器械辅助演示对比徒手，打卡召集收尾；教练资质如实，不做医疗康复承诺。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3781)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 学霸笔记法 · note_system

从倒数到前十，只改了记笔记的方式

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：反转。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：成绩反差钩子，三色分区/康奈尔笔记法实操演示，工具逐个出场，成品笔记翻页+文具清单收尾；成绩表述真实不夸大，方法讲解须可操作。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3846)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 广场舞领队款 · dance_squad

我们队38个姐妹，这套裙子人手两条

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：横移扫过（lateral_track）；背书：拉远揭示（pull_reveal）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：队形整齐亮相钩子（同款服装舞步），领队近景讲面料/弹性/显瘦，集体转身定格+团购口令收尾；团购信息真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4013)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 热量换算体 · calorie_math

这一整袋，才半个苹果的热量

- 适配标签：食品零食。画面形态：图文混剪。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「猜猜这袋才多少大卡」设问钩子，热量换算成苹果个数/爬楼层数具象参照物上屏，解馋不怕胖话术+囤货装收尾；热量与0糖0脂表述须与营养成分表一致，不作减肥功效宣称。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4235)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 报数推码 · size_call

报上身高体重，评论区给你推码

- 适配标签：服饰鞋包。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：弧形环移（arc_quarter）；商品亮相：横移扫过（lateral_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「160/130斤的妹妹看过来」点名钩子，主播报自己身高体重上身试穿讲哪里藏肉，评论区报身高体重给你推码的互动收尾；身材数据真实，推码建议不绝对化。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4403)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 脸型选镜法 · face_frame_match

圆脸千万别戴这种框

- 适配标签：服饰鞋包。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：推近定住（push_then_hold）；展示/演示：弧形环移（arc_quarter）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「圆脸千万别戴这种」否定式钩子，同一张脸连试三副框型逐一点评显胖显小，报出脸型对号入座+多框型链接收尾，评论区晒脸求配镜。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4459)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 信任购亮牌 · guarantee_first

先看保障再讲货，敢承诺才敢卖

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：焦点转移（focus_shift）；背书：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开头不讲货先亮保障——真实退款记录与三大保障标识钩子，中段讲货每个卖点跟一句「不满意这单我赔」，「敢承诺才敢卖」收口引导下单；保障与赔付表述必须真实可举证。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4596)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 总裁下场实测 · ceo_test

让造它的人，自己用给你看

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：缓慢推近（slow_push）；痛点：焦点转移（focus_shift）；展示/演示：弧形环移（arc_quarter）；背书：手持实拍感（handheld_real）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「让造它的人自己用给你看」钩子，创始人/总裁亲自演示核心功能并正面回应差评质疑，「有问题直接@我」个人信誉背书收尾；出镜身份真实，回应差评不贬损他人。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4690)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 以旧换新算账 · trade_in_math

旧冰箱不花钱扔，还能抵800

- 适配标签：家居日用、数码3C。画面形态：场景演示。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「旧冰箱不但不花钱扔还能抵800」钩子，旧机上门回收实拍+国补/平台补/换新三层补贴叠加算账上屏，「补贴池用完就没先锁资格」收尾；补贴政策有时效与地域限制，过期表述属虚假宣传。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4703)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 购物车大公开 · cart_audit

购物车47件，当场三判去留

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「双11购物车大公开，一共47件」钩子，逐件说加购理由当场执行必买/观望/踢出三判，「评论区交出你的购物车」观众陪审收尾；判断理由真实不软广注水。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4797)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 全民选款投票 · vote_drop

五个打样款，只量产你们投的

- 适配标签：服饰鞋包。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：横移扫过（lateral_track）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「这5个打样款，只量产你们投出来的」钩子，逐款讲设计点发起评论区投票，「投票的人拿首发价，一周后开产」收尾；投票结果与量产承诺必须兑现，预售发货时限遵守平台规则。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4891)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 蓝包好礼演示 · blue_packet

不知道TA地址，也能把礼物送到

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「不知道TA地址，也能把礼物送出去」钩子，演示发蓝包流程——选礼→发到聊天框→对方自填地址，对方拆礼反应收尾「现在就发一个试试」；流程演示与功能现状一致。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4986)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 讲书拆页带货 · page_pitch

翻开这一页，讲透一个扎心观点

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：书中一个扎心金句或反常识观点钩子，翻开实体书讲透一页、镜头怼纸张印刷质感，「这套给孩子/给自己」收尾；引用观点忠于原书不断章取义。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4999)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 养生同龄人说 · peer_wellness

45岁的我，状态比十年前还好

- 适配标签：食品零食。画面形态：场景演示。脚本：人设口播。
- 运镜编排：开头钩子：缓慢推近（slow_push）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：同龄博主状态对比钩子（40+的精气神），健康生活方式vlog中滋补品自然融入日常，预约直播/进群领食谱收尾；红线：严禁疾病治疗功效宣称，「指标改善」类表述高危禁用，只做生活方式叙事，保健食品需蓝帽子资质。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5012)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 糙手丑广告 · ugly_ad

故意拍丑的广告，反而跑赢棚拍

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"none","bgmDuck":false}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：故意粗糙的手机竖拍+画板风大字箭头钩子，原生感口播直给卖点不绕弯，截图式促销卡收尾；丑是设计不是敷衍——低保真排版信息密度要高，卖点表述真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5054)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 当然如此体 · of_course

我们是手作小店，当然……

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：手持实拍感（handheld_real）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「我们是XX店，当然……」自嘲开场钩子，连环「当然」清单展示行业怪癖同时带出商品细节，最后一条「当然」落在优惠上收尾；自嘲内容真实贴店铺人设。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5067)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 屈指自测局 · finger_down

符合一条弯一根手指，弯三根你就需要它

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：推近定住（push_then_hold）；展示/演示：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「符合一条弯一根手指」游戏规则钩子，五条痛点清单逐条报出镜头前弯手指，「弯了三根以上你需要它」转商品收尾；痛点清单避开医疗宣称（不提湿疹脱发等病症治疗）。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5106)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 盲排锁位赛 · blind_rank

当场锁进档位，不许反悔

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：逐个揭晓商品必须当场锁进档位不可反悔的规则钩子，后出现的更强款造成「排早了」的懊悔喜剧，揭榜后报最优解挂车收尾；排位结论真实，懊悔反应可演绎但标注。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5119)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 实习生掌号 · intern_post

老板说随便发，那我真随便了

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「老板让我随便发」越权感钩子，实习生视角吐槽式介绍商品与公司日常，「点赞过万我就不被开除」玩梗收尾；出镜员工需肖像与劳务授权，吐槽不涉不实信息。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5132)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 街头穿搭报价 · outfit_worth

逐件报价，这身一共多少钱

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：采访。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：横移扫过（lateral_track）；商品亮相：焦点转移（focus_shift）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：拦人逐件报穿搭价格钩子，单件累加计总价的清点节奏字幕跟跳，「同款/平替在橱窗」挂车收尾；路人出镜需肖像授权，报价真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5158)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 毒舌奶奶体 · sassy_granny

不许教我做事，链接在下面

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：手持实拍感（handheld_real）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：奶奶毒舌宣言钩子（不服老人设），试用年轻人商品锐评每一件，「不许教我做事，链接在下面」收尾；老人形象是潮流主角不做消费式丑化，人物真实出镜。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5290)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 男友猜妆局 · bf_guess

他猜50，其实199

- 适配标签：美妆护肤。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「让男友说出这是什么」钩子，连环猜名/猜用途/猜价格的外行喜剧每猜一次给正确科普，「他猜50其实199」反差落点挂车收尾；科普信息准确，猜谜互动真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5303)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### AI素人开麦 · ai_ugc_actor

AI演员口播证言，批量换钩子做A/B

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：AI素人对镜口播痛点钩子，标准证言结构（问题-试用-效果）批量变体不同开头做A/B投放；红线：AI标识必打，医疗/金融等数字人限制类目不可用，不得伪造真实消费者身份，效果表述不夸大。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5371)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。


## 剧情叙事

### 剧情反转 · drama_flip

希区柯克变焦打反转，剧情带货记忆点拉满

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：反转。
- 运镜编排：开头钩子：希区柯克变焦（dolly_zoom）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：前半段铺垫冲突，反转点干净利落，商品是解决方案不是主角台词。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L123)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 真香反转 · skeptic_flip

本来不信→亲测真香，怀疑者转粉最有说服力

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：反转。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：希区柯克变焦（dolly_zoom）；展示/演示：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开场明确表达怀疑，试用过程如实记录，转变理由具体可信，不演过头。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L345)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 情景短剧 · mini_drama

双人冲突开场，商品是解围的那个人

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：情景短剧。
- 运镜编排：开头钩子：希区柯克变焦（dolly_zoom）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：家庭或办公室双人对话冲突开场，商品在剧情转折处自然出现化解矛盾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L358)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 工厂溯源 · founder_story

老板带你看产线，源头实拍砍掉中间商话术

- 适配标签：食品零食、家居日用。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：第一视角（pov_walk）；展示/演示：跟随镜头（follow_track）；背书：横移扫过（lateral_track）；商品亮相：英雄仰拍（hero_rise）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以探厂视角走进车间，展示真实产线与工艺环节，源头信息需真实可核。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L371)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 效果日记 · day_timeline

第1天到第21天时间线记录，过程即证据

- 适配标签：美妆护肤。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：按时间节点记录使用过程与变化，描述客观不承诺效果，避免绝对化用词。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L385)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 探店转同款 · store_to_home

排队名店实拍→在家复刻同款，发现感带货

- 适配标签：食品零食。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：第一视角（pov_walk）；痛点：手持实拍感（handheld_real）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：先探店实拍排队盛况，转折「不用排队家里也能吃到」，居家复刻同款并同框对比；店铺信息真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L782)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 一周轻食打卡 · meal_prep_week

周一到周五餐盘快剪，自律感就是种草力

- 适配标签：食品零食。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：按周一到周五分段快剪每餐搭配，日历角标推进节奏；只讲食材搭配与饱腹感受，不承诺任何减重效果。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L810)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 试吃挑战 · taste_challenge

传说中最辣/最酸的它，表情比文案诚实

- 适配标签：食品零食。画面形态：人物讲解。脚本：反转。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：手持实拍感（handheld_real）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「传说中最XX的它」立挑战开场，真实试吃夸张但不做作的反应，结尾反转好评或诚实劝退。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L824)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 租房改造记 · rental_makeover

五百块改出出租屋新家，分区报价爽文节奏

- 适配标签：家居日用。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：第一视角（pov_walk）；展示/演示：横移扫过（lateral_track）；商品亮相：升镜展开（crane_up）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：空镜惨状开场，分区改造逐项报价格，全屋成果环绕展示收尾；预算与价格信息真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L896)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 智能家居一天 · smart_home_day

从自动窗帘到一键关全屋，未来感生活流

- 适配标签：家居日用、数码3C。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：第一视角（pov_walk）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「我家没有开关」开场，按一天时间线逐幕演示场景联动，设备响应特写，晚安一键关全屋收尾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L966)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 买家秀实测 · real_vs_listing

网图vs我实拍同框对比，所见即所得

- 适配标签：服饰鞋包。画面形态：人物讲解。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：焦点转移（focus_shift）；展示/演示：横移扫过（lateral_track）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「网图vs我实拍」悬念开场，同款同姿势同框对比验证，实拍呈现真实不加滤镜修饰。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1038)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 素人改造 · style_makeover

改造前后走秀反差，爽点全在回眸一刻

- 适配标签：服饰鞋包。画面形态：人物讲解。脚本：反转。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：缓慢推近（slow_push）；展示/演示：跟随镜头（follow_track）；商品亮相：希区柯克变焦（dolly_zoom）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：素人改造前自然登场，选款换装过程快剪，改造后走秀慢镜回眸形成反差，情感真挚不做作。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1080)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 感恩送礼叙事 · gift_story

「她从不舍得给自己买」，反哺叙事暖到下单

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：剧情故事。
- 运镜编排：开头钩子：缓慢推近（slow_push）；痛点：手持实拍感（handheld_real）；商品亮相：微距滑移（macro_glide）；背书：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以长辈日常操劳的细节引共情，转折到「这次换我来」，礼物开箱与收礼反应收尾；情绪真挚忌苦情煽情。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1277)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 收礼反应 · gift_reaction

拆礼物第一反应实录，惊喜表情即种草

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：场景安利。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；商品亮相：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以收到礼物拆箱的第一反应开场，展示细节讲为什么惊喜，「暗示对象来抄作业」收尾，反应自然不摆拍。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1316)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 心动礼物 · valentine_sweet

情侣惊喜视角送礼，甜而不腻的种草

- 适配标签：美妆护肤、服饰鞋包。画面形态：人物讲解。脚本：剧情故事。
- 运镜编排：开头钩子：缓慢推近（slow_push）；商品亮相：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以给伴侣准备惊喜的视角展开，选礼理由讲得具体走心，收礼瞬间自然收尾，甜而不腻。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1343)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 成果前置 · proof_first

先甩最终效果再倒叙过程，眼见为实的结构

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：反转。
- 运镜编排：开头钩子：英雄仰拍（hero_rise）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：第一镜直接放最终成果，随后倒叙「之前有多糟→中间发生了什么」，商品是过程中的变量；成果真实可复现。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1466)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 源头人叙事 · sympathy_source

田间地头的种植者自述，朴素镜头讲源头价

- 适配标签：食品零食。画面形态：人物讲解。脚本：剧情故事。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：第一视角（pov_walk）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以种植者/生产者身份在田间地头自述，画面朴素纪实，讲清源头到手价的逻辑；身份与产地必须真实，不卖惨表演。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1534)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 文案金句风 · poetic_sell

金句慢节奏铺情绪，商品只是注脚

- 适配标签：食品零食。画面形态：人物讲解。脚本：剧情故事。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以有画面感的金句文案开场铺情绪，慢节奏字幕海报化呈现，商品在情绪落点处轻轻带出，文艺不堆砌。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1618)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 档口直发 · stall_direct

批发档口拿货现场，手持纪实感砍掉中间商

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：第一视角（pov_walk）；展示/演示：手持实拍感（handheld_real）；商品亮相：跟随镜头（follow_track）；背书：横移扫过（lateral_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"none","bgmDuck":false,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以走进批发档口/工厂仓库的第一视角开场，拿货现场手持纪实感，讲清直发省掉的环节；货源信息真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1632)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 闺蜜对话 · bestie_talk

双人闺蜜互相安利，对话里全是真心话

- 适配标签：美妆护肤、服饰鞋包。画面形态：人物讲解。脚本：情景短剧。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；背书：横移扫过（lateral_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：双人闺蜜对话体，一方安利一方追问质疑，追问替观众问出真实顾虑，对话自然像日常聊天。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1674)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 办公室情景剧 · office_skit

工位整活好物解围，同事围观求链接

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：情景短剧。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；背书：横移扫过（lateral_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：办公室日常整活开场，好物解决工位痛点成为剧情转折，同事围观「求链接」收尾，场景喜剧感自然。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1688)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 缝合热点 · stitch_trend

接住热门话题再切自己视角，借势不硬蹭

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：焦点转移（focus_shift）；展示/演示：跟随镜头（follow_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开场承接一个热门话题或讨论，转折切入自己的新角度，商品作为观点的落地方案，借势自然。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2002)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 全网种草验证 · viral_made_me_buy

「刷到十次终于买了」，热度亲测是真是假

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：反转。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：微距滑移（macro_glide）；背书：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「全网都在推，刷到第十次终于下单」开场，复述网上的说法再逐条亲测验证；热度与测试结果真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2056)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 下单叙事体 · storytime_buy

微型故事推进，「所以我下单了」当结局

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：剧情故事。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：希区柯克变焦（dolly_zoom）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以一段有人物有场景的微型故事推进（那天发生了什么），情节自然走到「所以我下单了」作为故事结局。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2095)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### POV场景代入 · pov_relatable

「POV:凌晨还在赶稿的你」，场景即人群

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：场景安利。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：焦点转移（focus_shift）；展示/演示：第一视角（pov_walk）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「POV:你正处在XX场景」的第二人称代入开场，场景演到情绪点商品入场终结困境，代入感强。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2151)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 翻车喜剧 · fail_comedy

先演翻车惨状再上正解，笑点垫高卖点

- 适配标签：食品零食、家居日用。画面形态：人物讲解。脚本：情景短剧。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：希区柯克变焦（dolly_zoom）；展示/演示：跟随镜头（follow_track）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：先演一段翻车惨状小品（厨房灾难/手残现场），慢镜回放放大笑点，商品作为正解收场，喜剧夸张但结果真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2178)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 视频会议剧 · zoom_call

线上会议九宫格里的小剧场，职场梗带货

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：情景短剧。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：焦点转移（focus_shift）；展示/演示：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以线上视频会议画面为舞台演职场小剧场，会议中的尴尬/救场成为剧情，商品在剧情转折处出场。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2192)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 手作工坊 · craft_hands

双手打磨制作近景，匠心温度眼见为实

- 适配标签：家居日用、服饰鞋包。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；商品亮相：降镜聚焦（crane_down_close）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以双手制作/打磨商品的近景为主线，工坊光影与工具声音营造匠心感；手作工艺描述必须真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2290)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 仿妆挑战 · copy_makeup

复刻热门妆容全过程，像不像你说了算

- 适配标签：美妆护肤。画面形态：人物讲解。脚本：剧情故事。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；背书：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以复刻某个热门妆容立挑战，过程逐步跟拍关键手法，结尾对照原妆自评像不像，趣味挑战感。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2390)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 续航一整天 · battery_day

早八到晚十不充电，电量角标全程记录

- 适配标签：数码3C。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：第一视角（pov_walk）；商品亮相：焦点转移（focus_shift）；背书：手持实拍感（handheld_real）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「一整天不充电」立挑战，按时间线记录各时段用途与剩余电量角标，结尾公布真实结果；数据不造假。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2488)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 爸妈初体验 · parent_tryout

长辈第一次上手实录，真实反应破圈层

- 适配标签：数码3C、家居日用。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；背书：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：记录长辈第一次上手使用的全过程，疑问吐槽与被打动都保留，代际反应真实自然，温情不摆拍。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2545)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 七天挑战 · seven_day_challenge

连用七天每天打卡，变化过程全记录

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：手持实拍感（handheld_real）；商品亮相：微距滑移（macro_glide）；背书：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「连用七天会怎样」立挑战，每天一段打卡记录使用感受，第七天总结变化；描述客观不承诺效果。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2585)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 逆袭叙事 · glow_up_story

从谷底到发光的蒙太奇，商品是关键道具

- 适配标签：服饰鞋包、美妆护肤。画面形态：人物讲解。脚本：剧情故事。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：希区柯克变焦（dolly_zoom）；展示/演示：跟随镜头（follow_track）；商品亮相：英雄仰拍（hero_rise）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以低谷状态开场，改变过程用蒙太奇快剪推进，商品是过程中的关键道具而非全部功劳，励志真实不夸大。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2598)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 质检流程实拍 · qc_process

出厂前的每道检验实拍，标准眼见为实

- 适配标签：食品零食、家居日用。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；背书：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以商品出厂前的质检流程为主线，逐道检验环节实拍讲标准，细节严谨感建立信任；流程与标准真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2682)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 店主的一天 · shop_owner_day

接单打包发货日常，小店的人情味带货

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：第一视角（pov_walk）；展示/演示：手持实拍感（handheld_real）；商品亮相：微距滑移（macro_glide）；背书：俯拍下降（overhead_top）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以小店主视角记录一天：理货接单打包发货，穿插与顾客的暖心互动，人情味与烟火气是主角。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2696)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 环保叙事 · eco_story

可回收材质与低碳工艺，价值观也是购买理由

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；背书：俯拍下降（overhead_top）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以材质来源与环保工艺为叙事线，克制讲述不说教；环保宣称必须有依据，不做漂绿式夸大。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2789)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 国潮叙事 · guochao_pride

传统元素撞现代设计，国货情怀正当红

- 适配标签：服饰鞋包、食品零食。画面形态：商品特写。脚本：剧情故事。
- 运镜编排：开头钩子：缓慢推近（slow_push）；商品亮相：环绕展示（orbit_slow）；展示/演示：微距滑移（macro_glide）；背书：焦点转移（focus_shift）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true,"quality":"hd","productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以传统文化元素与现代设计的碰撞为主线，讲设计灵感与工艺传承，情怀真挚不空喊口号。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2802)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 另一半盲评 · partner_react

让直男/女友盲评，局外人视角意外真实

- 适配标签：美妆护肤、服饰鞋包。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；背书：焦点转移（focus_shift）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：让不懂行的另一半盲评（猜用途/猜价格/给打分），外行视角的真实反应制造笑点与说服力，互动自然。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2829)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 一家三代同款 · family_generations

从奶奶用到孙女，全家人的共同选择

- 适配标签：食品零食、家居日用。画面形态：人物讲解。脚本：剧情故事。
- 运镜编排：开头钩子：缓慢推近（slow_push）；背书：横移扫过（lateral_track）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：一家三代各自讲跟这个商品的故事，代际视角不同但都在用，家庭温情与传承感真实动人。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2843)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 旧物翻新 · restore_revive

把旧物一步步救活，翻新过程即产品实力

- 适配标签：家居日用、服饰鞋包。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：微距滑移（macro_glide）；痛点：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以一件破旧物品开场（旧包/旧鞋/旧家具），用商品一步步翻新救活，前后对比即产品实力；翻新效果真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2870)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 希望蒙太奇 · hopecore

治愈画面配励志字幕，商品是小确幸

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：剧情故事。
- 运镜编排：开头钩子：缓慢推近（slow_push）；痛点：手持实拍感（handheld_real）；商品亮相：焦点转移（focus_shift）；收尾引导：升镜展开（crane_up）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：治愈画面+励志字幕蒙太奇，商品作为「小确幸」出现在日常瞬间，以善待自己式文案收尾，情绪真挚不贩卖焦虑。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3032)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 短剧切片 · drama_clip_cart

截取短剧最强冲突30秒，挂车剧中同款

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：情景短剧。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：按剧情短剧高光切片写：最强冲突30秒，冲突顶点戛然而止留悬念，挂剧中同款+引导看全集；剧情标注演绎。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3303)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 连载追更 · serial_hook

固定人设每集一个小冲突，结尾埋钩养追更

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：情景短剧。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；商品亮相：焦点转移（focus_shift）；展示/演示：跟随镜头（follow_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：连载体：固定人设+本集小冲突（可写「第N集」），商品作剧情道具反复自然出现，结尾埋下集悬念养追更；剧情标注演绎。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3316)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 银发关怀 · silver_care

爸妈家最容易出事的角落，别等出事才想起

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：痛点种草。
- 运镜编排：开头钩子：缓慢推近（slow_push）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：中老年真实风险/痛点场景重现（防滑/起夜/操作难），情感化提醒「别等出事才想起」，商品方案收尾；不贩卖恐慌，不做医疗功效承诺。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3355)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 好运寓意 · lucky_charm

寓意讲解加仪式感，商品是好运的载体

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：剧情故事。
- 运镜编排：开头钩子：缓慢推近（slow_push）；商品亮相：转台展示（lazy_susan）；展示/演示：微距滑移（macro_glide）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：好运话题开场（求顺/求财/考试季），寓意讲解（符号与祝福的文化含义），商品=好运载体+仪式感收尾；寓意属文化表达，不得承诺运势改变或迷信功效。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3501)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 爸爸独带日 · dad_solo_day

妈妈出门48小时，爸爸靠装备逐关通关

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：妈妈出门24-48小时钩子，爸爸靠装备逐关通关（冲奶/辅食/哄睡），妈妈回家验收惊讶收尾；奶爸叙事真实幽默不刻板化。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3594)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 监控视角 · pet_cam

上班摸鱼看监控，发现我猫背着我干这事

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；商品亮相：缓慢推近（slow_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：出门上班钩子，监控画面时间戳快剪：宠物独自使用自动喂食器/饮水机/玩具，下班回看「它比我过得好」收尾；监控画面真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3672)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 货车师傅装备 · trucker_rig

一年30万公里，驾驶室就是家，这几样保命

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：缓慢推近（slow_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：驾驶室生活钩子（在车上住了8年），驾驶室好物逐件讲（车载冰箱/床垫/支架），跑长途实用验证收尾；职业身份与使用体验真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3807)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 婆媳厨房剧 · inlaw_kitchen

婆婆提前两小时到，我把命交给了这台锅

- 适配标签：家居日用、食品零食。画面形态：场景演示。脚本：情景短剧。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：婆婆突袭钩子，小家电救场做出硬菜/收拾残局，态度反转产品露正脸收尾；剧情标注演绎，人物关系幽默不制造家庭对立。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3943)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 上门安装实录 · install_day

师傅上门那两小时，才是大家电的真面目

- 适配标签：家居日用。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：敲门开箱钩子，安装难点直击（打孔/走线/调平），完工验收开机第一响收尾；安装过程真实记录，服务体验如实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3957)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 异地尽孝装 · filial_kit

在外打工的第6年，给爸妈装了三样东西

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：缓慢推近（slow_push）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：牵挂钩子（离家1200公里，爸妈生病都不说），远程守护装备安装教学（摄像头/一键呼叫/智能药盒），手机端看到爸妈安好收尾；情感真挚不贩卖焦虑，设备功能演示真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4027)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 舍不得换新 · worn_out_swap

我妈的枕头比我年龄都大，偷偷换了新的

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：微距滑移（macro_glide）；痛点：缓慢推近（slow_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：回家发现钩子（用了十年起球的旧物），心疼、偷偷下单换新，爸妈嘴上嫌贵、镜头里天天在用收尾；收在新物融入日常的平实画面，情感克制真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4040)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 微醺独酌 · solo_buzz

一个人的小酒，给今天收个尾

- 适配标签：食品零食。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：缓慢推近（slow_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：加班回家灯光调暗开瓶声起的情绪钩子，倒酒配小食追剧泡脚的独处画面，「给今天收个尾」文案收尾；酒类红线：不诱导过量饮酒、不面向未成年人、不宣称解压疗效，平台需酒类资质挂车。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4179)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 朋克养生 · punk_wellness

熬最晚的夜，泡最浓的枸杞

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：缓慢推近（slow_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：凌晨一点还在赶稿的自嘲钩子「熬夜是不可能戒的」，保温杯泡枸杞的赎罪式日常，同款熬夜自救包清单收尾；滋补类严禁功效医疗宣称（不说护肝抗衰提高免疫力），只做生活方式陪伴表达。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4221)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 绿植急救站 · plant_rescue

九块九捡的烂根绿萝，能救活吗

- 适配标签：家居日用。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：微距滑移（macro_glide）；痛点：缓慢推近（slow_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：黄叶蔫垂的濒死绿萝特写钩子（9块9捡漏的烂根苗），诊断修根换盆上营养液，7天/30天新芽延时对比+救命装备清单收尾；能不能救活的连载悬念可追更。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4305)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 学琴进步轴 · practice_arc

Day 1 惨不忍睹，Day 90 完整成曲

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：缓慢推近（slow_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：Day1惨不忍睹的断续弹奏钩子，Day30/Day60节点逐段升级，Day90流畅成曲收尾「零基础用的就是这把」+入门套装；进步过程真实记录不代弹。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4486)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 直男送礼自救 · gift_rescue

去年送错礼的社死，今年不能重演

- 适配标签：美妆护肤、服饰鞋包。画面形态：场景演示。脚本：情景短剧。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：重现去年送错礼社死名场面的喜剧钩子（离谱包包/踩雷色号），「今年学乖了」给出保命清单+踩雷原理，「离情人节还有N天现在下单还来得及」倒计时收尾；剧情演绎标注虚构。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4717)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 爱己自礼体 · self_gift

没有对象，这个节先宠自己

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：缓慢推近（slow_push）；痛点：手持实拍感（handheld_real）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「没有对象，七夕就不配过了吗」反问钩子，给自己下单的仪式感开箱+「我值得」独白，「这份礼先给自己」收尾；悦己叙事真诚不贩卖焦虑。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4731)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 清空妈妈购物车 · mom_cart

偷看我妈购物车，全是舍不得买的

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：微距滑移（macro_glide）；痛点：缓慢推近（slow_push）；展示/演示：焦点转移（focus_shift）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「偷看了我妈的购物车，全是舍不得买的」钩子，逐件读购物车里的省钱理由并全部拍下，妈妈收货嘴硬眼红的反应收尾「你妈购物车里也藏着话」；情感真实不摆拍煽情。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4744)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 老爸兴趣装备局 · dad_hobby

我爸的钓箱比我岁数都大

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：微距滑移（macro_glide）；痛点：缓慢推近（slow_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「我爸的钓箱比我岁数都大」钩子，深挖父亲沉默的爱好并整套升级装备，爸爸嘴上「乱花钱」手上已经用起来的反差收尾「他不说，但他想要」。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4757)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 交换礼物局 · gift_exchange

预算50，看谁抽到最离谱的

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：情景短剧。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：手持实拍感（handheld_real）；商品亮相：焦点转移（focus_shift）；背书：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「预算50，看谁的礼物最离谱」钩子，多人抽签交换拆箱翻车与惊喜反应对撞，「预算50/100/200的交换礼物清单我整理好了」收尾；多人反应真实，剧情类标注演绎。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4810)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 返乡后备箱 · trunk_load

过年回家，后备箱就是我的排面

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：拉远揭示（pull_reveal）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「过年回家，后备箱就是我的排面」钩子，清点给各亲戚的礼并讲分配逻辑（舅爱茶、姥腿疼、侄子上学），「亲戚礼一站备齐直接抄清单」收尾；涉白酒遵守酒类广告限制，保健品不得宣称疗效。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4837)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 开渔现捞记 · fresh_catch

起网那一刻，今晚就发冷链

- 适配标签：食品零食。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：升镜展开（crane_up）；展示/演示：手持实拍感（handheld_real）；商品亮相：微距滑移（macro_glide）；背书：跟随镜头（follow_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：起网瞬间海量渔获的奇观钩子，船上现场分拣定级报当日船价，「今晚发冷链明早到你家」时效承诺收尾；产地真实性红线——必须真实实景拍摄，严禁绿幕假产地。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4850)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 突袭开仓验货 · warehouse_audit

不打招呼，随机指箱开验

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：反转。
- 运镜编排：开头钩子：第一视角（pov_walk）；展示/演示：手持实拍感（handheld_real）；商品亮相：微距滑移（macro_glide）；背书：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「不打招呼直接杀到发货仓」钩子，随机指箱开箱验质查生产日期与库存环境，「验过的仓我才敢挂链接」收尾；抽检过程真实不彩排，验货结果如实呈现。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4878)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 玩偶伦理剧 · figurine_drama

玩偶界的狗血剧，商品是关键道具

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：情景短剧。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：静态玩偶摆拍+字幕旁白狗血剧情钩子（误会/反转），商品作为剧情关键道具反复出镜，剧情悬念处停评论区追更收尾；必须用自制或AI原创角色，严禁使用他人IP玩偶，剧情标注虚构演绎。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5041)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 家底揭示体 · holy_airball

他以为就是个小作坊，直到……

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：反转。
- 运镜编排：开头钩子：缓慢推近（slow_push）；痛点：手持实拍感（handheld_real）；展示/演示：横移扫过（lateral_track）；商品亮相：升镜展开（crane_up）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「我说我家是做袜子的」平淡自述钩子，「他以为就是个小作坊」误解卡，连环揭示层层亮底牌（三代工厂/出口30国/明星同款），「现在直接卖给你」收尾；背书证据必须真实可查，不炫富导向。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5080)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 老板轮岗记 · boss_shift

今天CEO来打包，被员工纠正三次

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：情景短剧。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「今天CEO来打包」身份反差钩子，老板笨拙上岗被员工纠正的过程带出品控细节，「每单都这么打包」信任收尾；轮岗过程真实纪实，反差喜剧不摆拍造假。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5145)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 教室焕新记 · classroom_setup

空教室到开学第一天，全程加速

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：拉远揭示（pull_reveal）；展示/演示：横移扫过（lateral_track）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：空教室毛坯态钩子，加速布置蒙太奇收纳装饰教具逐件安利，开学第一天成品揭晓清单挂车收尾；成品揭晓避免学生儿童出镜，教师侧视角吃返校季流量。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5317)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 备婚清单记 · wedtok_diary

距婚礼90天，今天解决伴手礼

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「距婚礼90天」倒计时钩子，每集解决一个备婚事项（伴手礼/试妆/收纳）的连载结构，「同款备婚清单」挂车+追更收尾；人生节点强情绪窗口，清单真实可抄。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5344)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。


## 生活种草

### 生活场景种草 · lifestyle_seed

真实生活氛围软种草，不硬广更耐看

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：第一视角（pov_walk）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：像朋友分享日常一样自然，把商品融进真实生活场景，避免促销腔。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L84)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 晨间流程 · morning_routine

起床到出门的routine植入，生活流最软广告

- 适配标签：美妆护肤、家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：第一视角（pov_walk）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：按晨间时间线串起多个生活动作，商品作为流程一环自然出现，不打断节奏。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L401)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 沉浸体验 · immersive_pov

全程第一视角沉浸使用，代入感就是种草力

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：第一视角（pov_walk）；展示/演示：手持实拍感（handheld_real）；商品亮相：降镜聚焦（crane_down_close）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：全程第一视角展示使用过程，保留环境音的真实感，旁白像自言自语。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L415)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 治愈ASMR · cozy_asmr

沉浸声音质感，无BGM保留原声解压

- 适配标签：食品零食、美妆护肤。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：微距滑移（macro_glide）；商品亮相：降镜聚焦（crane_down_close）；展示/演示：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none","bgmDuck":false,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以声音质感为主线（开合、倾倒、揉捏等），画面慢而近，文案降到最少。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L428)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 氛围感Vlog · vlog_soft

柔光滤镜+浅景深，唯美氛围里顺手安利

- 适配标签：美妆护肤、服饰鞋包。画面形态：人物讲解。脚本：场景安利。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：手持实拍感（handheld_real）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：整体唯美松弛的vlog氛围，先给情绪再给商品，安利像随口一提。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L442)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 改造对比 · home_makeover

改造前后强对比，成就感替你卖货

- 适配标签：家居日用。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：希区柯克变焦（dolly_zoom）；痛点：手持实拍感（handheld_real）；展示/演示：横移扫过（lateral_track）；商品亮相：升镜展开（crane_up）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：先给改造前的杂乱现状，过程快剪，结尾大空间揭示改造后效果形成反差。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L456)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### GRWM跟妆 · grwm_routine

边化边唠的镜前跟妆，种草像闲聊

- 适配标签：美妆护肤、服饰鞋包。画面形态：人物讲解。脚本：场景安利。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「今天有约，跟我一起化」开场，镜前第一人称边化边聊步骤手法，商品在步骤中自然出场。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L640)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 化妆台一角 · vanity_tour

化妆台横移扫过，真爱清单逐件抓拿

- 适配标签：美妆护肤。画面形态：商品特写。脚本：场景安利。
- 运镜编排：开头钩子：横移扫过（lateral_track）；商品亮相：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「化妆台从不留白占地方的东西」开场，镜头横移扫过台面，逐件拿起讲使用频率与真爱理由。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L668)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 深夜放毒 · midnight_crave

十二点的暗调暖光+冒热气，馋是会传染的

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「十二点了，睡不着的进」低声开场，暗调暖光下加热/烹煮冒热气，吃第一口的满足表情收尾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L754)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 工位零食抽屉 · office_snack

拉开打工人快乐抽屉，摸鱼式逐件安利

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；展示/演示：手持实拍感（handheld_real）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：拉开工位抽屉「打工人快乐源泉」开场，办公室场景逐件安利并当场吃，点名回购最多的一款。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L768)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 宝宝辅食日记 · baby_food

妈妈视角做辅食，空碗就是最好的测评

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：妈妈第一视角记录做辅食过程，配料与营养描述必须与配料表一致，宝宝吃光空碗自然收尾，不做医疗营养宣称。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L796)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 沉浸式做饭 · silent_cooking

无口播切菜下锅声，商品在烟火气里出场

- 适配标签：食品零食、家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none","bgmDuck":false,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：无口播，以切菜下锅的环境声为主线完整做一餐，商品（酱料/锅具）在流程中自然用到，字幕点出关键卖点。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L838)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 一人食 · solo_dining

一个人也要好好吃饭，治愈系独食收尾

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「一个人也要好好吃饭」独白开场，快手做一餐，窗边独食治愈收尾，旁白像自言自语的治愈系。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L852)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 宝妈厨房 · mom_kitchen

有娃厨房的动线与安全经，务实种草

- 适配标签：家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：第一视角（pov_walk）；痛点：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以有娃家庭视角讲厨房布置，围绕动线、安全与效率逐件讲好物，做一餐验证顺手度，口吻务实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L938)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 今日穿搭OOTD · ootd_daily

一句话点题+逐件报单品，姐妹分享感

- 适配标签：服饰鞋包。画面形态：人物讲解。脚本：场景安利。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；展示/演示：横移扫过（lateral_track）；商品亮相：跟随镜头（follow_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：今日穿搭主题一句话点题，上衣裤子鞋包逐件报，整体look定格转身收尾，轻快日常口吻。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L982)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 通勤一周穿搭 · workweek_lookbook

周一到周五不重样，职场高效穿搭日历

- 适配标签：服饰鞋包。画面形态：人物讲解。脚本：剧情故事。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；展示/演示：横移扫过（lateral_track）；商品亮相：跟随镜头（follow_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：按周一到周五一日一套快切，每套配场合说明，办公室通勤实景感，口吻利落像职场前辈。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1024)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 桌面改造 · desk_setup

乱桌到梦中情桌，成品运镜大赏收尾

- 适配标签：数码3C。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：俯拍下降（overhead_top）；展示/演示：跟随镜头（follow_track）；商品亮相：横移扫过（lateral_track）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：乱桌惨状开场，理线支架灯光逐步升级，成品桌面夜景氛围灯运镜大赏收尾，数码美学感。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1138)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### EDC翻包 · edc_bag_dump

通勤包全家福逐件掏，效率人士的随身清单

- 适配标签：数码3C、服饰鞋包。画面形态：商品特写。脚本：场景安利。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「通勤包里都有什么」俯拍摊开全家福，逐件掏出讲用途，点名最离不开的一件收尾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1166)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 治愈慢生活 · healing_slow

温柔慢节奏收集生活美好，商品融进治愈感

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：全片温柔慢节奏，收集生活中的美好瞬间（阳光/热茶/植物），商品作为美好生活的一部分自然融入。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1550)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 真实感随手拍 · candid_raw

保留手机感与生活噪点，原生内容不像广告

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；展示/演示：第一视角（pov_walk）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：刻意保留随手拍的构图与光影瑕疵，像朋友圈随拍不像广告片；画面可以糙，内容必须真实不虚构。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1714)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 一日融入 · day_in_life

早午晚三时段跳切，商品长在生活时间线里

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：第一视角（pov_walk）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：按早/午/晚三个时段跳切一天生活，商品在每个时段自然出现一次，结尾回收「一天下来离不开它」。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2030)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 今日妆容MOTD · motd_look

今日妆容主题+用品清单，美妆版OOTD

- 适配标签：美妆护肤。画面形态：人物讲解。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以今日妆容主题开场（如奶杏妆/晒伤妆），成品妆容多角度展示后报用品清单，轻快像姐妹分享。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2362)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 化妆包翻包 · makeup_bag

随身化妆包逐件倒出，出街必备浓缩清单

- 适配标签：美妆护肤。画面形态：商品特写。脚本：场景安利。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：把随身化妆包倒出摊开，逐件讲为什么能进随身包（体积/补妆快/万能），浓缩感就是说服力。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2376)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 补货归位ASMR · restock_asmr

冰箱/收纳盒补货全程收音，整齐即治愈

- 适配标签：食品零食、家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none","bgmDuck":false,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：无口播补货流程：拆包装、倒进收纳盒、码进冰箱，全程保留窸窣原声，整齐画面即治愈，字幕点出商品。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2404)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 居家氛围感 · ambiance_mood

点香开灯换氛围，五感沉浸式的家

- 适配标签：家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以点香/开氛围灯/换床品等动作逐步把房间调成想要的氛围，画面重光影质感，商品是氛围开关。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2432)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 换季整理 · season_switch

换季收纳大工程，前后对比+好物顺手推

- 适配标签：家居日用、服饰鞋包。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；痛点：俯拍下降（overhead_top）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以换季衣柜/被褥大整理为主线，收纳前后对比，压缩袋/收纳盒等好物在流程中自然出场。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2446)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 晚间收尾流程 · evening_winddown

从卸妆到熄灯的夜routine，安静的种草

- 适配标签：美妆护肤、家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：按晚间时间线串起卸妆护肤热饮熄灯等动作，节奏放慢氛围安静，商品是夜晚仪式感的一环。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2614)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 周末重置日 · weekend_reset

大扫除+囤货+自我修复，一天理顺一周

- 适配标签：家居日用。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以周末重置日为主线：换洗打扫补货备餐一气呵成，商品在流程节点自然出场，治愈且有掌控感。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2628)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 沉浸式打包 · order_packing

接单到封箱全程收音，打包声是新的ASMR

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none","bgmDuck":false,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「第XX号订单开始打包」开场，撕胶带装盒塞填充物全程收音，商品在打包过程中自然展示，治愈解压。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2711)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 分装记账 · cash_stuffing

沉浸式把预算分进信封，解压又种草工具

- 适配标签：家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：沉浸式把预算现金/卡片分进标签信封与分装册（近距收音），过程即解压，商品（记账本/分装工具）在使用中自然种草。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2924)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 沉浸吃播 · mukbang_crunch

先听这一口脆响，吃到一半才报口味

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：近机位开吃，咀嚼脆响收音先行，吃到一半才口播口味与辣度，声音是主角；食用反应须真实不夸张表演。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2990)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 耳语种草 · whisper_sell

耳语加慢动作细节，只想告诉你一个人

- 适配标签：美妆护肤。画面形态：商品特写。脚本：场景安利。
- 运镜编排：开头钩子：缓慢推近（slow_push）；商品亮相：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：耳语音量+慢动作展示产品细节，轻声讲使用感，轻声报价收尾，营造一对一私享感；轻声但信息完整。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3004)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 田园慢作 · cottage_craft

田园劳作慢节奏，商品融进烘焙与园艺

- 适配标签：家居日用、食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：降镜聚焦（crane_down_close）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；收尾引导：升镜展开（crane_up）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：田园场景慢节奏劳作（烘焙/园艺/手作），商品自然融入劳作过程，成果特写+柔性收尾，画面美学优先促销感靠后。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3045)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 舒适拉满 · cozymaxxing

宣言开场逐层叠加，把家改成不想上班的地方

- 适配标签：家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「今晚舒适度拉满」宣言开场，逐层叠加舒适单品（灯光/毯子/香薰），窝进成果里的第一视角收尾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3059)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 冰箱造景 · fridgescaping

打开乱冰箱到分区造景，开门瞬间即卖点

- 适配标签：家居日用、食品零食。画面形态：场景演示。脚本：反转。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：俯拍下降（overhead_top）；商品亮相：拉远揭示（pull_reveal）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：打开凌乱冰箱开场，分区造景过程（收纳盒/标签/装饰）快剪，开门瞬间的成果reveal收尾，前后对比即卖点。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3073)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 晨间卸甲 · morning_shed

醒来逐层拆掉过夜装备，每拆一层种一草

- 适配标签：美妆护肤。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：醒来逐层拆掉过夜装备（发卷/眼膜/护理带），每拆一层介绍一件的作用，拆完展示状态收尾；效果表述真实不夸大。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3087)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 睡眠装备 · sleepmaxxing

把卧室武装到牙齿，睡眠装备逐件上床

- 适配标签：家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：睡眠装备逐件上床（遮光/白噪音/香薰/家纺），夜间使用实录+晨起状态收尾；只做流程与体验展示，不得宣称助眠医疗功效。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3101)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 沐浴仪式 · everything_shower

每周一次全流程沐浴，按顺序过完每件产品

- 适配标签：美妆护肤。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「今晚是全套沐浴仪式之夜」开场，按顺序走完全流程产品（磨砂/发膜/身体护理），浴后仪式感收尾，突出流程的秩序感与犒赏感。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3115)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 三餐实录 · wieiad

按时间轴记录一日三餐，食材厨具自然入镜

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：按时间轴记录一日三餐，食材/厨具/代餐在做与吃的过程中自然入镜，感受小结收尾；不做身材焦虑对比，不做营养功效宣称。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3129)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 九件穿搭 · method_333

3上衣3下装3双鞋，连续变装组合出27套

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：甩镜切换（whip_pan）；商品亮相：横移扫过（lateral_track）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：摆出3上衣3下装3双鞋开场，连续变装快剪组合出多套穿搭，单品逐个点名收尾；组合数量诚实计算。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3143)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 沉浸原声 · silent_immersive

无口播纯环境音，开盖那声啵就是钩子

- 适配标签：家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：无口播、纯环境音第一视角使用全程（开盖/倒水/切配实录音效是主角），字幕点出关键感受，结尾一句话收束；不做治愈定调，核心是过程真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3395)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 探店实测 · store_visit

人均30吃到扶墙，这家店我先替你踩了

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：第一视角（pov_walk）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：顾客视角推门进店，招牌产品沉浸实测（吃/用/试），人均价格+值不值结论收尾；探店体验真实，人均价格属实，与商家关系如实标注。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3527)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 待产包清单 · hospital_bag

孕周倒计时逐件装包，拉链一合就等发动

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：孕周倒计时钩子（37周了补齐最后一件），逐件装包每件讲一个用途，拉链合上「就等发动了」收尾；清单实用性优先。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3555)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 舔嘴回放 · lick_replay

这个舔嘴动作，值得正放倒放慢放三遍

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：饭盆落地→进食特写→舔嘴镜头正放倒放循环三遍+慢动作，空盆收尾；宠物反应真实抓拍不摆拍诱导。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3607)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 花样逗宠局 · pet_playbook

人宠连续三种玩法，人退场宠物还在自嗨

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：玩具入场宠物锁定镜头，人宠互动连续演示三种玩法，人退场后宠物自得其乐收尾；互动状态真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3620)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 毛孩拆快递 · pet_unbox

快递是它的，我只是个开门的

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：开箱。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：手持实拍感（handheld_real）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：快递进门宠物先扑上去，宠物撕箱主人只旁白，逐件试用宠物「验收」表情收尾；反应真实抓拍。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3633)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 毛孩自选购 · pet_pick

今天预算100，让它自己挑自己花

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：货架/两款对比摆开，宠物自己嗅闻选择，尊重选择当场下单开玩；选择过程真实不剪辑造假。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3646)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 挑食终审官 · picky_judge

全小区最挑的猫，今天审第14款粮

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：反转。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：挑食黑历史钩子（拒食名场面混剪），新粮换碗实测，吃/不吃当场宣判可连测三天；实测结果真实，不诱导摆拍。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3659)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 舒适燃脂角 · cozy_cardio

不去健身房，穿着浴袍边看剧边走步

- 适配标签：家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：缓慢推近（slow_push）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：反健身房宣言钩子，布置舒适角仪式感（氛围灯/热饮/浴袍），边看剧边走步+步数结算收尾；轻松基调，不做身材焦虑。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3740)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 带娃车应急舱 · mom_car_kit

带娃出门一次，后备箱改成了急救站

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：带娃出门翻车瞬间钩子（洒奶/晕车/没纸巾），后座应急舱逐件配置，实战场景验证收尾；场景真实实用。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3794)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 陪学自习室 · study_with_me

计时器开钟一起学，桌上每样都有链接

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：计时器开钟钩子，桌面文具沉浸书写（笔尖声/翻页声收音，不露脸），番茄钟结算+桌面清单收尾；陪伴感优先促销感靠后。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3820)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 手帐拼贴局 · journal_asmr

什么都不说，就撕十分钟胶带给你听

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：场景安利。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：素材摊开钩子，撕胶带/盖印章/贴贴纸的ASMR拼贴过程（纯物料声无BGM），成页翻阅+物料清单收尾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3833)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 出行装箱记 · pack_with_me

7天行程一个登机箱装完，看我怎么塞

- 适配标签：服饰鞋包、家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：机票亮出钩子（48小时后起飞），压缩袋/分装瓶/分区收纳装箱ASMR，称重合格拉杆出门收尾；收纳效果真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3887)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 洗护发日记 · wash_day

今天是洗头日，全流程七步一步不能少

- 适配标签：美妆护肤。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：手持实拍感（handheld_real）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：多日未洗素颜钩子，分步骤洗护沉浸过程（头皮磨砂/发膜/精油），吹干甩发光泽收尾；效果表述真实，不做生发防脱功效宣称。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3971)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 理线爽片 · cable_zen

桌下那团乱麻，十分钟归零

- 适配标签：数码3C、家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：微距滑移（macro_glide）；商品亮相：俯拍下降（overhead_top）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：怼脸拍一团乱麻线材的血压钩子，理线器逐段缠绕收拢的解压过程做主体，桌下空无一线成果定格+清单收尾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4137)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 神仙喝法 · drink_hack

官方喝法都是骗人的，试试这个

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「官方喝法都是骗人的」钩子，用商品做基底的隐藏配方教学（如咖啡+椰乳+海盐奶盖），成品诱人一饮+评论区交作业挂话题收尾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4165)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 三分钟硬菜 · timer_feast

计时开始，敢不敢和饭店比

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：推近定住（push_then_hold）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：手机计时器上屏+冷冻袋拆封「敢不敢和饭店比」钩子，加热出锅摆盘全程快剪计时停在2分47，与饭店同菜价格对比收尾；预制属性如实标注，不宣称现做现炒。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4193)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 手冲参数卡 · pour_over_card

四行参数，一杯不会翻车的手冲

- 适配标签：食品零食。画面形态：商品特写。脚本：场景安利。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：豆卡四行参数上屏（豆名/粉水比/水温/时间），注水绕圈的治愈俯拍+计时，风味描述三连词收尾，豆子和器具双链接；参数真实可复现。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4249)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 贴标翻书 · book_annotate

这本书，我贴了87个标签

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：场景安利。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：侧面怼拍书口密密麻麻彩色标签「这本我贴了87个标」钩子，快速翻页划线批注特写，念一句最戳的划线句+书单收尾，图书与文具索引贴双带。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4473)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 痛包展示 · itabag_show

新入的谷，今天全部上包

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：空包开场「新入的谷今天上包」钩子，吧唧排列布局流苏挂件定位的强迫症式摆放过程，成品痛包出街回头率实拍+包体谷美双链接收尾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4499)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 久坐八小时测 · sit_marathon

早九晚六不离椅，起身腰没垮

- 适配标签：家居日用、数码3C。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；展示/演示：弧形环移（arc_quarter）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：早9点坐下打卡「今天8小时不离椅」钩子，每2小时插播腰背状态报告+腰托调节演示，晚6点起身没扶腰的结论+参数收尾；时间戳连续真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4553)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 赶大集探摊 · fair_crawl

东北大集十块钱，能吃一路

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：第一视角（pov_walk）；展示/演示：手持实拍感（handheld_real）；商品亮相：微距滑移（macro_glide）；背书：跟随镜头（follow_track）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「东北大集10块钱能买啥」钩子，逐摊试吃问价和摊主唠嗑砍价的巡游纪实，市集烟火气收在「同款干货小店直发，不用赶集也能买」。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4622)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 商贸城扫货记 · mall_sweep

全世界的圣诞树，都从这里发货

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：第一视角（pov_walk）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「义乌商贸城，全世界的圣诞树都从这发货」震撼钩子，走档口问批发价对比零售差价，「我谈好了按批发价给你们开团」收尾；批发价与差价必须真实不虚构。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4677)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 年夜饭掌勺局 · nye_feast

第一次掌勺，30分钟出一桌硬菜

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：推近定住（push_then_hold）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「第一次当掌勺，30分钟出一桌硬菜」新手钩子，预制菜加热摆盘全程实拍+家人试吃验收，「年夜饭套餐提前囤除夕不慌」收尾；预制菜属性必须明示，食安与运输表述规范。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4823)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 实住一晚报告 · overnight_report

挂牌1200的房，399住了一晚

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：第一视角（pov_walk）；展示/演示：弧形环移（arc_quarter）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「挂牌1200的房团购卖399，我住了一晚」钩子，过夜全流程实测——隔音分贝、床垫软硬、遮光、早餐逐项打分，「套券随时退不过期，先囤后约」收尾；套券规则表述与商品一致。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4946)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 后厨亮灶直拍 · open_kitchen

后厨敢给你看的店，放心囤券

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：甩镜切换（whip_pan）；商品亮相：跟随镜头（follow_track）；背书：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：前厅菜品诱人特写钩子，突然切到后厨明档——现切现炒、工位卫生、食材日期标签逐一扫过，「后厨敢给你看的店，团购券放心囤」收尾；后厨画面真实实拍。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4972)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 手作故事会 · handcam_story

手上做着甲，嘴上讲着离谱故事

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：剧情故事。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：手部特写开工+「讲个客人离谱事」钩子，双轨并行——手上工序展示工具材料、嘴上讲连载故事，故事讲完成品亮相工具清单挂车；故事标注演绎，工序真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5172)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 晨跑俱乐部 · run_club

清晨六点的集合点，人越聚越多

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：升镜展开（crane_up）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：清晨集合空镜+人数逐渐聚拢的社群感钩子，跑团氛围混剪中装备特写反复出镜，「周六同一地点，装备清单在下方」社群式收尾；卖归属感不卖参数，氛围真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5185)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 从零自制宴 · scratch_glam

孩子想吃泡泡糖，我决定从零做

- 适配标签：食品零食、家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：荒诞从零命题钩子（连酱油都自己酿），精致着装+低语旁白下的从零制作过程厨具食材自然出镜，成品优雅试吃器具清单挂车；表演性精致自洽，食品制作安全规范。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5330)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。


## 促销转化

### 促销快闪 · flash_sale

七成种草三成促销，档期上新的转化收口

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：痛点种草。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：英雄仰拍（hero_rise）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：前段快节奏讲价值，结尾集中讲优惠；优惠信息必须真实，不使用虚假紧迫话术。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L472)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 比价锚点 · price_anchor

先立参照再报价，价格优势眼见为实

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；痛点：焦点转移（focus_shift）；商品亮相：俯拍下降（overhead_top）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：先给常见渠道价或同类价做参照，再展示本品价格与配置；对比信息需真实可核。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L485)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 量大管饱 · bundle_pile

俯拍堆满一桌，数量冲击就是性价比

- 适配标签：食品零食、家居日用。画面形态：商品特写。脚本：痛点种草。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：俯拍下降（overhead_top）；展示/演示：横移扫过（lateral_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：把套餐内容全部铺开逐件清点，数量与赠品眼见为实，报价干脆。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L498)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 直播切片风 · live_slice

直播间高光话术+大字贴纸，切片感自带信任

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；背书：手持实拍感（handheld_real）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"none","bgmDuck":false,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：模拟直播间讲解的高光片段，话术密集直给有现场感，承诺内容必须真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L512)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 三大理由 · three_reasons

三个理由清单体，最后一个放大招

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；商品亮相：转台展示（lazy_susan）；展示/演示：俯拍下降（overhead_top）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「三个理由」清单结构展开，逐条编号讲透，把最强卖点放在最后压轴。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L525)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 平替对比 · dupe_compare

百元平替左右手实测，按预算给答案

- 适配标签：美妆护肤。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；痛点：焦点转移（focus_shift）；展示/演示：微距滑移（macro_glide）；商品亮相：俯拍下降（overhead_top）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：左右手/半脸同涂实测对比，按预算档位给购买建议；对比客观不贬损其他品牌，不虚构测试结果。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L696)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 宿舍好物 · dorm_picks

床位书桌小空间实测，学生党价格友好

- 适配标签：数码3C、家居日用。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：第一视角（pov_walk）；展示/演示：手持实拍感（handheld_real）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「宿舍幸福感TOP榜」展开，床位书桌小场景逐个演示适配性，报价格强调学生党友好，价格真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1180)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 送礼避雷指南 · gift_guide_flip

翻车礼物图鉴开场，正确答案分预算盘点

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；痛点：焦点转移（focus_shift）；商品亮相：俯拍下降（overhead_top）；展示/演示：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：先损后教：翻车礼物打叉快闪开场，再按预算分档盘点正确答案，口吻像替你把关的闺蜜军师。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1290)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 礼物倒计时榜 · gift_countdown

TOP5倒数开箱，人设标签对号入座

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：转台展示（lazy_susan）；展示/演示：微距滑移（macro_glide）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以倒计时榜单逐个开箱种草，每件配「送给爱XX的他/她」人设标签，第一名压轴重磅揭晓。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1303)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 年货囤货节 · cny_haul

整箱开箱分堆盘点，红金年味里算划算账

- 适配标签：食品零食。画面形态：商品特写。脚本：开箱。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：俯拍下降（overhead_top）；展示/演示：横移扫过（lateral_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：快递箱堆叠开场，整箱开箱逐样过品，按待客/追剧/送人分堆，年味热闹；价格与赠品信息真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1329)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 开学季清单 · back_to_school

必买缓买别买三档，学长学姐防坑指南

- 适配标签：数码3C、家居日用。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；商品亮相：俯拍下降（overhead_top）；展示/演示：手持实拍感（handheld_real）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「新生别乱买」开场，按必买/缓买/别买三档盘点，报预算总价收尾，口吻像学长学姐防坑。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1357)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 大促扫货单 · sale_haul

促销开跑逐件快闪，每件只讲一句话

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：痛点种草。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；商品亮相：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：宣布促销开跑，3-5个单品快闪各配一句核心卖点，节奏不停顿；优惠信息必须真实有效。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1373)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 清仓直给 · clearance_sale

换季清库存直说原因，价格砍到眼见为实

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；商品亮相：俯拍下降（overhead_top）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：直说清仓原因（换季/断码/腾仓），价格对比眼见为实；清仓理由与库存信息必须真实，不制造虚假稀缺。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1386)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 预售锁单讲解 · presale_lock

定金机制一笔账讲透，提前锁住最优价

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：把预售定金膨胀/尾款机制算成一笔明白账，何时付何时发讲清楚；机制描述必须与商家页面一致。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1399)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 上新首发 · new_drop

新品首发第一波，三个新在哪讲明白

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：拉远揭示（pull_reveal）；商品亮相：环绕展示（orbit_slow）；展示/演示：微距滑移（macro_glide）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"quality":"hd","productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以首发揭幕感开场，聚焦讲清「新在哪」的两三个点，与旧款差异具体可感，首发信息真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1425)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 渠道劝告体 · advise_close

「别再去线下买了」，价差算给你看

- 适配标签：食品零食。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：焦点转移（focus_shift）；商品亮相：俯拍下降（overhead_top）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「别再去XX渠道买了」劝告开场，把渠道价差算成明白账再给购买建议；价格对比必须真实可核。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1494)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 超值堆叠体 · value_stack

买一送X层层加码，套餐内容摆满一屏

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：俯拍下降（overhead_top）；展示/演示：横移扫过（lateral_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：自问自答式开场，套餐内容层层加码逐件摆出（主品+赠品+服务），数量眼见为实；赠品信息必须真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1508)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 问价对话体 · price_qa

模拟买家问价一问一答，价格悬念到最后

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：采访。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：手持实拍感（handheld_real）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以买家问价开场做成一问一答对话，先讲价值再揭价格制造反差；报价与优惠真实，不演虚假砍价。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1521)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 前贴混剪 · front_card_mix

3秒强前贴+爆点混剪+口播压单，官方跑量结构

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：痛点种草。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：甩镜切换（whip_pan）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：前3秒用价格炸点或效果特写做强前贴，中段爆点画面混剪连切，结尾口播集中压单；促销信息必须真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1756)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 机制算账体 · deal_breakdown

满减赠品算成明白账，字卡比价眼见为实

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：把满减/赠品/券后价逐项算成一笔明白账，算账字卡同步上屏；每个数字必须真实可核，不虚构原价。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1769)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 直播预告蹲点 · live_teaser

剧透直播专属福利，提醒蹲点不见不散

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：预告直播时间与直播间专属福利，剧透一两个爆品但留悬念，引导预约蹲点；福利信息必须真实兑现。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2763)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 同价对打 · us_vs_them

同样的价格逐项打勾对比，差异一目了然

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：甩镜切换（whip_pan）；商品亮相：横移扫过（lateral_track）；展示/演示：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「一般产品vs我们家」逐项打勾对比表，放大差异项后促单；对比不点名真实竞品，对比项须客观可验证。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2964)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 三秒试穿 · try_on_rush

前3秒商品必现真人上身，全程不提价格

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：横移扫过（lateral_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：前3秒真人上身动态展示商品（巨量跑量素材公式），多角度试穿+文字贴卖点，全程不提价格，结尾引导进店；上身效果真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3210)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 塑品深讲 · sculpt_pitch

先别问价，材质工艺逐层塑造再揭价格

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：缓慢推近（slow_push）；痛点：微距滑移（macro_glide）；商品亮相：转台展示（lazy_susan）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"quality":"hd","productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：直播塑品话术转短视频：先让观众别问价，材质/工艺/细节逐层塑造+场景想象，最后价格揭晓形成反差促单；价格对比真实不虚构原价。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3264)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 砍价小剧场 · price_war_skit

主播报价厂家急眼，一场砍价大战看到底价

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：情景短剧。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：甩镜切换（whip_pan）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：主播报低价、「厂家」急喊不能再让的砍价冲突剧；须显著标注剧情演绎，最终成交价必须真实可履约，不虚构原价不伪造让利。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3290)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 接龙开团 · group_buy_chain

咱们群今天团这个，已拼87单差13单成团

- 适配标签：食品零食。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：拉远揭示（pull_reveal）；展示/演示：微距滑移（macro_glide）；背书：缓慢推近（slow_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：团长口吻开场「咱们群今天团这个」，团购价与截团时间，接龙氛围感收尾；拼单数据与截团时间须真实，不伪造成团进度。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3381)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 宠粉回馈日 · fan_day

关注三年的老粉，今天只宠你们

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；背书：手持实拍感（handheld_real）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"bold","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「关注我三年的老铁进来」点名钩子，晒进货凭证证明福利款让利+只给粉丝限量N单，点关注亮灯牌才有资格拍的门槛收尾；让利表述可举证，限时限量话术遵守价格法。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4609)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 临期捡漏局 · expiry_hunt

原价59的进口零食，9块9拿下

- 适配标签：食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；商品亮相：俯拍下降（overhead_top）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「原价59我9块9拿下」价差钩子，生产日期与剩余保质期特写+「临期≠过期」科普+折扣算账三段，「手慢无这批只有200单」收尾；临期属性与剩余期限必须真实标注，原价表述遵守价格法。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4650)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 九块九挑战 · budget_haul

100块买10件，哪件真香哪件快跑

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：开箱。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「我花100块买了10件9块9的东西」预算命题钩子，逐件开箱按真香/能用/快跑分级排雷，只挂通过测试的两三件「这几个真能闭眼冲」收尾；分级结论真实不恰饭注水。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4664)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 礼盒大赏横评 · giftbox_review

拆了12家礼盒，按送礼对象分档

- 适配标签：食品零食。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「今年中秋礼盒卷疯了，我拆了12家」钩子，连续开盒评包装内容物单价，按送领导/送客户/送爸妈/送闺蜜分档给结论，「收藏这份清单照抄」收尾；涉酒水礼盒遵守酒类广告规范不诱导饮酒。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4770)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 返场捡漏播报 · encore_sale

以为大促结束了？返场价更狠

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「以为618结束了？返场价比大促还狠」钩子，播报式盘点破价回归的漏网好价，「返场只有N天错过等半年」收尾；价格真实性高危红线——「比大促更低」必须可举证，严禁先涨后降。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4784)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 周周会员日 · member_day

每周三，这家店等于半价

- 适配标签：食品零食。画面形态：场景演示。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「每周三，这家店等于半价」固定周期锚点钩子，演示会员价与非会员价对比下单流程，「入会免费，下周三见」习惯养成收尾；会员价与门店价差必须真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4918)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 套餐值不值 · deal_audit

99的双人餐，按菜单价算了一遍

- 适配标签：食品零食。画面形态：场景演示。脚本：对比测评。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：俯拍下降（overhead_top）；商品亮相：微距滑移（macro_glide）；背书：手持实拍感（handheld_real）；收尾引导：缓慢推近（slow_push）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「99的双人餐我按菜单价算了下」钩子，逐项核对菜单原价实拍分量、揪出隐藏消费（茶位费/限时段），「值就冲，坑我帮你踩了」收尾；菜单原价对比真实拍摄留证。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4932)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 日历房捡漏 · calendar_room

同一间房，选对日期差400块

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；商品亮相：缓慢推近（slow_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：「同一间房，选对日期差400块」钩子，屏录翻日历找低价日期+同房型比价实操教学，「这几天是价格洼地直接订」收尾；比价截图真实同时段可复核。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4959)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。


## 创意视觉

### 巨物奇观 · giant_product

商品放大成城市巨物，一眼停手指的奇观开场

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：升镜展开（crane_up）；商品亮相：拉远揭示（pull_reveal）；展示/演示：弧形环移（arc_quarter）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：把商品呈现为矗立在城市或自然场景中的巨物，画面越壮观越好，卖点简短有力。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L540)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 飞溅定格 · splash_freeze

高速摄影感飞溅瞬间，饮品美妆的氛围大片

- 适配标签：食品零食、美妆护肤。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：环绕展示（orbit_slow）；展示/演示：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"energetic","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以液体飞溅、粉末扬起等高速摄影感瞬间为视觉主线，动感与质感并重。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L553)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 街头海报 · street_poster

商品上墙变涂鸦与巨幅广告牌，潮流品牌感

- 适配标签：服饰鞋包、数码3C。画面形态：图文混剪。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；商品亮相：升镜展开（crane_up）；展示/演示：横移扫过（lateral_track）；收尾引导：拉远揭示（pull_reveal）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：商品以街头涂鸦、巨幅广告牌等城市视觉形式出现，整体潮流艺术感。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L567)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 萌宠助阵 · pet_cameo

毛孩子出镜带货，可爱即流量

- 适配标签：家居日用、食品零食。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：降镜聚焦（crane_down_close）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：宠物与商品同框互动作为记忆点，画面温馨有趣，宠物反应自然不摆拍。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L581)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 一键变装 · magic_transform

甩镜瞬间变装换景，反差感抓住前三秒

- 适配标签：服饰鞋包、美妆护肤。画面形态：场景演示。脚本：反转。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；商品亮相：希区柯克变焦（dolly_zoom）；展示/演示：横移扫过（lateral_track）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以瞬间变装或场景切换制造前后反差，切换点干脆利落卡在节拍上。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L595)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 评论爆梗 · comment_bubble

漂浮评论气泡+回复体，像爆款帖不像广告

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：采访。
- 运镜编排：开头钩子：急速推近（crash_push）；背书：焦点转移（focus_shift）；商品亮相：推近定住（push_then_hold）；展示/演示：俯拍下降（overhead_top）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「回复网友评论」的口吻展开，把常见疑问当话题逐条回应，社交感强。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L609)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 猎奇揭秘 · curio_wonder

罕见用法/原理慢放揭秘，看懂就想要

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；商品亮相：拉远揭示（pull_reveal）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以罕见事物或反常用法开场抓好奇心，特写慢放揭示原理，原理讲清后商品自然承接；原理描述准确。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1576)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 图文卡片轮播 · slide_deck

知识卡片翻页式过点，无需出镜也能带货

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：痛点种草。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：焦点转移（focus_shift）；商品亮相：推近定住（push_then_hold）；展示/演示：俯拍下降（overhead_top）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"chill","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以图文卡片翻页节奏组织信息，每卡一个知识点或卖点，大字标题+短说明，信息密度高但每卡一句话说清。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1701)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 复古怀旧风 · retro_nostalgia

胶片滤镜+老物件记忆，情怀唤回购买欲

- 适配标签：食品零食、服饰鞋包。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：缓慢推近（slow_push）；痛点：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以老物件或童年记忆开场铺怀旧情绪，复古胶片质感画面，商品作为「记忆里的味道/样子」唤起共鸣。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1727)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 万物膨胀 · inflate_pop

商品充气膨胀飘起来，反差萌一眼记住

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：英雄仰拍（hero_rise）；展示/演示：环绕展示（orbit_slow）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：商品像充气一样膨胀变圆飘起的特效画面做记忆点，反差萌调性；特效属创意表现，不得暗示真实尺寸或功效。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1784)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 捏捏乐解压 · squish_asmr

软胶质感反复捏压回弹，解压向种草

- 适配标签：家居日用。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；商品亮相：降镜聚焦（crane_down_close）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none","bgmDuck":false,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以捏压回弹的软质感画面为主线，动作缓慢重复有解压感，保留捏压原声；材质表现不夸大实际手感。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1797)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 万物毛绒化 · plush_world

场景一键变毛绒质感，治愈系奇观开场

- 适配标签：家居日用。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：拉远揭示（pull_reveal）；商品亮相：环绕展示（orbit_slow）；展示/演示：微距滑移（macro_glide）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：把商品或场景呈现为毛绒玩偶质感的奇观画面，治愈可爱调性；特效属创意表现，不代表实物材质。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1811)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 3D手办化 · figurine_3d

商品变桌面手办微缩景，潮玩感展示

- 适配标签：数码3C。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：降镜聚焦（crane_down_close）；商品亮相：转台展示（lazy_susan）；展示/演示：微距滑移（macro_glide）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"upbeat","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：把商品呈现为桌面微缩手办场景，微距景深营造潮玩摄影感，趣味展示商品造型细节。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1825)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 悬浮展示 · levitate_float

商品零重力悬浮旋转，配件环绕成阵

- 适配标签：数码3C、美妆护肤。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：英雄仰拍（hero_rise）；商品亮相：环绕展示（orbit_slow）；展示/演示：弧形环移（arc_quarter）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"energetic","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：商品零重力悬浮缓慢旋转，配件或成分元素环绕成阵，科技感构图干净，卖点字幕逐个点出。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1839)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 定格动画 · stop_motion

逐帧跳动的手作定格感，商品自己动起来

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；商品亮相：转台展示（lazy_susan）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以定格动画的逐帧跳动感呈现，商品与道具像自己走位排队，手作温度与童趣感，节奏轻快。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1853)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 无限穿越镜 · infinite_zoom

一镜到底连续穿越场景，商品是每层主角

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：拉远揭示（pull_reveal）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"energetic","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以连续推进穿越多个场景的一镜到底感串场，每穿越一层展示一个使用场景，商品始终是画面锚点。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1866)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 分身矩阵 · clone_crowd

一人分饰多角同框争论，自己说服自己

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：情景短剧。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；痛点：焦点转移（focus_shift）；展示/演示：横移扫过（lateral_track）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：一人分饰多角同框对话（质疑者/种草者/理性派），几个「自己」互相说服，观点交锋替观众问完所有顾虑。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1879)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 时光倒流 · time_rewind

倒放魔法逆转过程，坏状态倒回好状态

- 适配标签：家居日用。画面形态：场景演示。脚本：反转。
- 运镜编排：开头钩子：希区柯克变焦（dolly_zoom）；展示/演示：焦点转移（focus_shift）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以倒放画面做视觉魔法（洒落的倒回杯中/皱的变平整），倒流感突出商品让状态复原的能力，趣味不误导。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1892)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 爆炸分解图 · exploded_view

部件悬空拆解成阵再合体，工业美学讲结构

- 适配标签：数码3C。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：拉远揭示（pull_reveal）；商品亮相：环绕展示（orbit_slow）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"energetic","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：商品部件悬空拆解成爆炸图逐层展示，再利落合体，每层配一句结构/用料卖点；结构信息与实物一致。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1906)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 商品变形术 · product_morph

旧物流畅变形成新品，换代升级一镜说清

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：希区柯克变焦（dolly_zoom）；商品亮相：环绕展示（orbit_slow）；展示/演示：微距滑移（macro_glide）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"energetic","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以旧方案流畅变形为新品的特效转场做主线，变形前后各讲一句核心差异；特效是表现手法，差异描述真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1920)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 萌宠开口说 · pet_talker

拟人萌宠对口型讲产品，广告感瞬间消解

- 适配标签：家居日用、食品零食。画面形态：场景演示。脚本：情景短剧。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以拟人化萌宠视角开口讲产品（配音对口型），吐槽主人带出使用场景，可爱消解广告感；AI拟人内容需带标识。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1933)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 照片动起来 · photo_dance

静态商品图一键起舞卡点，最低成本的动感

- 适配标签：服饰鞋包。画面形态：图文混剪。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；商品亮相：急速推近（crash_push）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以静态商品图/模特图做卡点律动的动画感，图片切换跟音乐节拍，快闪字卡逐图点卖点。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1947)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 热音卡点 · beat_sync

画面动作全卡在节拍上，音乐带着手指停

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；商品亮相：急速推近（crash_push）；展示/演示：横移扫过（lateral_track）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":false,"productCard":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：整片节奏严格跟随音乐节拍，每个切换点卡在鼓点上，动作与转场为节拍服务，文案短促跟拍。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1963)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 玩梗体 · meme_format

热梗模板填进商品，笑点落在卖点上

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：人物讲解。脚本：情景短剧。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：手持实拍感（handheld_real）；商品亮相：推近定住（push_then_hold）；收尾引导：甩镜切换（whip_pan）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：借用当下流行梗的节奏结构，把商品填进梗的笑点位置，玩梗自然不硬蹭，笑点落在卖点上。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L1976)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 视觉打断 · pattern_break

反常画面打断刷屏惯性，违和感换三秒注意力

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：反转。
- 运镜编排：开头钩子：希区柯克变焦（dolly_zoom）；商品亮相：拉远揭示（pull_reveal）；展示/演示：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开场用一个反常规画面（怪角度/违和道具/突兀动作）打断刷屏惯性，随后解释反常并引入商品。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2110)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 等着看 · wait_for_it

承诺一个爽点吊住手指，兑现瞬间给足回报

- 适配标签：家居日用。画面形态：场景演示。脚本：反转。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：焦点转移（focus_shift）；商品亮相：急速推近（crash_push）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：开场承诺一个具体爽点（「看它一口气吸完」），中段有意铺垫拖延，结尾完整兑现承诺的瞬间；爽点必须真实兑现。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2123)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 预告片腔 · tv_teaser

美剧预告片式剪辑上新，悬念感拉满档次

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：情景短剧。
- 运镜编排：开头钩子：希区柯克变焦（dolly_zoom）；商品亮相：拉远揭示（pull_reveal）；展示/演示：弧形环移（arc_quarter）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"bold","bgm":"emotional","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以影视预告片的剪辑语法上新：碎片画面+悬念台词+定档字卡，氛围拉满，结尾揭晓商品与上市信息。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2205)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 日系广告腔 · japan_ad

清新留白+物哀节奏，日杂质感的商品诗

- 适配标签：美妆护肤、家居日用。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：缓慢推近（slow_push）；商品亮相：焦点转移（focus_shift）；展示/演示：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：日系广告调性：画面留白构图克制，节奏安静，文案短句诗化，商品像杂志内页一样被安静呈现。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2218)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 运动快切 · sport_cut

高频快切+动感机位，肾上腺素式展示

- 适配标签：服饰鞋包、数码3C。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；展示/演示：跟随镜头（follow_track）；商品亮相：急速推近（crash_push）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":false,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：高频快切的运动感剪辑，跟拍冲刺跳跃等大动作，商品在运动状态中展示性能，节奏不留喘息。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2232)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 食材爆散 · ingredient_burst

商品居中原料四散定格，一眼看清配方

- 适配标签：食品零食。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；商品亮相：环绕展示（orbit_slow）；展示/演示：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"energetic","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：商品居中、原料向四周爆散悬停的高速摄影感画面，逐样点出真实原料；呈现的成分必须与配料表一致。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2304)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 粒子显形 · particle_reveal

香雾粒子旋聚成瓶，高端线的氛围魔法

- 适配标签：美妆护肤。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：缓慢推近（slow_push）；商品亮相：拉远揭示（pull_reveal）；展示/演示：环绕展示（orbit_slow）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以体积光中香雾/粒子旋转汇聚显形出商品的画面为主线，氛围神秘高级，文案只留一句核心。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2318)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 延时生长 · timelapse_grow

发芽到绽放的时间压缩，成长隐喻讲功效

- 适配标签：美妆护肤、食品零食。画面形态：商品特写。脚本：剧情故事。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：焦点转移（focus_shift）；商品亮相：英雄仰拍（hero_rise）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以植物发芽到绽放的延时画面做成长隐喻，串联原料的自然来源；隐喻仅作氛围表达，不暗示未经证实的功效。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2346)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 液体环抱 · liquid_rise

罐体从液流中升起，原料悬浮的饮品大片

- 适配标签：食品零食。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：英雄仰拍（hero_rise）；商品亮相：环绕展示（orbit_slow）；展示/演示：微距滑移（macro_glide）；收尾引导：推近定住（push_then_hold）。
- 画面Look：食欲暖光（food_appetizing）；生图指令：暖色食欲光（约3500K），食物色泽饱满诱人，f/2.8 浅景深背景虚化，细节油亮；视频光线锚点：全程保持暖色食欲光与饱满色泽。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"energetic","bgmDuck":true,"quality":"hd"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：商品从奶油/液流环抱中缓缓升起，原料在周围悬浮的慢动作大片感，食欲光效；呈现原料与配方一致。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2655)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 盲盒开箱 · mystery_unbox

拆之前不知道是啥，悬念开箱的心跳感

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：开箱。
- 运镜编排：开头钩子：希区柯克变焦（dolly_zoom）；商品亮相：拉远揭示（pull_reveal）；展示/演示：微距滑移（macro_glide）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以「拆之前我也不知道是啥」的悬念开箱，拆盒过程放大心跳感，揭晓反应真实；盲盒机制与概率信息须合规真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2857)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 无声测评 · silent_review

全程零台词，手势表情加字幕完成测评

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：对比测评。
- 运镜编排：开头钩子：希区柯克变焦（dolly_zoom）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"none"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：全程零台词，靠手势、表情和字幕完成测评，保留环境音/使用音，打分手势收尾；字幕承担全部信息量，评价须真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L2977)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 聊天剧场 · text_story

聊天气泡逐条弹出造剧情，对话里带出商品

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：情景短剧。
- 运镜编排：开头钩子：急速推近（crash_push）；痛点：缓慢推近（slow_push）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：以聊天气泡逐条弹出的形式造剧情钩（姐妹半夜求链接式），对话中自然带出商品，结局+转化收尾；须标注虚构演绎，不得伪造成真实用户聊天证据。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3157)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 双屏分心 · sludge_split

上屏讲产品下屏放解压，注意力全程在线

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：人设口播。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：上半屏产品口播讲解、下半屏解压/过程画面拉住注意力的双线结构，关键卖点大字幕同步，完播后转化；两屏内容都须与商品相关不误导。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3170)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 二选一连击 · this_or_that

连续抛出AB二选，观众心里跟着选到最后

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：对比测评。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；展示/演示：横移扫过（lateral_track）；商品亮相：焦点转移（focus_shift）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：连续抛出AB二选（两件商品/两种用法/两种风格），节奏快让观众心里跟选，亮出胜者或「小孩子才做选择」收尾。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3183)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 一镜到底 · one_take

不剪辑，一条镜头看完它值不值

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：第一视角（pov_walk）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：单镜头连贯：开场即见商品，跟随镜头完整走完使用/穿搭流程，镜头定格+行动指令收尾；脚本按连续动线写，不设跳切。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3224)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 整活验证 · stunt_test

荒诞挑战开场，挑战过程就是性能验证

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：反转。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；背书：缓慢推近（slow_push）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：荒诞挑战宣言开场（用这口锅接住三楼扔下的西瓜），挑战过程即极限性能验证，结论收尾；挑战结果真实不摆拍造假，危险动作加「请勿模仿」提示。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3461)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### AI解压奇观 · ai_asmr

刀切慕斯的沙沙声循环，商品是被解压的主角

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：场景安利。
- 运镜编排：开头钩子：微距滑移（macro_glide）；展示/演示：降镜聚焦（crane_down_close）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"none"}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：高质感解压特写开场（切/挤/捏的生成式画面），ASMR音效沉浸循环，商品作为被「解压」的主角留记忆点；AI内容需带标识，特效属创意表现不得伪造实际质地与功效。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3488)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 神曲循环 · jingle_loop

魔性副歌起手，产品画面严格卡节奏洗脑

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：场景安利。
- 运镜编排：开头钩子：甩镜切换（whip_pan）；展示/演示：横移扫过（lateral_track）；商品亮相：焦点转移（focus_shift）；收尾引导：英雄仰拍（hero_rise）。
- 画面Look：暖调生活感（warm_life）；生图指令：温暖的午后阳光色调（约3000K暖光），橙黄暖光洒落，居家生活氛围，柔和阴影，浅景深 f/2.0；视频光线锚点：全程保持温暖的橙黄午后光调。
- 原始合成配置：`{"captionPreset":"karaoke","bgm":"energetic","bgmDuck":false}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：魔性副歌直接起手（0.5秒内起），产品画面严格卡节奏反复出现，歌词即卖点循环洗脑收尾；音乐须有使用授权。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L3514)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 通感闻香 · scent_translate

前调是下过雨的松林，尾调是旧图书馆

- 适配标签：家居日用、美妆护肤。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：推近定住（push_then_hold）；展示/演示：拉远揭示（pull_reveal）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：凑近深吸一口的表情特写钩子，用画面翻译气味——前调切下过雨的松林空镜、尾调切旧图书馆场景，香型人格测试式选香收尾；通感联想不虚构香料成分。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4263)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 古画复刻 · ancient_recreate

一千年前的穿搭，今天复原给你看

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：焦点转移（focus_shift）；商品亮相：拉远揭示（pull_reveal）；收尾引导：缓慢推近（slow_push）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：名画局部推镜「一千年前的穿搭」钩子，上妆着衣梳发的复原过程快剪，定格成画中同款构图原画与真人分屏对比+形制清单收尾；形制考据表述严谨。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4389)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 供应链微纪录 · micro_doc

一杯好奶，要过几道关

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：剧情故事。
- 运镜编排：开头钩子：升镜展开（crane_up）；展示/演示：横移扫过（lateral_track）；商品亮相：微距滑移（macro_glide）；背书：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：高级灰调（premium_gray）；生图指令：低饱和高级灰色调（约4500K柔光），柔和漫射光，极简构图，f/5.6 稳定景深，高端克制的质感；视频光线锚点：全程保持低饱和灰调与柔和漫射光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"emotional","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：电影感航拍+旁白抛行业问题「一杯好奶要过几道关」钩子，关键工序特写+一线员工人物访谈，片尾品牌标版轻CTA「看完再决定买不买」；工序与人物真实，纪录片质感克制不煽情。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L4905)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 气场养成剪 · aura_farm

慢动作出场，+999 气场分

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：缓慢推近（slow_push）；展示/演示：跟随镜头（follow_track）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：慢动作+重低音配乐的「毫不费力的酷」出场钩子，商品作为加分道具融入连续摆拍动作，字幕打「+999 aura」式计分收尾引导下单；装酷叙事自洽不尬演。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5027)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 伪装文青梗 · performative_kit

装文艺要装全套，一件都不能少

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：推近定住（push_then_hold）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：森系自然（forest_soft）；生图指令：自然绿植环境，清晨柔光带薄雾感（约5000K），f/2.8 浅景深，清新治愈的色调；视频光线锚点：全程保持清晨柔光与清新绿调。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：摆拍「表演型文艺人设」装备逐件上身钩子，自嘲式旁白拆解每件单品为何加分（帆布包/胶片机/有线耳机），「装也要装全套」合集收尾；自嘲玩梗不嘲讽真实人群。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5093)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 变速卡点剪 · velocity_edit

慢动作蓄力，急加速甩到商品脸上

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：甩镜切换（whip_pan）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：慢动作蓄力→急加速甩到商品特写的速度曲线钩子，随音乐反复慢-快-慢斜坡每次减速停在一个卖点，最后一次减速停在价格卡收尾；快闪画面注意光敏提示。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5198)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 连环匹配剪 · match_cut

同构图连切八次，怎么接得这么顺

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：推近定住（push_then_hold）；展示/演示：焦点转移（focus_shift）；商品亮相：微距滑移（macro_glide）；收尾引导：缓慢推近（slow_push）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：手持圆形物→匹配切到同构图商品细节的智性钩子，连续五到八个同形状/同动作跨场景匹配剪讲一条使用链路，最后一个匹配落到价格收尾；构图同构要真对齐。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5211)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 遮挡换景术 · object_wipe

手扫过镜头的瞬间，全场调包

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：甩镜切换（whip_pan）；商品亮相：焦点转移（focus_shift）；收尾引导：推近定住（push_then_hold）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"bold","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：手/包裹/门框扫过镜头瞬间商品或场景被调包的魔术钩子，连续几次遮挡-调包展示色号型号前后效果，最后一次遮挡揭价格牌收尾；换款展示真实不偷换规格。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5224)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 无缝循环片 · perfect_loop

看了三遍才发现，它根本没有结尾

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：商品特写。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：推近定住（push_then_hold）；展示/演示：微距滑移（macro_glide）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：首尾帧严格咬合的动作循环钩子（倒饮料→杯空→倒饮料），循环本身即演示，字幕层轮换卖点评论区问「看了几遍」收尾；专吃完播率，首尾衔接必须真无缝。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5237)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 鱼眼怼镜风 · fisheye_look

畸变大特写，自带街头味

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：场景安利。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：弧形环移（arc_quarter）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：模特手抓向镜头的鱼眼畸变大特写钩子，畸变构图下走位展示服饰轮廓与细节，怼镜定格+价格贴纸收尾；畸变是风格不遮商品关键细节。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5250)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 移轴小人国 · tilt_shift_mini

整个工厂，拍成了玩具模型

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：俯拍下降（overhead_top）；展示/演示：横移扫过（lateral_track）；商品亮相：焦点转移（focus_shift）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：门店/工厂/市集被拍成玩具模型般小人国的移轴钩子，上帝视角讲生产陈列流程，镜头落回正常视角的商品特写挂车收尾；空间型叙事，场景真实。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5264)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### FPV穿梭一镜 · fpv_flythrough

从门头钻进去，一镜穿完全场

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：跟随镜头（follow_track）；商品亮相：甩镜切换（whip_pan）；收尾引导：升镜展开（crane_up）。
- 画面Look：科技冷调（tech_cool）；生图指令：冷色调科技感光效（约7000K冷调），蓝紫色轮廓光，深色简洁背景，f/5.6 稳定景深，未来感；视频光线锚点：全程保持冷调科技光效。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：穿越机从门头钻入的失重感钩子，一镜穿梭货架/后厨/产线掠过处即卖点，冲出窗口拉高俯瞰收品牌标；高速连续位移+窄缝穿越的一镜语言，实拍需场地许可与飞行安全。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5277)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 虚拟试衣间 · ai_tryon

一张商品图，全身材试穿轮播

- 适配标签：服饰鞋包。画面形态：场景演示。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：推近定住（push_then_hold）；展示/演示：横移扫过（lateral_track）；商品亮相：弧形环移（arc_quarter）；收尾引导：缓慢推近（slow_push）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"standard","bgm":"upbeat","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：平铺商品图「活过来」被数字人穿上的钩子，同一件衣在多身材多场景数字人身上快速轮换，「真人实拍见评论区」双保险收尾；AI生成内容必须打标识，不虚构上身效果误导版型面料。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5357)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### AI房改预览 · ai_room_preview

发来户型照，AI先给你三种改法

- 适配标签：家居日用。画面形态：图文混剪。脚本：场景安利。
- 运镜编排：开头钩子：推近定住（push_then_hold）；展示/演示：焦点转移（focus_shift）；商品亮相：弧形环移（arc_quarter）；收尾引导：缓慢推近（slow_push）。
- 画面Look：清透日光（daylight_clean）；生图指令：明亮自然的窗边日光（约5600K日光白平衡），空气感清透，浅色干净背景，f/4 适中景深；视频光线锚点：全程保持明亮清透的自然日光。
- 原始合成配置：`{"captionPreset":"standard","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：观众投稿的真实房间照钩子，AI生成放入本店家具后的三种风格预览连切，「评论区发户型帮你改」互动收尾；AI标识必打，效果图与实物差异需声明防虚假宣传。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5384)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 脑腐吉祥物 · brainrot_mascot

荒诞AI角色自报家门，洗脑到下单

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：情景短剧。
- 运镜编排：开头钩子：急速推近（crash_push）；展示/演示：甩镜切换（whip_pan）；商品亮相：推近定住（push_then_hold）；收尾引导：缓慢推近（slow_push）。
- 画面Look：夜景氛围（night_neon）；生图指令：夜晚城市霓虹氛围（约3200K暖光与霓虹冷光混合），冷暖光对比，大光圈 f/1.8 浅景深光斑背景，情绪感强；视频光线锚点：全程保持夜景霓虹光斑氛围。
- 原始合成配置：`{"captionPreset":"bold","bgm":"energetic","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：荒诞AI缝合角色（商品拟人怪物）自报家门钩子，无厘头顺口溜式角色曲介绍卖点，角色口号洗脑重复收尾；AI标识必打，角色必须原创严禁缝合他人IP。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5398)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

### 白底生景术 · scene_grow

一张白底图，场景自己长出来

- 适配标签：未限定类目（不代表所有商品已验证）。画面形态：图文混剪。脚本：原脚本语义为物品拟人，须做适配。
- 运镜编排：开头钩子：推近定住（push_then_hold）；展示/演示：拉远揭示（pull_reveal）；商品亮相：弧形环移（arc_quarter）；收尾引导：缓慢推近（slow_push）。
- 画面Look：影棚质感（studio_product）；生图指令：专业影棚布光（约5000K主光），主体轮廓光清晰，深色渐变背景，f/8 全清晰景深，商品质感锐利高级；视频光线锚点：全程保持影棚级布光与深色背景。
- 原始合成配置：`{"captionPreset":"minimal","bgm":"chill","bgmDuck":true}`；未指定字段依原应用设置，云端需另行冻结默认值。
- 创意要求：一张白底商品图孤立悬浮的钩子，场景从商品四周生长出来（厨房/露营地/梳妆台连换三场），定格最贴用户的场景挂车收尾；AI标识必打，生成场景不得虚构使用效果（如伪造防水实拍）。
- [固定提交源码](https://github.com/copypasteltd/one-tap-ads/blob/1aab133dd75f4db57c3f62e6da2fdd121c5d509b/src/lib/ad-templates.ts#L5411)。没有发现与该ID逐一对应的成片证明，不将配置条目当作已验证案例。

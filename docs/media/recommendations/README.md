# 商品推荐与自由选型 · 实际页面回放 / Product recommendations

录制实际共享小程序识别页、方案详情与社区目录，非设计拼图。商品档案、推荐列表与开放状态均为合成数据；详情页故意模拟规格已撤下，以核验推荐后仍会重新检查。

| 编号 | 文件 | 用途 / Purpose |
| --- | --- | --- |
| 01 | [推荐页](01-product-recommendations.png) | 理由、来源、作者与适配规格 / Reasons and matching variants |
| 02 | [详情复核](02-exact-version-recheck.png) | 精确版本/规格保留，撤下后不可制作 / Preserve versions and recheck availability |
| 03 | [空列表引导](03-empty-recommendations.png) | 浏览方案与重新拍照 / Browse or recapture |
| 04 | [WebM](walkthrough.webm) | 原始浏览器录制 / Original browser recording |
| 05 | [MP4](walkthrough.mp4) | 可播放演示 / Playable walkthrough |
| 06 | [GIF](walkthrough.gif) | README 预览 / README preview |

五项浏览器检查及文件 SHA-256 见 [capture-manifest.json](capture-manifest.json)，实现与限制见 [需求实现](../../实施/商品档案推荐与可用方案选择-v1.0.md) 和 [准确证据](../../verification/recommendations-source.json)。浏览器上下文、标签页及本次预览服务已关闭。不是双小程序真机或真实模型/支付通过证据。

重新录制前构建页面，并将 `PLAYWRIGHT_BROWSERS_PATH` 指向项目内 `runtime/playwright-browsers`（现有 FFmpeg 缓存），然后运行 `scripts/record-recommendations.ts`；本地 Node、临时目录和缓存按启动指南设置。严禁 Docker/WSL；录制器在成功和失败路径都关闭自己创建的浏览器与服务。

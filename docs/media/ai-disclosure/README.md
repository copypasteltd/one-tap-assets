# 可见AI标识示例 / Visible AI disclosure fixture

2026-10-29排版更新后已实际重新运行脚本：PNG同时展示长文案完整换行与末字“甲”，避开标题/AI标识/页脚；清单绑定新排版源码和实际媒体SHA。15秒视频/取帧/GIF仍使用相同自绘静帧输入，实际复录字节可保持相同；这不等于生成式广告质量验收。The latest actual recapture includes a complete multiline suffix in the image. Static-video inputs remain the same, so re-execution may yield identical video/frame/GIF bytes; it does not certify real generation quality.

本目录只展示平台实际绘制的标识与全帧像素检查。商品是项目自绘SVG，视频是原生FFmpeg静帧演示；没有客户照片、真人、语音、付费模型或生成式广告质量证明，也不是小程序宿主截图。

Self-drawn SVG product and native static video demonstrate baked disclosure pixels. No customer data, real generation, speech, host certification or commercial admission is implied.

![实际PNG中的固定标识](image.png)

![15秒视频的实际GIF导出](preview.gif)

[15秒 / 450帧 MP4](video.mp4) · [帧索引225（从0计）实际取帧](frame.png) · [来源及SHA](capture-manifest.json) · [完整实现说明](../../实施/AI可见标识与逐帧文件验收-v1.0.md)

标识写入文件，保存到相册后仍存在；GIF缩小为预览，实际核验使用原1080p视频全部450帧。图片直接比较实际RGBA字节（含不透明Alpha），视频比较固定字形灰度区域。此检查不替代真实内容质量、宿主声明、法律规则或全产品验收。

复录在本项目根目录执行 `.\scripts\run.ps1 docs:disclosure`。脚本只使用项目配置、Sharp和FFmpeg，结束后删除私有临时目录，不连接数据库，不启动浏览器或虚拟化环境。可选`.env.local`只用于读取本机工具路径，不输出或提交真实配置。脚本更新本目录四份可复录示例及清单；固定C设计、既有浏览器录制和声音内核媒体保持不变。

The mark is part of the actual saved pixels, including opaque alpha for PNG. Verification uses the original 1080p video and all 450 frames; the smaller GIF is a preview. Reproduce from the repository root with `.\scripts\run.ps1 docs:disclosure`, using project configuration, Sharp and FFmpeg. The script needs no database connection and removes its temporary directory. Optional local environment values supply native tool paths without being printed or published. It opens no browser, invokes no external model and updates only these four reproducible fixtures/manifest while preserving frozen C, browser and audio-kernel media.

# 页面与录制 / Screens and recording

[中文README](../../README.md) · [English README](../../README.en.md)

这些素材来自实际运行的`src/preview`：React DOM适配双小程序共享页面，本地合成Transport提供业务状态。截图不是设计稿重绘，也不是宿主真机证据。商品插画为本项目自绘，视频商品演示由该插画经原生FFmpeg生成；识别结果、订单、日期和交付状态都是夹具，未调用付费模型或支付。

The media records the running browser adapter for shared mini-program screens with synthetic local transport. These are actual page captures, not repainted mockups or native-device evidence. The original product illustration and its FFmpeg motion clip are fixtures; recognition, orders, dates and delivery state are synthetic. No paid model or payment is invoked.


最新相册保存 / Latest album saving: [操作与来源](../media/album-save/README.md)

![分类保存与原进度 / Selective album saving and original progress](../media/album-save/walkthrough.gif)

[MP4](../media/album-save/walkthrough.mp4) · [WebM](../media/album-save/walkthrough.webm) · [截图及摘要 / Screens and hashes](../media/album-save/capture-manifest.json)。实际共享页面录制，合成相册回调与清单；没有写入真实手机相册。Actual UI recording with synthetic callbacks and no native device writes.

最新订单操作 / Latest order actions: [操作与来源](../media/order-actions/README.md)

![原订单取消与退款 / Original-order cancellation and refund](../media/order-actions/walkthrough.gif)

[MP4](../media/order-actions/walkthrough.mp4) · [WebM](../media/order-actions/walkthrough.webm) · [截图及摘要 / Screens and hashes](../media/order-actions/capture-manifest.json)。实际共享页面录制，合成订单/金额/退款状态；不代表实际支付或退款到账。Actual UI recording with synthetic states; no live transaction or native-device claim.

最新草稿恢复 / Latest draft recovery: [操作与来源](../media/draft-resume/README.md)

![草稿恢复与原规格 / Server draft recovery and original specification](../media/draft-resume/walkthrough.gif)

[MP4](../media/draft-resume/walkthrough.mp4) · [WebM](../media/draft-resume/walkthrough.webm) · [截图及摘要 / Screens and hashes](../media/draft-resume/capture-manifest.json)。实际共享页面录制，合成数据，官方方案仍禁售。Actual UI recording with synthetic metadata; no real recognition, payment or native-device claim.

最新拍照交互 / Latest capture flow: [逐张拍照说明](../media/photo-capture/README.md)

![逐张拍照、重拍与补图 / Sequential capture, retake and album additions](../media/photo-capture/walkthrough.gif)

[MP4](../media/photo-capture/walkthrough.mp4) · [WebM](../media/photo-capture/walkthrough.webm) · [实际截图与来源](../media/photo-capture/capture-manifest.json)。实际共享页面录制，使用自绘合成商品，非宿主真机或真实识别/付款证明。Actual shared-page recording with synthetic photos; native-device and live-service acceptance remain separate.

![四页总览 / Four-screen overview](../media/overview.png)

![操作GIF / Interaction GIF](../media/walkthrough.gif)

| 编号 / No. | 页面 / Screen | 原图 / Capture |
| --- | --- | --- |
| 01 | 拍照制作 / Home | [PNG](../media/screenshots/01-home.png) |
| 02 | 照片选择 / Photos | [PNG](../media/screenshots/02-photos.png) |
| 03 | 自动商品档案 / Product analysis | [PNG](../media/screenshots/03-analysis.png) |
| 04 | 方案社区10套 / Preset community | [PNG](../media/screenshots/04-community.png) |
| 05 | 方案细节与禁售状态 / Preset and admission | [PNG](../media/screenshots/05-preset.png) |
| 06 | 素材清单确认 / Pack confirmation | [PNG](../media/screenshots/06-checklist.png) |
| 07 | 制作阶段回放 / Production state replay | [PNG](../media/screenshots/07-order.png) |
| 08 | 整包领取 / Asset collection | [PNG](../media/screenshots/08-pack.png) |
| 09 | 我的素材 / Library | [PNG](../media/screenshots/09-library.png) |
| 10 | 作者入口 / Creator entry | [PNG](../media/screenshots/10-creator.png) |

完整录屏：[H.264 MP4](../media/walkthrough.mp4)、[原始WebM](../media/walkthrough.webm)。本次MP4约14.56秒，430×932；GIF为调色板优化的动画。逐文件字节数/SHA、ffprobe结果、浏览器关闭标记、异常/外部请求记录见[清单](../media/capture-manifest.json)。

The MP4 is approximately 14.56 seconds at 430×932. The GIF is an actual palette-optimized animation derived from the recording. The manifest records byte sizes/hashes, ffprobe data, closed-browser status, page errors and external requests.

## 复录 / Recapture

需先按[中文](QUICKSTART.md)/[English](QUICKSTART.en.md)指南安装依赖。录制额外需要本机Microsoft Edge、原生FFmpeg/ffprobe，路径从`.env.local`的`FFMPEG_PATH`/`FFPROBE_PATH`读取或使用PATH；配置内容不会输出。Playwright录制组件安装在项目内：

Additional requirements are local Microsoft Edge and native FFmpeg/ffprobe, configured through the ignored environment file or PATH. The script does not print that configuration. Install project-local recording support:

```powershell
.\scripts\run.ps1 exec playwright install ffmpeg
```

终端A / Terminal A：

```powershell
.\scripts\run.ps1 dev:preview
```

终端B / Terminal B：

```powershell
.\scripts\run.ps1 docs:media
# test:ui runs the same assertions/capture script.
```

脚本真实点击入口、选择3张照片、检查10套方案和各阶段/领取页，截图10页；后续状态通过明确的场景选择器切换，不假装在14秒内调用模型完成付款制作。每次运行重绘自有示例图、生成演示短片、录制WebM、转MP4/GIF、生成总览和清单；`finally`关闭浏览器/上下文，异常或外部请求使任务失败。运行完成后还应在A按`Ctrl+C`停止预览服务。

The script clicks real UI controls, selects three photos, asserts ten presets and checks stage/collection pages. A labeled scene selector changes later fixture states; the recording does not pretend to purchase and generate a pack in fourteen seconds. It rebuilds original demo images/video, records WebM, transcodes MP4/GIF, writes screenshots/overview/hashes and closes the browser in `finally`. Errors/external requests fail the run. Stop terminal A afterward.

## 更新约定 / Update policy

UI变化同步更新相关截图、完整录屏/GIF和清单；README、CHANGELOG与状态指南同步说明。不要用客户照片、账号、付款信息或个人浏览器登录态录制公共演示。C设计原稿和归档保持不变；本目录为可更新的实际实现截图。

Recapture affected screens and the walkthrough/manifest when UI behavior changes, and update both READMEs and the changelog. Public captures use no customer photos, account/payment details or personal browser profiles. The frozen C artwork/archive is unchanged; this media directory documents the evolving implementation.

## 原生音频内核媒体 / Native audio kernel media

[四种字幕视频、取帧和GIF](../media/native-audio/README.md)使用另一套明确标注的正弦音/人工时间码夹具，展示实际后期处理，不是页面录屏、中文识别或讲解订单。复录命令为`.\scripts\run.ps1 docs:audio`，使用独立原生测试库，不打开浏览器、不访问外部模型。源音轨/编码后波形、字幕时点、许可压低和来源SHA见独立清单。

[Four caption videos, extracted frames and GIF](../media/native-audio/README.md) demonstrate native post-processing using synthetic tones and manual timestamps. They are not UI recordings, Chinese ASR or presenter orders. Run `.\scripts\run.ps1 docs:audio` to reproduce with an isolated native test schema and no browser or external model. Its separate manifest binds actual media and processing evidence.

## 文件内AI标识 / Disclosure baked into files

最新排版专项实际重录本节4份文件与清单，PNG显示完整长文案后缀，来源还绑定固定字体测宽模块。静帧视频输入未变，实际复录可得到同SHA的视频/取帧/GIF；原浏览器/声音示例没有重录。The latest disclosure recapture shows complete multiline text in PNG; unchanged static-video inputs can reproduce identical media bytes. Browser/audio captures retain their original provenance.

另有[4份实际PNG/MP4/取帧/GIF](../media/ai-disclosure/README.md)，来源为项目自绘SVG和原生静帧视频，完整15秒/450帧经过实际标识区域检查。它不是浏览器截图或模型生成广告质量证明。复录使用`docs:disclosure`，不启动浏览器；原10页截图、录屏、原音频示例及C原件保留。Four additional self-drawn/native pixel fixtures demonstrate baked disclosure, separately from the unchanged ten-screen browser recording and original synthetic audio.

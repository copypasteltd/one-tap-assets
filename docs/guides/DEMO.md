# 页面与录制 / Screens and recording

2026-10-31快速功能收口：Plus原片视频选段、裁切、定时字幕、原声保留/静音、独立手机授权与确认付款、新MP4/真实首帧封面/文案交付已接通。有声选段封存完整原选段与成片WAV，通过原声技术比对、独立听音及事实/风格双复核；手填字幕不冒充ASR。有声视频的免费受限售后仅修改文案并保留原音视频。4项原生关键链路检查、4项真实浏览器流程及类型/server/Plus/支付宝/抖音构建通过，未执行全面测试。543源码、38迁移、106业务/38管理接口、316schema/82实体；新增10份截图/MP4/WebM/GIF，原180媒体及方案C保持。原生数据库/HTTPS/MCP/FFmpeg实际运行，账户、付款、模型/听音判定及隔离身份为合成；真实服务和销售默认关闭。双端真机、真实服务/隔离准入、云端部署、多轨与视频批量/自动转写/复杂作者工具、长期身份绑定及58项完整验收仍待。

[视频剪辑需求、协议与配置](../实施/Plus原片视频剪辑与定时字幕-v1.0.md) · [截图与录屏](../media/plus-video/README.md) · [准确证据](../verification/plus-video-source.json) · [编号完成与待办](STATUS.md)。下文保留此前方案和历史验证来源；当前新增范围以上述视频剪辑说明及本轮证据为准。

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

# 验证与发布证据 / Verification and publication evidence

2026-10-29转写源码：**50单元 / 301原生集成**通过，32个集成文件，原始集成报告跨度约700.63秒。源码/测试/配置摘要312份，运行契约42份，资源4份。本轮转写源码先执行全新完整原生集成；构建超时后按全部源码/契约/资源未变的受限重试保留本轮原始通过报告，其余五项重新执行，未沿用上一轮284项。

This transcription source first executes the complete native integration suite freshly. After a build timeout, an explicit same-source/contracts/resources retry retains this original passing report and repeats the other five checks; the previous round's 284 cases are not reused. The manifest records 50 unit and 301 native integration cases and 312 source/test/config hashes. Mode: `MINI_BUILD_RETRY_WITH_RETAINED_NATIVE_INTEGRATION`.

| 编号 / No. | 检查 / Check | 结果 / Result | 可审查依据 / Evidence |
| --- | --- | --- | --- |
| 01 | 类型、单元、完整原生集成、服务端和双小程序 / Types, tests and builds | PASS | [实现清单](../../assets/implementation/current.json)，六项命令/原始日志和报告SHA |
| 02 | ASR / Transcription | 17项专项PASS | 原生PG/FFmpeg/AAC/PCM/私有文件；合成识别/用量/网络，不是实测供应商 |
| 03 | 文档/契约 / Documentation/contracts | PASS | [契约摘要](contracts.json)，不等于产品验收 |
| 04 | 页面媒体 / UI media | 20个文件保留原SHA | 10截图、概览、录屏、GIF及静态说明等，[原始清单](../media/capture-manifest.json) |
| 05 | 声音媒体 / Audio media | 12个文件保留原SHA | 四MP4/PNG、源MP4/合成WAV/概览/GIF，32帧GIF，[来源](../media/native-audio/capture-manifest.json) |
| 06 | 设计/暂存/发布 / Design and staged publication | 单独核验 | [发布摘要](publication.json) / [暂存审计](repository-audit.json) |

主证据为[实现索引](../../assets/implementation/current.json)，包括原始命令日志/测试JSON的SHA；原始文件位于忽略的`runtime/test-results/`。新转写源码必须全新跑集成，不能使用此前声音内核284项报告代替。类型/编译、合成供应商与真实服务准入分别记录，完整产品与生产准入仍为false。

The original logs/reports stay in ignored runtime storage with their hashes referenced publicly. Native database/media execution is distinct from synthetic external responses and real-service admission. The new ASR gateway does not register an audible order tool or remove sales guards.

本轮没有修改前端或录制脚本，沿用已核验的Vite回放构建、10页断言和相同媒体SHA；没有打开浏览器。页面录像不是支付宝/抖音真机或Plus，声音录像仍为合成提示音/人工时间码，不改标为ASR样片。C基线25份和冻结归档保持原字节。发布另核对全部文档本地链接、媒体/源码摘要、Git暂存字节、忽略项及有限凭证模式，不能替代真实物理隐私或完整密钥审计。

The unchanged UI retains its prior verified replay capture. No browser was opened in this round. Media provenance does not change when the ASR source is added. Publication checks inspect local links, registered media/source hashes, staged bytes, ignore rules and limited credential patterns.

## 历史验证来源 / Historical provenance

此前声音内核轮执行284项全量集成，首次支付宝构建启动180秒超时，再按全部源码未变的显式受限重试保留该轮原始报告；并非本轮新ASR源码的验证替代。`--retry-mini-builds`只允许受限构建/核验器变化，拒绝应用/测试变动，核对源路径/摘要、契约/资源与原始报告/日志；默认六项全新执行。

参考整片未核验购买的[先红后绿摘要](../../assets/implementation/regressions/reference-video-gate.json)保留旧网关基线提交、旧源码SHA和原始失败/通过报告摘要；原报告保留本地。声音内核轮完整284项包含15项声音专项；此前无声整包/身份/MCP轮为269项。这些是历史记录，当前全量见上方。The red/green record preserves the old gateway baseline and report digests, while the full integration run verifies the current source. The previous publication round established the 720-second full-suite ceiling after an observed 480-second timeout; individual assertions and per-test limits remain unchanged.

文档契约核验使用`verify:docs`，发布前另核对C基线、归档和Git暂存字节与工作区证据一致。需要重现时按[快速启动](../guides/QUICKSTART.en.md)准备原生环境，再运行README中的命令。Reproduce through the native setup guide; contract/document checks are distinct from application acceptance.

上一轮生成式无声专项新增7项整包/故障/恢复用例；社区SAMPLE仍完整执行13项。首次全量回归定位并修正了共享合成驱动对订单/独立样例输入形式的兼容问题，失败日志保留本地。实测269项串行原生集成接近12分钟，当前整套命令上限900秒，单例断言/时限和业务费用/截止约束不变。Seven new silent generated-pack cases and all thirteen SAMPLE cases execute in the full suite. An initial fixture-input compatibility failure was preserved and corrected before a full rerun. The measured native suite approached twelve minutes; its command-level ceiling is now 900 seconds, with individual assertions/timeouts and business limits unchanged.

上一轮上一轮最终构建修复仅改动`mini-config.cjs`的压缩执行方式和核验器；支付宝CSS并行worker的180秒超时留存本地，改同进程压缩后完成。实现索引的`verification_mode`/`retained_integration`明确记录原269项完整集成、源摘要和日志/报告SHA；最终类型/50单元/服务端/双端构建重新执行。重试命令只允许这两个构建文件变化，核对全部源码路径/摘要与契约/资源，拒绝业务变化、缺失/改变的原日志/完整报告或运行中源码变化；新增业务文件的拒绝用例已实际执行。默认命令仍全量执行，不自动复用。

The previous round's build-only retry records the complete 269-case native run and its original digests explicitly. Only `scripts/mini-config.cjs` and the verifier may change; all application/test paths and hashes, contracts/resources and original passing reports/logs are checked. Type/unit/server/mini builds execute again. A real added-source rejection probe passed. Missing/changed evidence or application changes reject reuse; the default command remains a fresh full run. This build configuration executes the same CSS minification in-process after a worker-mode timeout; it does not disable compression or change product UI.

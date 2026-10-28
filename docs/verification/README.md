# 公开验证说明 / Public verification

2026-10-29声音源码先执行全新完整验证，31个文件284项原生集成全部通过，676.27秒，其中15项为新声音/字幕/配乐专项。首次支付宝构建启动180秒超时，失败日志保留本地；随后在全部源码/测试/契约/资源完全不变的条件下执行受限构建重试，留用本轮原始284项报告，类型/单元/服务端/双端构建重新执行。当前模式和摘要以[实现索引](../../assets/implementation/current.json)为准；未沿用上一轮269项。[独立音频媒体清单](../media/native-audio/capture-manifest.json)记录12个实际文件、四种字幕、32帧GIF及显式合成音/人工时间码；发布脚本逐项核对媒体字节和相关源码摘要。真实语音识别/听音及有声订单仍未验证。

The audio source executes a fresh complete native run: 284 cases across 31 files pass in 676.27 seconds, including fifteen audio fixtures. An initial Alipay build-startup command times out at 180 seconds. An explicit build retry checks identical source/test/contracts/resources and retains this original 284-case report; type/unit/server/both mini builds repeat. It does not reuse the previous round's 269 cases. A separate twelve-file/four-style/32-frame media record supplements the unchanged browser replay. These synthetic-tone/manual-timecode results do not certify real speech, ASR, listening review or audio orders. The historical build retry below retains its original provenance.

当前源码检查完成于2026-10-29。机器可读主证据为[assets/implementation/current.json](../../assets/implementation/current.json)，包含六项命令状态、50单元/284集成计数、307个源码/测试/配置文件摘要及独立契约/资源摘要。原始日志和测试JSON保存在忽略的`runtime/test-results/`，主证据保留其SHA引用，不会将本地环境、数据库或凭证上传。

The implementation manifest records the six executed commands, 50 unit and 284 integration cases, 307 source/test/config file hashes, and independent contract/resource hashes. Original local reports/logs are excluded from Git; their digests remain referenced. This public repository does not contain local credentials or runtime databases.

| 检查 / Check | 结果 / Result | 可审查依据 / Evidence |
| --- | --- | --- |
| 类型、单元、原生集成、服务端、双小程序 / Types, tests and builds | PASS；50/284 | [实现清单 / Manifest](../../assets/implementation/current.json) |
| Vite回放 / Preview build | PASS | `build:preview`，输出到忽略的`runtime/build/preview/` / Native Vite output |
| 页面捕获 / UI capture | PASS；10页、约14.56秒 / 10 screens, about 14.56s | [逐文件SHA和ffprobe / Capture manifest](../media/capture-manifest.json) |
| 文档与发布 / Docs and publication | 以生成摘要为准 / See generated result | [publication.json](publication.json) |
| 文档/契约结构 / Document and contract structure | PASS | [独立检查报告 / Contract report](contracts.json) |
| 发布文件与留存 / Publication files and preservation | PASS | [仓库链接/暂存字节复核 / Repository audit](repository-audit.json) |
| 设计C / C design | 保留25基线文件与归档 / Preserved | [原基线 / Baseline](../../assets/design/柚子创作社/v1.0/baseline-manifest.json) |

`verify:publication`核验双语入口的本地链接、媒体实际字节/SHA、动画GIF、10张截图尺寸、浏览器关闭/无异常/无外部请求、源码/契约/资源快照、Git候选大小/隐私路径/有限凭证模式和忽略规则。凭证扫描只覆盖明确模式，不宣称穷尽所有secret格式；还须审查暂存内容。它不证明模型质量、真机支付、物理隐私或生产准入。

Publication verification checks local documentation links, actual media bytes/hashes, animated GIF, screenshot sizes, capture cleanup/errors/network, current source snapshots, Git candidate paths/sizes, limited secret patterns and ignore rules. It is not exhaustive secret discovery or production certification; review staged files as well.

参考整片未核验购买的[先红后绿摘要](../../assets/implementation/regressions/reference-video-gate.json)保留旧网关基线提交、旧源码SHA和原始失败/通过报告摘要；原报告保留本地。当前全量284项还包含15项声音内核专项；上一轮无声整包/身份/MCP已完成269项。The red/green record preserves the old gateway baseline and report digests, while the full integration run verifies the current source. The previous publication round established the 720-second full-suite ceiling after an observed 480-second timeout; individual assertions and per-test limits remain unchanged.

文档契约核验使用`verify:docs`，发布前另核对C基线、归档和Git暂存字节与工作区证据一致。需要重现时按[快速启动](../guides/QUICKSTART.en.md)准备原生环境，再运行README中的命令。Reproduce through the native setup guide; contract/document checks are distinct from application acceptance.

上一轮生成式无声专项新增7项整包/故障/恢复用例；社区SAMPLE仍完整执行13项。首次全量回归定位并修正了共享合成驱动对订单/独立样例输入形式的兼容问题，失败日志保留本地。实测269项串行原生集成接近12分钟，当前整套命令上限900秒，单例断言/时限和业务费用/截止约束不变。Seven new silent generated-pack cases and all thirteen SAMPLE cases execute in the full suite. An initial fixture-input compatibility failure was preserved and corrected before a full rerun. The measured native suite approached twelve minutes; its command-level ceiling is now 900 seconds, with individual assertions/timeouts and business limits unchanged.

上一轮上一轮最终构建修复仅改动`mini-config.cjs`的压缩执行方式和核验器；支付宝CSS并行worker的180秒超时留存本地，改同进程压缩后完成。实现索引的`verification_mode`/`retained_integration`明确记录原269项完整集成、源摘要和日志/报告SHA；最终类型/50单元/服务端/双端构建重新执行。重试命令只允许这两个构建文件变化，核对全部源码路径/摘要与契约/资源，拒绝业务变化、缺失/改变的原日志/完整报告或运行中源码变化；新增业务文件的拒绝用例已实际执行。默认命令仍全量执行，不自动复用。

The previous round's build-only retry records the complete 269-case native run and its original digests explicitly. Only `scripts/mini-config.cjs` and the verifier may change; all application/test paths and hashes, contracts/resources and original passing reports/logs are checked. Type/unit/server/mini builds execute again. A real added-source rejection probe passed. Missing/changed evidence or application changes reject reuse; the default command remains a fresh full run. This build configuration executes the same CSS minification in-process after a worker-mode timeout; it does not disable compression or change product UI.

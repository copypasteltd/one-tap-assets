# 公开验证说明 / Public verification

当前源码检查完成于2026-10-28。机器可读主证据为[assets/implementation/current.json](../../assets/implementation/current.json)，包含六项命令状态、50单元/269集成计数、301个源码/测试/配置文件摘要及独立契约/资源摘要。原始日志和测试JSON保存在忽略的`runtime/test-results/`，主证据保留其SHA引用，不会将本地环境、数据库或凭证上传。

The implementation manifest records the six executed commands, 50 unit and 269 integration cases, 301 source/test/config file hashes, and independent contract/resource hashes. Original local reports/logs are excluded from Git; their digests remain referenced. This public repository does not contain local credentials or runtime databases.

| 检查 / Check | 结果 / Result | 可审查依据 / Evidence |
| --- | --- | --- |
| 类型、单元、原生集成、服务端、双小程序 / Types, tests and builds | PASS；50/269 | [实现清单 / Manifest](../../assets/implementation/current.json) |
| Vite回放 / Preview build | PASS | `build:preview`，输出到忽略的`runtime/build/preview/` / Native Vite output |
| 页面捕获 / UI capture | PASS；10页、约14.56秒 / 10 screens, about 14.56s | [逐文件SHA和ffprobe / Capture manifest](../media/capture-manifest.json) |
| 文档与发布 / Docs and publication | 以生成摘要为准 / See generated result | [publication.json](publication.json) |
| 文档/契约结构 / Document and contract structure | PASS | [独立检查报告 / Contract report](contracts.json) |
| 发布文件与留存 / Publication files and preservation | PASS | [仓库链接/暂存字节复核 / Repository audit](repository-audit.json) |
| 设计C / C design | 保留25基线文件与归档 / Preserved | [原基线 / Baseline](../../assets/design/柚子创作社/v1.0/baseline-manifest.json) |

`verify:publication`核验双语入口的本地链接、媒体实际字节/SHA、动画GIF、10张截图尺寸、浏览器关闭/无异常/无外部请求、源码/契约/资源快照、Git候选大小/隐私路径/有限凭证模式和忽略规则。凭证扫描只覆盖明确模式，不宣称穷尽所有secret格式；还须审查暂存内容。它不证明模型质量、真机支付、物理隐私或生产准入。

Publication verification checks local documentation links, actual media bytes/hashes, animated GIF, screenshot sizes, capture cleanup/errors/network, current source snapshots, Git candidate paths/sizes, limited secret patterns and ignore rules. It is not exhaustive secret discovery or production certification; review staged files as well.

参考整片未核验购买的[先红后绿摘要](../../assets/implementation/regressions/reference-video-gate.json)保留旧网关基线提交、旧源码SHA和原始失败/通过报告摘要；原报告保留本地。当前两条无声整包、身份核心和MCP专项均纳入完整269项集成。The red/green record preserves the old gateway baseline and report digests, while the full integration run verifies the current source. The previous publication round established the 720-second full-suite ceiling after an observed 480-second timeout; individual assertions and per-test limits remain unchanged.

文档契约核验使用`verify:docs`，发布前另核对C基线、归档和Git暂存字节与工作区证据一致。需要重现时按[快速启动](../guides/QUICKSTART.en.md)准备原生环境，再运行README中的命令。Reproduce through the native setup guide; contract/document checks are distinct from application acceptance.

当前生成式无声专项另有7项整包/故障/恢复用例；社区SAMPLE仍完整执行13项。首次全量回归定位并修正了共享合成驱动对订单/独立样例输入形式的兼容问题，失败日志保留本地。实测269项串行原生集成接近12分钟，当前整套命令上限900秒，单例断言/时限和业务费用/截止约束不变。Seven new silent generated-pack cases and all thirteen SAMPLE cases execute in the full suite. An initial fixture-input compatibility failure was preserved and corrected before a full rerun. The measured native suite approached twelve minutes; its command-level ceiling is now 900 seconds, with individual assertions/timeouts and business limits unchanged.

最终构建修复仅改动`mini-config.cjs`的压缩执行方式和核验器；支付宝CSS并行worker的180秒超时留存本地，改同进程压缩后完成。实现索引的`verification_mode`/`retained_integration`明确记录原269项完整集成、源摘要和日志/报告SHA；最终类型/50单元/服务端/双端构建重新执行。重试命令只允许这两个构建文件变化，核对全部源码路径/摘要与契约/资源，拒绝业务变化、缺失/改变的原日志/完整报告或运行中源码变化；新增业务文件的拒绝用例已实际执行。默认命令仍全量执行，不自动复用。

The final build-only retry records the complete 269-case native run and its original digests explicitly. Only `scripts/mini-config.cjs` and the verifier may change; all application/test paths and hashes, contracts/resources and original passing reports/logs are checked. Type/unit/server/mini builds execute again. A real added-source rejection probe passed. Missing/changed evidence or application changes reject reuse; the default command remains a fresh full run. This build configuration executes the same CSS minification in-process after a worker-mode timeout; it does not disable compression or change product UI.

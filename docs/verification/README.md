# 公开验证说明 / Public verification

当前源码检查完成于2026-10-28。机器可读主证据为[assets/implementation/current.json](../../assets/implementation/current.json)，包含六项命令状态、50单元/262集成计数、295个源码/测试/配置文件摘要及独立契约/资源摘要。原始日志和测试JSON保存在忽略的`runtime/test-results/`，主证据保留其SHA引用，不会将本地环境、数据库或凭证上传。

The implementation manifest records the six executed commands, 50 unit and 262 integration cases, 295 source/test/config file hashes, and independent contract/resource hashes. Original local reports/logs are excluded from Git; their digests remain referenced. This public repository does not contain local credentials or runtime databases.

| 检查 / Check | 结果 / Result | 可审查依据 / Evidence |
| --- | --- | --- |
| 类型、单元、原生集成、服务端、双小程序 / Types, tests and builds | PASS；50/262 | [实现清单 / Manifest](../../assets/implementation/current.json) |
| Vite回放 / Preview build | PASS | `build:preview`，输出到忽略的`runtime/build/preview/` / Native Vite output |
| 页面捕获 / UI capture | PASS；10页、约14.56秒 / 10 screens, about 14.56s | [逐文件SHA和ffprobe / Capture manifest](../media/capture-manifest.json) |
| 文档与发布 / Docs and publication | 以生成摘要为准 / See generated result | [publication.json](publication.json) |
| 文档/契约结构 / Document and contract structure | PASS | [独立检查报告 / Contract report](contracts.json) |
| 发布文件与留存 / Publication files and preservation | PASS | [仓库链接/暂存字节复核 / Repository audit](repository-audit.json) |
| 设计C / C design | 保留25基线文件与归档 / Preserved | [原基线 / Baseline](../../assets/design/柚子创作社/v1.0/baseline-manifest.json) |

`verify:publication`核验双语入口的本地链接、媒体实际字节/SHA、动画GIF、10张截图尺寸、浏览器关闭/无异常/无外部请求、源码/契约/资源快照、Git候选大小/隐私路径/有限凭证模式和忽略规则。凭证扫描只覆盖明确模式，不宣称穷尽所有secret格式；还须审查暂存内容。它不证明模型质量、真机支付、物理隐私或生产准入。

Publication verification checks local documentation links, actual media bytes/hashes, animated GIF, screenshot sizes, capture cleanup/errors/network, current source snapshots, Git candidate paths/sizes, limited secret patterns and ignore rules. It is not exhaustive secret discovery or production certification; review staged files as well.

参考整片未核验购买的[先红后绿摘要](../../assets/implementation/regressions/reference-video-gate.json)保留旧网关基线提交、旧源码SHA和原始失败/通过报告摘要；原报告保留本地。当前两条路线、身份核心和MCP专项均纳入完整262项集成。The red/green record preserves the old gateway baseline and report digests, while the full integration run verifies the current source. The first complete run hit the former 480-second suite deadline; the successful rerun used a 720-second suite ceiling with all per-test assertions and timeouts unchanged.

文档契约核验使用`verify:docs`，发布前另核对C基线、归档和Git暂存字节与工作区证据一致。需要重现时按[快速启动](../guides/QUICKSTART.en.md)准备原生环境，再运行README中的命令。Reproduce through the native setup guide; contract/document checks are distinct from application acceptance.

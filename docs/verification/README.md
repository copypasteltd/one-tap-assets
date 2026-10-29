# 验证与发布证据 / Verification and publication evidence

2026-10-29最终声音双复核与事务交付源码：**65单元 / 347原生集成**通过，34个集成文件，完整原生报告跨度约1745.02秒。源码/测试/配置334份、运行契约42份、资源4份。本轮源码全新执行六项检查：类型、65项单元、347项完整原生集成、服务端及支付宝/抖音构建全部通过。完整运行前后的334份源码/测试/配置、42份运行契约和4份资源摘要一致，没有保留旧原生报告。听音正向语义为刻意构造的控制响应，不代表真实中文听感、计费或商业准入。

This source snapshot freshly passes all six checks: types, 65 unit tests, 347 complete native integration tests, server and both mini builds. All 334 source/test/config, 42 runtime-contract and four resource hashes match the complete run; no old integration report is retained. Positive listening semantics are deliberately fabricated controls, not real Chinese hearing, billing or commercial admission. Mode: `FRESH_FULL`. Actual native PostgreSQL/FFmpeg/media and HTTPS/stdio/MCP execute locally. Model observations, authorizations, usage, payments and isolation responses remain synthetic.

| 编号 / No. | 检查 / Check | 结果 / Result | 证明范围 / Scope |
| --- | --- | --- | --- |
| 01 | 类型/单元/完整原生集成/服务端/双小程序 | 六项全新 PASS | [实现索引](../../assets/implementation/current.json)，不是生产准入 |
| 02 | 最终声音复核/交付 | 新增5项原生控制回归 PASS | 两路线交付/下载、原角色接管、原回执篡改/费用未决、永久撤权、缺角色/工具听音输入 |
| 03 | 听音/制作/POST/文件QC | 全部23项订单专项 PASS | 原18项加5项最终链路；完整双声道/全画面/原ASR、字幕帧、混音/原响应和费用 |
| 04 | 协议及声音基础 | 7听音单元、4封存单元、23/17/15原生 PASS | 中文语音 PASS 格式、声音合同/ASR/独立内核；真实听感和账单未验 |
| 05 | 文档与契约 | 4649项 PASS | [报告摘要](contracts.json)，不代替功能运行 |
| 06 | 浏览器页面媒体 | 20文件原SHA | 10截图、概览、WebM/MP4/GIF和说明，[来源](../media/capture-manifest.json) |
| 07 | 声音媒体 | 12文件原SHA | 四样式MP4/PNG、合成WAV/概览/GIF，[来源](../media/native-audio/capture-manifest.json) |
| 08 | 发布与暂存 | 独立核验 | [发布摘要](publication.json)、[暂存审计](repository-audit.json) |

正向用例刻意构造中文/语义 PASS 响应，音频实际仍为合成提示音，只验证同源证据、原计费和事务授权控制，不证明模型听对。原提示音负向用例继续返回 INSUFFICIENT。生产没有人工写入 PASS 的公开接口。缓存不能精确分摊则保持 UNKNOWN；不按免费、不替换购买。公开声音报价/订单继续 NATIVE_AUDIO_NOT_ADMITTED，全部禁售。

Positive control fixtures deliberately fabricate Chinese semantic PASS over actual synthetic tones. They do not certify Chinese audio, recognition, listening, true usage, rights or production isolation. Negative tone cases remain insufficient. Private final-review/report/publication integration is separate from public commercial admission.

本轮初次探索因测试重复创建同阶段被唯一约束拒绝；第二次因试图恢复已永久撤销许可被数据库拒绝。修正后定向5项通过/18项跳过。首次完整运行在4项通过后遇到测试把提交包入心跳导致的时序误判；新增用例改为真实 Worker 的先停续租再提交边界，保持45秒原租约/代次/超时/断言。撤权定向回归1项通过/22项跳过。上述运行均不计完整验收，失败原日志与原334文件摘要保留；仅订单测试改变，没有应用源码变化。最后全新执行347项完整原生回归和其余五项；[运行前334文件摘要](audio-review-native-source.json)与最终实现索引一致，源码/运行契约/资源无变化。[私有日志来源摘要](audio-review-attempts.json)只发布SHA和范围，不发布原日志、凭证、数据库或测试媒体。

历史听音基础342项与CSS构建受限重试见[原来源](listening-attempts.json)及[原源码清单](listening-native-source.json)，本轮未复用该报告。完整原生命令仍上限3600秒，单元360秒/单例30秒；既有原生120/180/240秒不变，新增含两个最终角色和实际发布的完整场景300秒；hook60秒/RPC30秒/类型与服务端180秒/小程序600秒保持约束。压缩仍用已安装CSSO，保留压缩与规则顺序。

本轮没有浏览器/UI操作；原截图/录屏/GIF、声音媒体及C设计25文件/归档原字节保留。真实中文/口型/模型/账单缓存/商业授权、多人/完整输入容量、Codex受限运行/清理、支付与OSS、四组真机、完整社区/售后、全变体基准及Plus仍待验。58需求/52P0、三路线、10风格/14变体保留；完整产品/生产/云端为false。

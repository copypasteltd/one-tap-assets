# 文档目录 / Documentation index

当前文字制作约束：[完整展示文字与购买前排版校验](实施/完整展示文字与购买前排版校验-v1.0.md)。实际字形测宽/完整换行、intent断言、购买前预检和原版本恢复门禁已有源码；完整自动修复仍待实现。Latest: lossless measured layout and pre-purchase text gates, distinct from incomplete automatic repair.

最新文件制作约束：[AI可见标识与逐帧验收](实施/AI可见标识与逐帧文件验收-v1.0.md)，[实际标识媒体](media/ai-disclosure/README.md)。官方multi解释为连续多镜；完整功能与生产仍在实施中。

最新实现：[原生声音最终双复核与事务交付](实施/原生声音最终双复核与事务交付-v1.0.md)。内部两路线原听音、双角色/推理/工具/报告同源绑定与有声事务交付已连接；正向语义为合成控制响应，真实服务/商业/真机未准入，全部禁售。Latest: private final audio review and publication integration, not real-listening or production certification. 早期组件状态按此及最新实现索引理解。

[中文入口](../README.md) · [English entry](../README.en.md)

当前需求v3.1、开发契约v1.1、C设计v1.0。应用整体IN_PROGRESS，源码与演示的范围由当前实现索引决定。Current requirements are v3.1, engineering contracts v1.1 and frozen design C v1.0. The complete product remains in progress.

| 阅读目的 / Purpose | 入口 / Entry |
| --- | --- |
| 本地运行 / Run locally | [中文快速启动](guides/QUICKSTART.md) · [English quick start](guides/QUICKSTART.en.md) |
| 技术结构、恢复与费用 / Architecture, recovery and costs | [双语架构指南 / Bilingual architecture](guides/ARCHITECTURE.md) |
| 页面、录屏、GIF与复录 / Screens, recording and recapture | [演示与媒体 / Demo and media](guides/DEMO.md) |
| 故障恢复、原任务与修复边界 / Original-task recovery and repair boundaries | [双语恢复指南 / Recovery guide](guides/RECOVERY.md) |
| 后续更新、媒体和Git同步 / Ongoing documentation, media and Git synchronization | [双语发布指南 / Publishing guide](guides/PUBLISHING.md) |
| 完成范围与下一步 / Status and next work | [当前状态 / Status](guides/STATUS.md) · [公开核验 / Public verification](verification/publication.json) |
| 需求与流程 / Requirements and journeys | [PRD](01-产品需求PRD.md) · [功能/流程](02-功能需求与用户流程.md) · [架构数据/API](03-架构数据与接口.md) |
| 交易与验收 / Transactions and acceptance | [计费交易](04-计费交易与运营.md) · [测试计划](05-验收测试与实施计划.md) |
| 设计基线 / Frozen design | [C定型文档](设计/定型/C-柚子创作社-v1.0/README.md) · [追踪矩阵](设计/需求追踪矩阵-v3.1.md) |
| 开发规范 / Engineering specifications | [开发00–18](开发/README.md) · [CONTRIBUTING](../CONTRIBUTING.md) · [SECURITY](../SECURITY.md) |
| 实际源码状态 / Implemented source | [源码进度](实施/源码实现进度-v3.1.md) · [技术骨架](实施/当前开发方案与技术骨架-v3.1.md) · [实现索引](../assets/implementation/current.json) |
| 有声流程 / Native audio pipeline | [冻结合同/原费用](实施/原生声音合同与原订单费用-v1.0.md) · [持久ASR](实施/异步音频转写与原任务回执-v1.0.md) · [制作/POST](实施/原生有声订单制作与后期接入-v1.0.md) · [文件QC/封存](实施/原生声音文件验收与审查封存-v1.0.md) · [原听音协议](实施/独立听音协议与原订单回执-v1.0.md) · [最终双复核/交付](实施/原生声音最终双复核与事务交付-v1.0.md) |
| 最近专项 / Recent implementation | [原生声音/字幕/配乐内核](实施/原生音轨字幕与配乐后期内核-v1.0.md) · [音频实验媒体](media/native-audio/README.md) · [生成调用/转存](实施/生成服务持久调用与媒体转存-v1.0.md) · [参考帧身份核验](实施/参考帧独立身份核验-v1.0.md) · [购买门禁与MCP](实施/生成式购买门禁与MCP工具接入-v1.0.md) · [无声整包编排](实施/生成式无声整包与阶段编排-v1.0.md) · [受限修改](实施/受限修改执行与新版本交付-v1.0.md) |
| 上游研究 / Upstream research | [案例深析](评估/方案案例与生成流程深析-2026-10-27.md) · [研究数据](../assets/research/one-tap-ads/README.md) |
| 版本与来源 / Changes and attribution | [CHANGELOG](../CHANGELOG.md) · [THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md) |

根目录双语README和guides为对外使用入口；中文需求、设计、开发文档保留完整细则和历史追踪。历史文档中的计数/未完成项以最新实现索引和状态指南补充为准。Root READMEs and guides provide bilingual operational entry points. Detailed historical records remain primarily Chinese; current implementation evidence supersedes historical counts, without reducing the original requirements.

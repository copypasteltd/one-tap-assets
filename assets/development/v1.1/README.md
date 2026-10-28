# 一品成片 · 开发契约 v1.1

对应需求v3.1/58项与C设计v1.0。源于保留的开发v1.0，新增Codex四阶段/Skill/每单隔离/工具/双复核/释放设计。全部DESIGN_NOT_IMPLEMENTED；无应用/云服务或真实调用。

[开发基线](development-baseline.json)｜[业务OpenAPI](contracts/openapi.json)｜[管理域OpenAPI](contracts/management-openapi.json)｜[接口目录](contracts/endpoint-catalog.md)

[数据目录](data-model.json)｜[状态机](state-machines.json)｜[58需求与20工作包](work-packages.json)｜[设计补充映射](design-compatibility.json)｜[工具策略](tool-policy.json)

[冻结执行快照](contracts/execution-snapshot.schema.json)｜[Codex合同](contracts/codex-contract.schema.json)｜[报价前冻结绑定](contracts/codex-quote-binding.schema.json)｜[阶段结果](contracts/agent-stage-result.schema.json)｜[审查包](contracts/review-packet.schema.json)｜[清理回执](contracts/cleanup-receipt.schema.json)｜[工具意图](contracts/tool-call-intent.schema.json)

[基础合成例](contracts/contract-fixtures.json)｜[Codex合成例](contracts/codex-fixtures.json)｜[开发核验](verification-report.json)｜[Codex总核验](codex-verification-report.json)

生成入口为scripts/生成Codex开发契约.py，总核验为scripts/核验Codex方案.py。合成例检验schema/指定交付语义；不能证明真实媒体、身份隔离、费用控制或实例已释放。生产CLI/protocol/模型/费率、准入签名与运行限额仍待G0，所有变体保持禁售。

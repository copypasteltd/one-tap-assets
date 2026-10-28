# 一品成片 · 开发合同 v1.0

基于需求v3.0/C设计1.0，状态DESIGN_NOT_IMPLEMENTED。以下为工程设计与文档核验，尚无API、数据库、模型/支付或云端部署。

| 文件 | 用途 |
| --- | --- |
| [development-baseline.json](development-baseline.json) | 版本、15项工程约束、输入/保留/期限政策及实现状态 |
| [contracts/openapi.json](contracts/openapi.json) | 自有业务API、鉴权/幂等、请求响应schema、F/D关联 |
| [contracts/management-openapi.json](contracts/management-openapi.json) | 独立管理身份与逐动作权限的审核/准入/停售/补偿/恢复合同 |
| [contracts/endpoint-catalog.md](contracts/endpoint-catalog.md) | 可读接口库存 |
| [contracts/endpoints.json](contracts/endpoints.json) | 供联调/追踪工具读取的接口目录 |
| [商品身份锁schema](contracts/product-identity-lock.schema.json) | 有证据的商品不可变约束 |
| [执行快照schema](contracts/execution-snapshot.schema.json) | 已售计划/模型/声音/时间轴/规格/预算/截止 |
| [供应商意图schema](contracts/provider-submission.schema.json) | 先意图/预留、后提交/回执及UNKNOWN恢复 |
| [合成契约正负例](contracts/contract-fixtures.json) | 假数据，只检验类型与指定跨字段规则 |
| [state-machines.json](state-machines.json) | 独立状态/合法边/守卫，不能据此绕过事务 |
| [data-model.json](data-model.json) | 逻辑实体/字段/关键唯一键/隔离外键目录，非已执行DDL |
| [work-packages.json](work-packages.json) | 16包依赖、50项需求/用例/设计映射、6项未来积压 |
| [verification-report.json](verification-report.json) | 本轮文档检查，不代表产品验收 |
| [官方OpenAPI结构schema来源](contracts/vendor/source-record.json) | 本地离线验证所用官方schema与摘要 |

开发入口见[开发文档](../../../docs/开发/README.md)。生成源为[scripts/生成开发契约.py](../../../scripts/生成开发契约.py)，检查为[scripts/核验开发文档.py](../../../scripts/核验开发文档.py)。生成器不会下载依赖或调用外部服务；核验使用本机现有Python jsonschema，官方结构schema已按来源留存，可离线重跑。

接口action是本项目适配器合同，不能直接当支付宝/抖音官方报文。原生支付payload/验签/ACK、模型能力与费率在G0核实后单独冻结。schema内的FIXTURE/示例金额、模型和URL均不用于生产，不能据此启售。

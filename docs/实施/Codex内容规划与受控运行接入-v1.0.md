# Codex 内容规划与受控运行接入

2026-10-28｜需求 v3.1 / 开发契约 v1.1 的实现增补；完整应用仍为 IN_PROGRESS。

本轮补齐 PLAN 阶段的受控运行适配、私有 Responses 计费出口与恢复逻辑。已用明确的协议/模型测试替身验证原生子进程、真实 HTTPS MCP、PostgreSQL、工具与计划提交。测试替身不是 Codex，不构成真实模型调用、原生 OS 隔离、供应商账单或实际释放的准入证据。

## 源码结构与执行链路

| 源码 | 职责 |
| --- | --- |
| `src/worker/codex/admission.ts` | 审核后运行/费率配置的结构、构建/模型/协议/有效期校验；整数微单位成本计算 |
| `src/worker/codex/launcher.ts` | 校验项目内程序路径、重解析点与构建 SHA；调用锁定原生隔离器，校验启动/释放回执 |
| `src/worker/codex/runtime.ts` | 独立角色目录/配置/能力、stdio 握手、6份 Skill 显式发现与加载、MCP 检查、结构化结果及清理证据 |
| `src/worker/codex/inference.ts` | 文本 Responses 出口；逐请求上界预留、调用意图、私有 SSE 回执、结算、重放与 UNKNOWN 拒绝重购 |
| `src/worker/codex/planning.ts` | 冻结商品/方案上下文，执行 CONTENT，恢复原检查点，再经阶段租约事务发布 READY 计划 |
| `src/worker/tool-gateway/content-tools.ts` | 读取已完成真实视觉档案、严格验证计划、持久化 run 结果；工具本身不推进父阶段 |

API 创建规划前固定商品档案、建议计划、执行变体源码、Skill Bundle 摘要、运行准入与平台推理限额，并将这些一起计入 stage 输入摘要。Worker 校验原摘要，建立新的实例与 CONTENT run，再启动受限角色。模型需读取证据，验证计划，并通过 persist_stage_result 保存结果；最终 JSON 必须与该结果的哈希一致，且存在已结算推理回执。

父阶段提交前再锁定商品，核对当前照片/档案未改变，校验 run 输入/输出和状态，才将 Plan 置为 READY。若在角色完成后、父阶段提交前崩溃，接管者复用原持久结果；不重建会话或再次购买推理。当前不对无法判定的旧 run 自动重开模型任务，等待原截止或后续对账处理。

报价增加一致性检查：已完成规划的构建、协议、模型版本、费率与 Skill 组合必须匹配当前拟售 CodexContract。不能规划时用一种能力，报价时静默绑定另一种能力。

## 私有推理出口

`POST /v1/internal/p01/agent-inference/responses` 是运行实例专用的 Responses 桥接，不是小程序业务 API，不对公众提供通用模型代理。它和已有3个私有 MCP 网关路由一样属于内部运行期协议；不改变既有92项公开/管理业务契约或213个 schema。

角色只持有短期 capability。该票据绑定 tenant、run、instance、stage、快照、阶段代次与实例代次，并依赖仍有效的阶段/实例租约。供应商 API Key 留在服务端出口，不写入角色配置、MCP、前端或启动清单。

出口只接受锁定模型的文本/函数上下文，要求 store=false、stream=true；服务档位固定 default，回执也必须返回同档位，不能静默切换 Priority 等其他价格。缓存键由平台绑定 tenant/作用域/run，保留方式固定 in_memory，不接受24小时缓存。可用函数限于本 run 实际装载的 ypcc MCP 工具；托管搜索、图片/音频输入、命令、文件工具、跨响应历史和其他模型被拒绝。当前仅为 CONTENT/PLAN 提供文本编排能力；照片识别仍由独立计费的真实视觉适配器完成。制作和复核需要的媒体证据接入尚未完成。

1. 以原始逻辑请求摘要查重，再按成本域锁定并核验能力尚有效。
2. 统计同一成本域跨 run 的请求、token 与费用；新会话不重置限额。存在 SUBMITTING/UNKNOWN 时阻止新购。
3. 按已认证的 UTF-8 请求字节加固定开销上界，及强制最大输出 token，计算人民币微单位费用。先预留订单或本人/中国业务日平台额度，再持久化 SUBMITTING 意图。
4. 只通过 HTTPS / 批准域名 / 公网 DNS 固定地址向已审核 Responses 服务提交一次。暂存有界 SSE，核对唯一响应、实际模型、终态与用量。
5. 回执先写确定性私有对象键，再提交数据库费用与摘要。重放或对象/数据库提交窗口恢复只读原回执，绝不重新 POST。
6. 返回原 SSE 前再次检查 capability，覆盖存储读取期间撤权。已在途费用仍独立结算；撤权不等于远端免费。

网络断开、无回执、用量无效或不能确认收费时保留 UNKNOWN 占用。只对准入协议确有“不计费”依据的 HTTP 状态释放费用。实际模型/事件/用量越界会标记相同准入摘要暂停新请求，不能只拒绝当前买家后继续售卖同一能力。

**上界验证仍为 G0 前置条件**：字节加开销不是对任意模型的通用 tokenizer 定理。须针对固定构建发出的全部请求形式、所选模型的实际计费 token、工具/Skill 包装及推理输出完成验证，并绑定证据与 CNY 费率/汇率。供应商忽略最大输出、返回不同模型或使用未覆盖的计费项时，软件中断和事件监听不能保证账单上限。当前只有程序约束与合成回执测试，不能宣称实际计费硬边界已验证。

## 原生隔离器接入约定

生产路径要求一个经审核、SHA 固定的原生 `.exe` 隔离器，提供以下两个无 shell 命令：

```text
<launcher.exe> run --manifest <本项目内绝对 launch.json 路径>
<launcher.exe> release --manifest <同一个 launch.json 路径>
```

run 的 stdin/stdout 必须直接转接 app-server 的 NDJSON；诊断只走有界 stderr，不在 stdout 混入横幅。平台10秒内等待启动回执，release 最多30秒等待原进程组停止与清理回执。平台不以任意 PID 杀进程作为成功清理证明。

YPCC-NATIVE-LAUNCH-1 清单固定可执行程序及 SHA、参数、工作目录、白名单环境、只读/可写目录、网关原点、原截止和随机 nonce。清单含短期票据，位于与角色目录分开的 agent-control，须仅启动服务可读。隔离器必须实际落实专用低权限身份、ACL（只读例外优先于父目录可写）、进程树/资源控制、禁止 shell 和虚拟化、精确出站限制及可验证回收。启动回执必须匹配 nonce、实例、run、身份和受控进程引用；仅填写 JSON 字段不能证明隔离。

本项目目前提供**隔离器调用适配层与协议，不包含已实现/已准入的原生隔离器可执行程序**。未配置时不会直接用同用户 Codex 进程或 Docker / WSL / 虚拟机后备。集成测试中的 FixtureLauncher 仅允许 APP_ENV=test，在生产环境注入会被拒绝。CLI 内置 shell 禁用、有效 Windows 管理策略 windows.allow_mxc=false、Skill 自动发现和只读范围仍须用锁定构建实测。

角色使用独立 CODEX_HOME、工作/临时目录；不继承桌面个人登录、全局 Skill 或服务密钥。Skill 内容按摘要材料化，发现结果必须恰好包含6个允许 Skill，turn 显式携带绝对 Skill 路径。MCP 必须只包含实际装载工具；当前 CONTENT 装载 analyze_photos、validate_content_plan、persist_stage_result，不广告尚未完成的媒体工具。出现新权限申请会拒绝并结束该 run。

## 释放与恢复边界

正常或失败退出先撤销能力、写 ReleaseRequested，再结束协议与原生进程组，核验角色 home/work/tmp 已清理，删除含票据的启动清单，并写独立 CleanupReceipt。只有回执与目录检查通过才将实例标记 RELEASED；缺证据保留 CLEANUP_FAILED。规划 READY 与实例清理状态分开，不能互相替代。

Worker 崩溃后的独立孤儿扫描/释放消费者尚未实现；ReleaseRequested 仍保留在 outbox，不会被无对应处理器的 Worker 假消费。供应商/推理 UNKNOWN 仍留在独立意图/成本账中；清理本地会话不宣称远端取消或删除。当前 SSE 私有回执的隐私删除/保留清理还需与整体隐私消费者一起完成，不能默认长期留存。

## 配置与验证

新增键为 CODEX_RUNTIME_ADMISSION_PATH、CODEX_PLANNING_DAILY_BUDGET_MICRO，其余沿用 .env.example 的 CODEX 构建/协议/模型/费用与隔离器键。CODEX_INFERENCE_PROXY 为空时由本服务 HTTPS 原点派生；若填写，必须等于该原点加 `/v1/internal/p01/agent-inference`，不能绕过本平台预算出口。

[准入示例](../../assets/config-examples/codex-runtime-admission.example.json)保持 NOT_EVALUATED / 空证据 / 空模型费率，直接使用会被拒绝。不能把合成测试合同或人工替换 state 当作 G0 通过。真实模型、Codex、支付与发布保持默认关闭；未发起付费模型请求。

针对性测试覆盖 SSE/整数费用、禁用工具、缺换行协议大小、已取消 turn、原请求重放、UNKNOWN 不重购、对象/数据库恢复、同成本域并发、token/轮次/费用冻结、撤权时序、真实 HTTPS MCP 工具执行、Skill/MCP 越界、结构化结果未持久化、RPC 自称成功但缺推理回执、父阶段接管、商品变化拒绝与独立清理状态。完整命令及数量以[源码验证索引](../../assets/implementation/current.json)为准；真实 Codex、原生隔离/回收、独立双复核与三路线整包仍 NOT_RUN。

接入依据为本机锁定构建导出的 `runtime/codex-research/protocol/` 与[官方 App Server 文档](https://learn.chatgpt.com/docs/app-server)。不同服务档位与实际回执的依据见[官方处理档位说明](https://developers.openai.com/api/docs/guides/fast-mode)。官方协议更新不自动更新本产品准入；必须重新核验已锁定的具体字段、配置和行为。

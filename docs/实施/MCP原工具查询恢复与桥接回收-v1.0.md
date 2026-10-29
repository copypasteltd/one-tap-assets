# MCP原工具查询恢复与桥接回收 / Original MCP observations and bridge shutdown

2026-10-30。对应受控工具的原任务恢复、期限与实例回收约束。此项修补状态查询的传输恢复，不构成完整自动素材修复、真实服务或生产准入证明。最新执行结果见[验证索引](../verification/README.md)，历史有声 POST/ASR 异常的根因仍未确认。

## 执行逻辑 / Execution

1. `tools/call` 使用一次原幂等键提交一次工具创建请求。创建回执缺失、连接中断或返回错误时，不自动再次 POST，也不生成替代任务；原平台检查点和未知费用继续按原规则恢复。
2. 收到有效 `intent_id` 后，只查询这个编号。查询结果必须带相同编号和已知状态；不能将其他任务、未知状态或无效 JSON 当作完成。
3. 查询遇到明确的临时连接错误或 HTTP 500/502/503/504 时，仍查询原编号。连续第三次失败即停止；有效原任务状态重置连续失败计数。每次间隔最多沿用原 750ms，单次 HTTP 仍最多 20 秒，并且始终截断在原角色截止。
4. HTTP 401/403/404/409/429、重定向、证书错误和异常回执立即停止，不扩大权限、跳过限流、关闭 TLS 校验或创建新订单。
5. 角色截止到达，不再开始新请求，也不接受迟到结果。MCP 输入关闭后，取消本桥自己的请求和等待并退出；不会据此把后台工具标为失败、免费或已取消。

The bridge submits one creation POST. An uncertain acknowledgement is not automatically retried. After a valid acknowledgement, only the original intent is observed. Explicit transient network failures and HTTP 500/502/503/504 allow bounded observation retries: the third consecutive failure stops, while a valid original state resets that counter. The existing 750ms interval, 20-second HTTP cap and original absolute role deadline remain. Authorization, rate-limit, TLS, redirect and invalid-result failures stop immediately. Closing stdin aborts only bridge-owned I/O; it does not settle or cancel durable work.

`tools/list` 仍按原发现门禁执行，不因本项获得额外发现重试或更长 RPC 时限。原订单付款、授权、租约代次、工具次数、成本、UNKNOWN 和释放状态仍由服务端校验；查询恢复不授予新副作用权限。

Tool discovery retains its original failure behavior and RPC cap. Backend payment, authorization, leases, fences, tool quotas, costs, UNKNOWN accounting and release state remain authoritative. Read recovery grants no purchase authority.

## 验证与使用 / Verification and operation

无需新增配置、数据库迁移或小程序操作。正常启动仍见[快速启动](../guides/QUICKSTART.md)。源码入口为[MCP桥](../../src/worker/tool-gateway/mcp-main.ts)，专项为[真实HTTPS与stdio回归](../../tests/integration/mcp-observation.test.ts)。

```powershell
.\scripts\run.ps1 test:integration mcp-observation tool-consumer
```

专项临时编译当前桥源码，使用本项目原生 Node、TLS 和 stdio，注入连接中断、503、真实20秒请求超时、授权/限流拒绝、错误任务/状态/JSON、未知创建回执、原截止及输入关闭。平台响应为显式合成，不调用真实模型或支付，不证明生产隔离；共享数据库队列另由原工具消费者专项验证。

The tests compile the current bridge and exercise actual native TLS/stdio with explicitly synthetic platform responses. They cover reset/503/real 20-second timeout, authority and rate rejection, wrong intent/state/JSON, unknown creation acknowledgement, deadline and stdin closure. They do not certify providers, payments or production isolation. Existing consumer tests separately cover the durable database queue.

旧桥的隔离副本仅改测试导入/编译路径，用同一“收到原编号后连接中断”断言作负向对照。其结果与当前源码专项、完整执行分别记录；即使负向对照按预期失败、当前专项通过，也不能断言历史 ASR 异常一定由同一原因触发。

An isolated previous-source control changes only import/build paths and uses the same reset-after-acknowledgement assertion. Its outcome remains separate from current-source and full verification. A demonstrated old failure and passing new regression do not prove the cause of the historical ASR failure.

# Worker脱敏故障诊断与日志隔离 / Private worker diagnostics

需求v3.1、开发契约v1.1。本文描述内部故障定位与日志回调的运行边界，不是新增用户操作或生产准入。

## 解决的问题 / Problem and behavior

制作工具曾在完整原生测试中返回 `WORKER_INTERNAL_ERROR`，未保留可区分数据库、文件系统或程序异常的内部分类。另一个已确认的源码问题是：成功阶段提交之后，日志回调抛错会进入阶段失败处理；工具日志回调抛错也会中断消费者调用。观察性输出不能改变已经完成的事务。

An earlier full native run reported a generic production-tool failure without a useful internal classification. A separate confirmed code defect allowed a throwing log callback to enter failure handling after a successful stage commit. Diagnostic output must not change the authoritative work outcome.

## 数据与权限 / Data and access

`src/worker/observability.ts`提供固定结构，供平台Worker内部日志使用：

```json
{
  "event": "tool_execution_deferred",
  "code": "WORKER_INTERNAL_ERROR",
  "resource_id": "intent_synthetic",
  "failure": { "kind": "DATABASE", "native_code": "22P02" },
  "failure_phase": "COMMIT"
}
```

`kind`使用固定枚举；原生数据库/系统错误码只接受源码中的封闭白名单。普通业务错误使用`APPLICATION`，保留原有公开业务错误码。任意异常名称、消息、堆栈、SQL正文/参数/detail、路径、供应商响应、cause、客户内容及未知原生码不会复制到此结构，也不调用异常对象的code访问器。

The fixed vocabulary distinguishes application, database, system and selected JavaScript error categories. Native codes come from a closed allowlist. Messages, stacks, SQL, parameters, paths, causes and arbitrary external fields are excluded. Error accessors are not invoked.

此结构只供平台内部运维定位。工具状态API和持久任务仍保留原来的通用`error_code`，不新增诊断、凭证或SQL字段；社区作者没有买家失败日志的访问权。该辅助分类不能证明供应商请求没有发出、费用已知或可以重新购买。

Only platform operators consume these fields. Tool polling and durable task data retain their existing public error code. A category is not evidence of submission state, known cost or permission to buy again.

| 编号 / No. | 执行位置 / Location | 内部信息 / Internal context |
| --- | --- | --- |
| 01 | 工具 / Tool | AUTHORIZE、HANDLER、RESULT、COMMIT；对应失败时的位置 / Location of failure |
| 02 | 阶段 / Stage | HANDLER或COMMIT；原租约仍决定是否可提交 / Original lease remains authoritative |
| 03 | 故障收尾 / Settlement | 原失败与收尾失败分别记录；收尾故障保持原恢复路径 / Preserve both failures and existing recovery |
| 04 | 启动/维护/循环 / Startup and loops | 固定分类，定位原生依赖或程序问题 / Fixed classifications |

## 事务与恢复 / Transactions and recovery

同步日志回调抛错被隔离，异步回调的拒绝会被接收；Worker不会等待日志回调。因此成功提交不会因日志错误被重新判为失败，失败工具的原数据库收尾也不受日志异常影响。若收尾数据库操作本身失败，工具仍抛出该故障，原未完成租约按既有机制恢复；不会伪造FAILED/SUCCEEDED、改变代次或提前释放费用。

Synchronous and asynchronous callback failures are contained without awaiting a sink. Database settlement remains authoritative. If settlement itself fails, the tool still propagates that failure and retains existing lease recovery. No success, failure, purchase or cost release is fabricated.

日志回调是尽力输出，不是耐久审计。进程终止、输出通道故障或异步日志尚未完成时可能没有日志；生产日志采集、健康监控、留存和访问控制仍须独立部署核验。不能从“无错误日志”推断任务通过。

The sink is best effort, not a durable audit ledger. Production collection, health, retention and access controls still need verification. An absent log is not a passing result.

## 核验与使用 / Verification and operation

真实PostgreSQL专项分别在处理器和提交阶段产生包含合成私有参数的`22P02`，核对内部允许码、客户端通用错误、私有结果不持久化及事务回滚。另有工具失败与成功阶段的日志抛错回归；单元检查覆盖秘密字段、访问器、未知码、非异常值与异步拒绝。原生有声测试为每个夹具有界保留最近64条脱敏事件，失败时纳入测试诊断；原断言与时限保留。

Native PostgreSQL cases cause secret-bearing `22P02` errors in handler and commit paths, checking private-data exclusion, generic polling responses and rollback. Additional cases exercise broken sinks. Native-order fixtures retain at most 64 safe events for failure diagnostics, preserving assertions and deadlines.

操作顺序：按内部任务ID查看原错误码、执行位置与允许的原生码；核对原租约、原供应商回执和原费用后处理。UNKNOWN仍查询原任务，授权撤销/截止/代次失效仍阻断，不因重启、分类或日志缺失发起新购买。

Operators correlate the internal task ID, original code, phase and allowed native code with the original lease, receipts and costs. UNKNOWN recovery queries the original task. Revocation, deadlines and fencing continue to block unauthorized work.

最新实际结果及源码摘要见[验证说明](../verification/README.md)；历史泛化制作错误与支付宝构建超时的根因尚未确认。本改动不代表完整产品、真实Codex/模型、付款、宿主真机或生产隔离已经验收。

See the [verification record](../verification/README.md) for actual results and source hashes. The earlier production failure and Alipay timeout remain unresolved; this change does not certify the complete product or real services.

# 验证与发布证据 / Verification and publication evidence

本轮[MCP原工具查询恢复与桥接回收](../实施/MCP原工具查询恢复与桥接回收-v1.0.md)只恢复原工具状态查询，不重发未知创建、不放宽权限/限流/TLS或原时限，并在输入关闭后停止本桥I/O。固定346份源码、42份契约和4项资源，摘要fdddb4e；原断言、配置、预算与截止保留。

This round adds bounded original-intent observations and owned bridge shutdown, pinned to 346 sources, 42 contracts and four resources. Original assertions, configuration, budgets and deadlines remain. Synthetic protocol responses are not real-service or production evidence.

| 编号 / No. | 检查 / Check | 实际结果 / Actual result |
| --- | --- | --- |
| 01 | 原完整命令 / Original full chain | FAIL: typecheck TIMEOUT 180s; subsequent commands not attempted |
| 02 | 单独类型统计诊断 / Separate type diagnostic | PASS; 17001ms, original 180s cap |
| 03 | 单独单元 / Separate units | 73 / 73 PASS |
| 04 | 单独原生整套 / Standalone native suite | FAIL: 7 passed, 1 failed, 15 pending; 36 empty/unexecuted files |
| 05 | 服务端/双小程序构建 / Server and both mini builds | build:server: PASS / build:alipay: TIMEOUT / build:douyin: PASS |
| 06 | 当前MCP/工具消费者专项 / Focused current MCP/consumer | 22 / 22 PASS |
| 07 | 旧桥断连负向对照 / Legacy reset control | EXPECTED FAIL: 1; unselected: 14 |

原完整命令在类型180秒上限处超时，未生成本轮完整命令的单元/原生报告。随后单独类型统计通过没有复现该超时；不能用它覆盖原FAIL或确认根因。独立命令与其首个本轮原生整套分别绑定同一源码和已预构建桥的实际摘要，没有复用旧原生报告。

The original full chain times out at its unchanged type-check cap before units/native tests. A separate diagnostic does not reproduce it, but cannot replace the FAIL or prove its cause. Independent checks and the subsequent first current-source standalone native suite retain their own evidence. No previous native report is reused.

本轮独立原生失败发生在生成参考素材时：private_object_writes状态更新触发数据库语句超时，尚未到该用例的听音恢复断言；超时原因未确认。

The standalone native failure occurs while preparing generated references: a private_object_writes state update hits the original database statement timeout before the listening-recovery assertions. The timeout cause is unconfirmed.

独立原生报告以逐条断言状态统计未执行项；bail停止后原Vitest顶层pending为0，不能把它当作全部执行。归档器在测试、原日志写入和源码复核完成后发生报告路径变量遮蔽错误；仅修正归档，从同一次原报告逐字节补齐记录，没有重新执行测试，丢失的整条命令耗时保持null。源文件/编译桥再次复核，原包装器摘要和恢复依据保留在来源JSON。

Standalone counts retain actual assertion states, including pending assertions omitted by Vitest's top-level pending count after bail. A wrapper report-path shadowing error occurred after testing, log persistence and source checks. Archive-only recovery copies the same original report byte for byte without rerunning tests; unavailable total command timing stays null. Original wrapper hashes and recovery provenance are explicit.

来源：[本轮原工具验证](mcp-observation-native-source.json)、[实现索引](../../assets/implementation/current.json)、[实际发布检查](publication.json)、[暂存字节与媒体核验](repository-audit.json)。原日志和报告在忽略的runtime目录，公开来源保留摘要；外部模型、付款、隔离和真实用户素材不参与这些合成协议测试。

Evidence links bind original local logs/reports and actual source bytes. Private runtime data remains excluded. Fixtures, separate checks and builds do not certify real providers, devices, complete repair or production.

历史[费用来源](order-budget-native-source.json)保留345源码a26c133上的3通过/1失败/19挂起及35空文件、原ASR待恢复时角色结束与未复现单项；[Worker来源](worker-failure-native-source.json)、[队列来源](tool-queue-native-source.json)、[文字来源](text-layout-native-source.json)、[标识来源](disclosure-native-source.json)、[声音来源](audio-review-native-source.json)、[听音来源](listening-native-source.json)均保持原字节。新桥旧代码对照证明确定的恢复缺口，不能证明历史ASR/恢复/制作/编译异常的根因。

Earlier evidence remains immutable. The controlled old-bridge failure establishes an observation-recovery gap; it does not establish the cause of historical faults.

原36媒体与C25文件/归档不变；本轮无页面变更、浏览器、虚拟化或真实外部付费调用。完整自动修复、全部58需求/52P0、产品/生产/云端未完成，所有方案禁售。Original media/design bytes remain; full-product/production/cloud admission stays false.

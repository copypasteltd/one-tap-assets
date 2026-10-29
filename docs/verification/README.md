# 验证与发布证据 / Verification and publication evidence

本轮[首轮制作费用隔离与原费用回执](../实施/首轮制作费用隔离与原费用回执-v1.0.md)保护原总预算内的修复与售后保留额。固定345份源码/测试/配置、42份运行契约和4项资源，源码摘要a26c133。全部断言和上限保持原值；未保留旧原生报告。

This round protects original repair/aftercare holds and original cost-intent accounting. The fresh snapshot contains 345 source/test/config files, 42 contracts and four resources, pinned to a26c133. Assertions and limits are unchanged; no old native report is retained.

| 编号 / No. | 检查 / Check | 实际结果 / Actual result |
| --- | --- | --- |
| 01 | 类型 / Types | PASS |
| 02 | 单元 / Units | 73 / 73 PASS |
| 03 | 完整原生 / Full native | FAIL: 3 PASS / 1 FAIL / 19 pending; 35 empty files |
| 04 | 完整命令记录 / Full command record | typecheck: PASS / test: PASS / test:integration: FAIL |
| 05 | 构建 / Builds | build:server: PASS / build:alipay: PASS / build:douyin: PASS |
| 06 | 当前费用/队列专项 / Focused current costs/queue | 11 / 11 PASS |
| 07 | 旧费用代码真实锁等待 / Legacy observed lock-wait control | EXPECTED FAIL: 1; unselected/skipped: 5 |

本轮有声REFERENCE_FILM最终交付用例在POST阶段失败：原合成ASR仍待恢复，Codex阶段结束时工具保持RUNNING，保留ASR_ORIGINAL_TASK_PENDING；底层原因未确认。 同源码原上限下单独用例1通过/0失败/22未选，不替代整套。

The native REFERENCE_FILM final-delivery case fails during POST while the original synthetic ASR remains pending. The tool is still RUNNING with ASR_ORIGINAL_TASK_PENDING when the role ends; the underlying cause is unconfirmed. An isolated unchanged-source run has 1 passed, 0 failed and 22 unselected cases; it does not replace the full run.

旧费用实现经过真实行锁等待后仍允许已过期订单预留，新实现拒绝；负向对照使用提交前源码的隔离副本，不能替代新源码测试。初步整套在类型/73单元通过后，为加强这个断言由本轮主动停止；原生未形成完整报告，取消记录和原日志独立保留，不计成功或应用测试失败。随后执行的本轮完整检查才是表中来源。

The legacy isolated control accepts a reservation after an observed lock wait and expiry; current code rejects it. A preliminary attempt was explicitly cancelled after types/73 units to strengthen that assertion. Its incomplete native run is retained as cancelled, with no full pass or application failure inferred. The table reports the subsequent complete attempt's actual outcome.

最新来源：[原费用验证来源](order-budget-native-source.json)、[实现清单](../../assets/implementation/current.json)、[实际发布检查](publication.json)、[独立暂存字节/链接/媒体核验](repository-audit.json)。日志、原报告和负向对照副本放在忽略的runtime目录，公开来源保留其摘要；不是外部服务、真机或完整修复证明。

Current evidence links bind source bytes and original local report/log hashes. Private runtime files remain excluded. A passing source check does not certify complete repair, real services, devices or production.

历史[Worker诊断来源](worker-failure-native-source.json)保留343源码上的60通过/1失败/3挂起及30空文件、原30秒pg_restore空状态与未复现副本。更早的[队列来源](tool-queue-native-source.json)、[文字来源](text-layout-native-source.json)及[尝试记录](text-layout-attempts.json)、[标识来源](disclosure-native-source.json)、[声音复核来源](audio-review-native-source.json)、[听音来源](listening-native-source.json)保持原字节。历史错误根因未确认，不能用本轮结果声称已根治。

Earlier verification remains immutable historical evidence. The previous restore failure and earlier production/compiler failures have no confirmed root cause; current results do not establish a root-cause fix.

36份原截图/录屏/GIF及声音、标识媒体与C的25文件/归档保持原字节；本轮无页面改动、无浏览器调用、无虚拟化或真实外部付费服务。全产品、生产准入及云端部署仍为false，全部方案禁售。All original media/design bytes remain unchanged. No browser, virtualization or real paid service is used; product/production/cloud admission remains false.

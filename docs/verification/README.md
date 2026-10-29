# 验证与发布证据 / Verification and publication evidence

本轮固定343份源码/测试/配置、42份运行契约和4项资源，源码摘要01227dd；类型和73项单元通过。全新完整原生结果为 FAIL: 60 PASS / 1 FAIL / 3 pending; 30 empty files，完整命令记录为 typecheck: PASS / test: PASS / test:integration: FAIL。23项有声订单夹具均通过，新的失败位于pg_restore返回空状态的断言，原30秒调用上限保留；原执行未记录error/signal，不能断定根因。增加退出信息的独立副本约18.48秒通过，其中dump约0.64秒、restore约8.74秒，未复现原失败，不替代整套。

构建记录：build:server: PASS / build:alipay: PASS / build:douyin: PASS；单独构建不替代完整原生结果。不保留旧原生报告，不放宽断言/时限。此前专项工具7项通过，另一文件初始化达到原60秒上限、6项未执行；随后同源码独立阶段6项通过，原记录保留。

旧e979源码支付宝CPU诊断在原600秒停于92%资源压缩，采样以依赖加载/文件读取为主；不替代当前普通构建或证明根因。最新实际来源见[验证说明](worker-failure-native-source.json)。历史泛化制作故障、真实语义/费用/授权/隔离、完整自动修复与全产品/生产/云端准入仍待验。

The fresh 343 source/test/config, 42 runtime-contract and four-resource snapshot is 01227dd. Types and all 73 unit tests pass. Full native result: FAIL: 60 PASS / 1 FAIL / 3 pending; 30 empty files. Fresh command record: typecheck: PASS / test: PASS / test:integration: FAIL. All 23 native-order fixtures pass. The new failure observes a null pg_restore status under the original 30-second cap; its original error/signal was not recorded, so the cause remains unknown. A separately instrumented copy passes in about 18.48 seconds, with dump/restore taking about 0.64/8.74 seconds, without reproducing or replacing the full failure.

Build record: build:server: PASS / build:alipay: PASS / build:douyin: PASS; separate builds do not replace native verification. No previous native result is retained and no assertion/deadline is relaxed. An earlier focused run passes seven tool cases while its worker file reaches the original 60-second setup cap with six cases unexecuted; a subsequent isolated run passes all six worker cases on the same source.

The old e979 Alipay CPU diagnostic reaches its original 600-second cap at 92% asset processing, with module/file reads dominating samples; it neither replaces a current ordinary build nor establishes a cause. See [actual provenance](worker-failure-native-source.json). The earlier generic production fault, real semantics/billing/rights/isolation, complete repair and full-product/production/cloud admission remain unresolved.

| 编号 / No. | 当前检查 / Current check | 实际结果 / Actual result |
| --- | --- | --- |
| 01 | 类型 / Types | PASS |
| 02 | 单元 / Units | 73 / 73 PASS |
| 03 | 完整原生 / Full native | FAIL: 60 PASS / 1 FAIL / 3 pending; 30 empty files |
| 04 | 服务端与双小程序 / Server and mini builds | build:server: PASS / build:alipay: PASS / build:douyin: PASS；不替代03 / Does not replace 03 |
| 05 | 文档与契约 / Docs and contracts | [实际报告](contracts.json) |
| 06 | 媒体 / Media | 36份原来源文件；本轮未改界面/媒体 / Original provenance, no recapture this round |
| 07 | 发布候选/暂存完整性 / Publication and staged integrity | [检查器](publication.json) · [独立字节审计](repository-audit.json) |
| 08 | 当前工具/阶段专项 / Current tool and worker cases | 7 / 7 tools PASS；随后独立6 / 6 workers PASS；早期初始化失败保留，不替代03 / Isolated results, earlier setup failure retained; not a replacement for 03 |

本轮实现说明：[Worker脱敏故障诊断与日志隔离](../实施/Worker脱敏故障诊断与日志隔离-v1.0.md)。真实PG处理器和提交错误的秘密隔离/事务回滚、成功阶段及故障工具的日志异常边界详见新来源；此前e979队列来源与八次文字失败保持各自原始字节。

Current implementation: [private failure diagnostics and log isolation](../实施/Worker脱敏故障诊断与日志隔离-v1.0.md). New provenance covers native database privacy/rollback and non-authoritative sinks. Earlier queue and text-layout failure records remain unchanged historical evidence.

## 历史文字专项 / Historical text-layout attempts

以下八次失败属于各自原源码快照；最近一次为d2077c2，341文件、71单元、13原生通过/1原120秒超时，另三项构建单独通过。[当时来源](text-layout-native-source.json)和[原尝试记录](text-layout-attempts.json)保持原字节；原通用runtime日志路径可能在后续执行中轮转。当前来源新增按本轮前缀归档的每命令日志、完整报告与源码起始摘要。

These failures retain their original snapshots. The latest previous snapshot d2077c2 is not relabeled as the current run. Generic runtime log paths can rotate; the new provenance also archives individual command logs and complete reports under the current run prefix.

| 编号 / No. | 完整尝试 / Full attempt | 实际结果 / Actual result |
| --- | --- | --- |
| 01 | 1 | 14 PASS / 1 FAIL · REFERENCE_RESULT_NOT_PERSISTED |
| 02 | 2 | 类型原180秒超时 / Typecheck timeout · TYPECHECK_180S_TIMEOUT |
| 03 | 3 | 342 PASS / 1 FAIL · LEGACY_FIXTURE_MISSING_PLAN_REQUEST |
| 04 | 4 | 3 PASS / 1 FAIL · ONE_UNRELEASED_REFERENCE_FILM_INSTANCE |
| 05 | 5 | 类型原180秒超时 / Typecheck timeout · TYPECHECK_180S_TIMEOUT |
| 06 | 6 | 14 PASS / 1 FAIL · REVOKED_VOICE_QC_120S_TIMEOUT |
| 07 | 7 | 13 PASS / 1 FAIL · REVOKED_ORIGINAL_WRITE_QC_120S_TIMEOUT |
| 08 | 8 | 13 PASS / 1 FAIL · REVOKED_ORIGINAL_WRITE_QC_120S_TIMEOUT |

第三次失败已确认旧手工夹具漏存原PlanRequest，现已补齐真实输入并明确拒绝缺失选择；其他失败根因未确认。参考结果缺失、交付后未释放、原生进程0xC0000374及定向复查各自保留，单例通过不改写历史失败。

Attempt 3 identifies a missing original PlanRequest in the manual fixture. The fixture now matches real creation input and missing historical selections explicitly reject without replacing stored results. Other root causes remain unconfirmed; focused retries never rewrite failed attempts.

历史通过证据只适用于原快照 / Historical passing evidence applies to its original snapshot: [可见标识](disclosure-native-source.json) · [标识历史尝试](disclosure-attempts.json) · [最终声音复核](audio-review-native-source.json) · [声音复核尝试](audio-review-attempts.json) · [原听音](listening-native-source.json) · [原听音尝试](listening-attempts.json)。

上一轮实际重录的4份标识示例及原页面/声音媒体本轮保持原字节，C25原件与归档不变。测试模型语义、授权、计量/支付和隔离为合成控制；真实服务、完整修复/社区/变体/真机、全58需求和完整产品/生产/云端均未完成。

Existing browser/audio/disclosure media and frozen C retain their bytes and provenance. Synthetic semantics, rights, metering/payments and isolation do not certify real services or complete product admission.

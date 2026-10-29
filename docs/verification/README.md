# 验证与发布证据 / Verification and publication evidence

本轮固定341份源码/测试/配置、42份运行契约和4项资源；类型与71项单元通过，当前完整原生执行14项通过、1项失败，同文件8项挂起，其他34文件未执行，整套未通过。拟验证声音许可撤销的用例在PRODUCTION工具出现WORKER_INTERNAL_ERROR，尚未走到该次撤权断言；原文件撤权用例本次通过。没有保留旧原生报告或放宽原断言/时限。当前源码5项队列专项与增加错误记录的夹具副本定向通过单独留存，未复现原内部错误，不证明根因。单独构建：build:server: PASS / build:alipay: TIMEOUT 600s / build:douyin: PASS；支付宝在原600秒内停于Webpack/Babel编译阶段，未返回具体源码错误，不能沿用旧构建通过。最新失败与来源见[验证说明](tool-queue-native-source.json)；真实语义、费用、授权、隔离、完整自动修复与全产品/生产准入仍待验。

On the fresh 341 source/test/config, 42 runtime-contract and four resource snapshot, types and 71 unit tests pass; the full native attempt records 14 passes and one failure, eight pending cases in that file and 34 other files unexecuted. The voice-revocation case fails in its PRODUCTION tool with WORKER_INTERNAL_ERROR before the intended revocation assertion; the original-write case passes. No old native report was retained or assertion/deadline relaxed. Five current-source queue tests and a separately instrumented fixture-copy diagnostic pass; the internal error is not reproduced and its cause remains unknown. Separate builds: build:server: PASS / build:alipay: TIMEOUT 600s / build:douyin: PASS. Alipay reaches the original 600-second cap during Webpack/Babel compilation without a specific source diagnostic; earlier successful builds are not relabeled. See [validation provenance](tool-queue-native-source.json). Real semantics, billing, rights, isolation, complete repair and full-product/production admission remain incomplete.

| 编号 / No. | 当前检查 / Current check | 实际结果 / Actual result |
| --- | --- | --- |
| 01 | 类型 / Types | PASS |
| 02 | 单元 / Units | 71 / 71 PASS |
| 03 | 完整原生 / Full native | FAIL: 14 PASS / 1 FAIL; remainder as reported |
| 04 | 服务端与双小程序 / Server and mini builds | build:server: PASS / build:alipay: TIMEOUT 600s / build:douyin: PASS；不替代03 / Does not replace 03 |
| 05 | 文档与契约 / Docs and contracts | [实际报告](contracts.json) |
| 06 | 媒体 / Media | 36份原来源文件；本轮未改界面/媒体 / Original provenance, no recapture this round |
| 07 | 发布候选/暂存完整性 / Publication and staged integrity | [检查器](publication.json) · [独立字节审计](repository-audit.json) |
| 08 | 当前源码队列专项 / Current-source queue tests | 5 / 5 PASS；独立输出，不替代03 / Separate report, not a replacement for 03 |

空队列64次对照：原192条、现64条数据库语句，全部返回null。六并发者、独立持行锁、白名单、UNKNOWN到时恢复、45秒租约和原代次在原生回归中验证。原文件撤权定向诊断优化前/后约95.9/49.8秒，两次记录142次原生命令；快照不是终止时完整进程转储，查询耗时可并发，不能作为完整墙钟分解、统计基准或历史超时根因。拟撤销声音许可的失败用例只在忽略目录生成副本，为处理器/提交增加错误记录并原样抛错，原源码/断言/120秒上限不变；副本单项约56.6秒通过，没有复现原内部错误。另一次独立只读数据库观察达到自己的原3秒SQL上限，不是应用测试结果或已证实根因。详见[源码与原始记录SHA](tool-queue-native-source.json)和[实现说明](../实施/工具队列原子领取与并发租约-v1.0.md)。

The empty-queue control records 192 versus 64 queries for 64 null claims. Native regression covers concurrent ownership, locked candidates, handler filtering, original UNKNOWN availability and lease fences. Focused original-write diagnostics pass before/after within the original cap; snapshots are not complete terminal dumps and query durations can overlap. A fixture copy adds handler/commit error recording and rethrows unchanged errors, preserving original assertions and the 120-second cap; it passes without reproducing the internal error. A separate read-only observer hits its own three-second SQL cap. None establishes the failure cause or replaces the full native result.

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

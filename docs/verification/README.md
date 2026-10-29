# 验证与发布证据 / Verification and publication evidence

本轮固定341份源码/测试/配置、42份运行契约和4项资源：类型与71项单元通过；完整原生执行13项通过后，原文件写入授权撤销用例达到原120秒上限，整套未通过，其余未完成。服务端及支付宝/抖音构建随后按同一源码单独执行通过，不能把这些结果合并为六项全通过。完整执行失败、阶段耗时及精确来源见[验证说明](text-layout-native-source.json)。未放宽断言/期限，未复用旧原生报告；真实语义、费用、授权、隔离与全产品/生产准入仍待验。

On the fixed 341 source/test/config, 42 runtime-contract and four resource snapshot, types and all 71 unit tests pass. The complete native run stops after 13 passes and one original-write revocation case exceeds its unchanged 120-second limit; the remainder is incomplete. Server and both mini builds pass separately on the same source. This is not six passing checks. See [validation provenance](text-layout-native-source.json) for failed runs, phase observations and exact bindings. No assertions/deadlines were relaxed or old native report retained; full-product and real-service admission remain incomplete.

| 编号 / No. | 本轮检查 / Current check | 结果 / Result | 来源 / Evidence |
| --- | --- | --- | --- |
| 01 | 类型 / Types | PASS | 最新固定源码；[实现索引](../../assets/implementation/current.json) |
| 02 | 单元 / Units | 71 / 71 PASS | 同一次完整执行中的原始报告SHA / Original report hash |
| 03 | 完整原生 / Complete native | FAIL，13通过 / pass，1超时 / timeout | 原120秒上限，34个其他文件未完成 / Other 34 files not completed |
| 04 | 服务端、支付宝、抖音 / Server, Alipay, Douyin | 三项单独PASS / Three separate passes | [同源码构建记录](text-layout-native-source.json)；不替代03 / Does not replace 03 |
| 05 | 文档与契约 / Docs and contracts | 以实际报告为准 / Actual result | [报告](contracts.json) |
| 06 | 媒体 / Media | 36份实际文件 / 36 actual files | [页面20](../media/capture-manifest.json)、[声音12](../media/native-audio/capture-manifest.json)、[标识4](../media/ai-disclosure/capture-manifest.json) |
| 07 | 发布/暂存完整性 / Publication and staged integrity | 应用未通过，不能生产发布 / Application blocked | [发布记录](publication.json)、[暂存审计](repository-audit.json) |

当前原生用例在QC准备前已用尽期限。阶段记录约为准备14.8秒、制作50.1秒、后期56.4秒；另一次定向诊断也在QC前超时。未证明只因整套累计运行或已经解决根因。短文案28次实际PNG/文字/尺寸/错误码不变属于有界控制，不是统计性能测试，也不替代当前完整原生检查。

The latest timeout occurs before QC preparation. Approximate setup/production/POST timings are 14.8/50.1/56.4 seconds; a separate focused run also times out before QC. No root cause or cumulative-suite-only cause is established. The 28 exact-output controls are not a statistical benchmark or a full native pass.

[原控制与回归范围](../../assets/implementation/regressions/visible-text-layout.json) · [完整尝试、源码差异与阶段记录](text-layout-attempts.json)。原始日志和诊断保留在忽略的runtime目录，对外发布摘要与SHA，不发布客户载荷。

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

本轮4份标识媒体已由实际脚本重录；不变的静帧输入可得到同SHA的视频/取帧/GIF。页面及声音媒体保留原来源，C25原件与归档不变。测试模型语义、授权、用量/账单、支付和隔离仍为合成控制；真实服务、自动修复、完整变体/真机、全58需求和完整产品/生产/云端均未完成。

Four disclosure fixtures were actually recaptured; identical static inputs can reproduce identical video/frame/GIF bytes. Browser/audio provenance and frozen C remain intact. Model semantics, rights, usage/billing, payments and isolation are synthetic controls. Real services, full repair/variant/device coverage and full-product/production/cloud acceptance remain incomplete.

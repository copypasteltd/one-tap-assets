# 验证与发布证据 / Verification and publication evidence

2026-10-29最新仓库整理仅更新恢复/发布指南与说明。应用源码、运行契约、资源、C原件及36份媒体保持原摘要；应用六项结果仍来自下述可见标识源码的原执行，本次未重跑应用或录制。文档与契约核验现为4722项PASS，当前摘要及暂存审计分别记录文档发布与原应用来源，不能混为一次新的产品验收。

The latest repository organization changes documentation only. Source, runtime contracts, resources, frozen C design and all 36 media files retain their original hashes. The six application checks below belong to the original disclosure-source run; they were not rerun or recaptured in this docs round. Current documentation/contract checks pass 4,722 assertions and remain separate from application and production acceptance.

2026-10-29可见AI标识与逐帧验收源码：**70单元 / 350原生集成**通过，35个集成文件，完整原生报告跨度约1805.4秒。源码/测试/配置339份、运行契约42份、资源4份。本轮源码全新执行六项检查：类型、70项单元、350项完整原生集成、服务端及支付宝/抖音构建全部通过。完整运行前后的339份源码/测试/配置、42份运行契约和4份资源摘要一致，没有保留旧原生报告。AI标识检查使用实际RGBA字形、不透明Alpha与全部视频帧；声音正向语义仍为刻意构造的控制响应，不代表真实生成质量、中文听感、计费或商业准入。

This source snapshot freshly passes all six checks: types, 70 unit tests, 350 complete native integration tests, server and both mini builds. All 339 source/test/config, 42 runtime-contract and four resource hashes match the complete run; no old integration report is retained. Disclosure checks use actual RGBA glyphs, opaque alpha and every video frame. Positive listening semantics remain fabricated controls, not real generation quality, Chinese hearing, billing or commercial admission. Mode: `FRESH_FULL`. Native PostgreSQL/FFmpeg/media and HTTPS/stdio/MCP execute locally. Model observations, authorizations, usage, payments and isolation responses remain synthetic.

| 编号 / No. | 检查 / Check | 结果 / Result | 证明范围 / Scope |
| --- | --- | --- | --- |
| 01 | 类型/单元/完整原生集成/服务端/双小程序 | 六项全新 PASS | [实现索引](../../assets/implementation/current.json)，不代表生产准入 |
| 02 | 平台冻结规则 | 新增5项单元 PASS | 四个官方原规格、作者不能关闭、历史缺合同阻断、篡改拒绝、原图字节保留 |
| 03 | 实际字形/Alpha/全部视频帧 | 新增3项原生 PASS | 实际RGBA及不透明Alpha；1080×1920/15秒/450帧视频，空白/透明和帧索引225（从0计）单帧缺失拒绝；取消/截止/回收 |
| 04 | 生成无声/有声整包 | 原7项/23项原生全部 PASS | 制作、POST、恢复、QC与封存输入绑定最终策略SHA/实际文件SHA/完整帧数 |
| 05 | 文档与契约 | 最新4722项 PASS | [报告摘要](contracts.json)，不代替功能运行 |
| 06 | 浏览器页面媒体 | 原20文件SHA | 10截图、概览、WebM/MP4/GIF，[来源](../media/capture-manifest.json) |
| 07 | 声音媒体 | 原12文件SHA | 合成提示音与四样式MP4/PNG/GIF，[来源](../media/native-audio/capture-manifest.json) |
| 08 | AI标识示例 | 新4媒体文件 | 自绘商品PNG、15秒原生静帧MP4、帧索引225（从0计）与GIF，[来源/复录](../media/ai-disclosure/README.md) |
| 09 | 发布与暂存 | 独立核验 | [发布摘要](publication.json)、[暂存审计](repository-audit.json) |

新示例不是模型生成广告：商品为本项目自绘SVG，视频为原生静帧，GIF只展示实际标识。全帧像素比对不是OCR，也不认证支付宝/抖音宿主声明或法律标识准入。既有右上ASS“AI演绎”保留，新固定标识位于左上。原图路线、原生音轨/字幕内核、旧媒体和C25文件/归档原字节保留。

The new four-file capture is a self-drawn product and a native static video, not generative advertising quality. Pixel comparisons certify neither OCR nor host/legal marking admission. Existing top-right ASS text remains; the uniform mark occupies the top-left. Original-photo behavior, native audio/caption sources, previous media and the C design archive remain unchanged.

本轮初次单元定向因夹具误写不存在的变体ID及12/15秒规格失败一项，修正测试后五项通过。初次有声定向实际POST像素检查拒绝右上标识与原ASS的覆盖冲突；统一标识移到左上，保留原内核、像素阈值和超时。修正后有声定向5项通过/25项跳过；无声定向2项通过/5项跳过；像素专项3项通过。这些探索不计完整验收。

首次完整运行在有声文件15项通过后，POST原回执事务回滚恢复用例超过原120秒上限而停止；该文件余下7项及其他原生文件未执行。当时339份源码不变，单独复查该用例48.563秒通过/22项跳过；诊断时观察到磁盘排队较高，但未认定超时根因。第二次同源运行350项原生及服务端构建通过后，独立复现发现相同RGB配透明Alpha的不可见标识会被接受，因此主动中止未完成的双小程序构建。

RGBA修复改变四份源码：图片完整RGBA检查和透明负向断言、实现证据Alpha标志、媒体复录/专项改用不连接数据库的项目配置。首次RGBA定向曾在原15秒SQL迁移上限处失败，三个媒体检查均未运行；移除多余数据库依赖后3项通过。应用数据库专项、所有像素阈值、原租约与测试/SQL时间上限不变。最终重新冻结339份源码并全新执行全部六项、70单元/350原生，不沿用修复前原生报告。[运行前文件清单](disclosure-native-source.json)与最终源码一致，[私有来源摘要](disclosure-attempts.json)保留失败、中止、透明像素修复前后与最终运行SHA。

The first focused unit attempt exposed a fixture ID/duration mistake. Actual native POST pixel inspection then exposed a collision with the original ASS label. Moving the new policy to the top-left fixed it without changing the audio/caption kernel, thresholds or deadlines. Focused/skipped runs are not full-suite acceptance; the final fresh full run executes every unit and native test against the frozen source.

The first complete attempt stopped after 15 native cases passed and the original 120-second POST-recovery case timed out. That exact unmodified case then passed in 48.563 seconds, with 22 skipped; observed host disk pressure does not establish a root cause. The second unchanged-source attempt passed 350 native cases and the server build, then was abandoned during mini builds after a probe proved invisible alpha could bypass RGB-only checks.

Four source files add full RGBA/opaque-alpha checks, the negative assertion, explicit evidence and database-independent media fixtures. The first RGBA focus had skipped all three checks after a migration exceeded its unchanged 15-second SQL cap. Media-only tests/capture now read actual project configuration without opening a database; application database tests remain intact. The final frozen snapshot freshly runs all six checks and every case; no pre-fix, failed or focused native report is retained as final acceptance.

最终RGBA源码的首次全套尝试在原180秒类型检查上限处停止，尚无TypeScript诊断，该次未执行单元/原生/构建。超时后观察到本次TSC后代残留，下一次尝试前已自行退出；包装器超时不能证明整棵进程树已清理。该次重试前源码及时间上限不变；后续样例失败及夹具补强见下文。最终快照再从头执行六项并通过，未复用先前报告。

The first full attempt on final RGBA source timed out at the original 180-second typecheck wrapper cap without a TypeScript diagnostic; unit/native/build checks did not execute in that attempt. Its observed residual TSC descendant had exited before retry. A wrapper timeout does not certify process-tree cleanup. The source and caps were unchanged before that retry. A later sample failure and isolated fixture correction are recorded below. The final snapshot freshly passes all six checks under the same caps; no earlier report is retained.

随后原RGBA快照的全套运行在社区样例结束校验报`SAMPLE_ROLE_EVIDENCE_INCOMPLETE`：95项通过、1项失败，失败文件余下11项及28个原生文件未执行；这不是超时。原样单独复查通过1项/跳过12项。测试schema已清理，不能认定原来究竟哪个子条件失败，也未观察证实实际PID复用。独立的合成重复PID控制确认测试启动器仅用PID会使两个不同nonce的创建标识碰撞；补入已有启动nonce后同控制通过，没有启动真实OS子进程。仅修改`tests/helpers/role-launcher.ts`，不放宽生产五角色门禁、断言或超时。修正后完整社区样例13/13通过，再重新冻结339份源码全新跑六项，最终70/350均不沿用旧报告。该合成控制不证明生产创建身份或隔离。

The subsequent full attempt on the RGBA snapshot fails sample completion with `SAMPLE_ROLE_EVIDENCE_INCOMPLETE`: 95 passed, one failed, eleven pending in that file and 28 native files unexecuted. This is not a timeout. The unmodified focused case passes with twelve skipped. Test-schema cleanup removed its detailed row state, so the exact failed subcondition and actual OS PID reuse are unproven. An independent synthetic repeated-PID control proves the fixture PID-only identifier collides for distinct launch nonces; binding the existing nonce fixes that control, without launching OS children. Only the test launcher changes; production five-role guards, assertions and deadlines remain intact. All 13 corrected sample cases pass before the final fresh six-check run. This control does not certify production creation identity or isolation.

随后最终nonce快照的首次完整运行在QC准备后撤销原写入权限用例触及原120秒上限，13项通过、1项失败，未完成全套。原样单例109.382秒通过/22项跳过；未认定环境为已证实根因。最终再按完全相同339份源码从头执行六项，不复用该失败或定向报告，也未改生产门禁、断言、费用/次数或任何时间上限。重跑期间暂停额外文件扫描及转码。

The first full attempt on the final nonce-bound snapshot stops at the original QC-write-revocation 120-second cap after thirteen passed cases and one failure. The unmodified case passes in approximately 109.382 seconds with twenty-two skipped; no environmental root cause is established. The final complete retry freshly executes all six checks on exactly the same 339 source files. No failed/focused report is retained, and no production guard, assertion, cost/count limit or deadline changes. Additional scans and transcodes are paused during that retry.

再次同源完整运行出现测试Worker退出码3221226356（0xC0000374）、SQL初始化/迁移超时和未处理的pool错误，整次不通过。报告声明仍有测试运行；其中native-order文件虽然标为passed，23项实际全部pending，不能算通过。该部分报告的113 passed/1 failed/27 pending不计完整验收。独立真实字体/图像内核200次调用约10.6秒通过，未复现崩溃，不能认定Sharp、字体库或环境为根因，未据此修改应用或放宽超时。最终仍需同339源码全新完成六项；偶发崩溃的根因和生产稳定性未确认。[Windows状态码说明](https://learn.microsoft.com/en-us/troubleshoot/windows-server/performance/troubleshoot-application-service-crashing-behavior)。

Another unchanged-source full retry has a worker exit (3221226356 / 0xC0000374), SQL setup/migration timeouts and an unhandled pool error; the entire attempt fails. Its report warns tests are still running. A native-order file labeled passed contains 23 pending assertions and proves no pass. Reported 113 passed / 1 failed / 27 pending is partial and not accepted. Standalone actual pinned-font/raster stress passes 200 calls in about 10.6 seconds without reproducing the crash. No Sharp/font/library or environmental cause is established, and no speculative application change or wider timeout is applied. The final complete retry must freshly pass all six checks on the same 339 files. The intermittent native crash and production stability remain unverified.

历史最终声音复核的347项与听音基础342项原证据继续保留：[声音复核来源](audio-review-attempts.json)、[原334文件清单](audio-review-native-source.json)、[听音来源](listening-attempts.json)、[听音清单](listening-native-source.json)。本轮不复用其原生报告。声音正向用例刻意构造中文/语义PASS，实际音频仍是合成提示音，不证明听对中文、真实费用或授权；负向INSUFFICIENT、费用UNKNOWN和公开NATIVE_AUDIO_NOT_ADMITTED保持阻断。

Historical audio-review/listening proof bytes are retained. Positive listening semantics are deliberately fabricated over synthetic tones. They do not certify real speech, listening, billing, rights or production isolation. Negative/unknown results continue to block; all public sales remain disabled.

完整原生命令上限3600秒、单元360秒/单例30秒、既有原生120/180/240/300秒、hook60秒、RPC30秒、类型/服务端180秒及双小程序各600秒不变。实际标识检查覆盖固定区域每帧，最多3600帧/96MB，不等于完整模型输入容量通过。本轮没有浏览器操作或真实付费调用；未调度虚拟化环境。

官方“multi”指连续多镜，不增加必须多说话人的P0。真实官方12/15秒生成质量、跨镜商品/人物/音色一致性、中文/口型/模型/缓存账单/商业授权、完整输入容量、Codex受限运行/清理、支付/OSS、四组宿主真机、完整社区/售后、全变体基准及Plus仍待验。58需求/52P0、三路线、10风格/14变体保留；完整产品/生产/云端为false。

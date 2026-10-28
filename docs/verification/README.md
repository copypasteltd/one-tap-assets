# 验证与发布证据 / Verification and publication evidence

2026-10-29原生订单制作/后期源码：**54单元 / 334原生集成**通过，34个集成文件，原始原生报告跨度约1062.79秒。源码/测试/配置摘要324份，运行契约42份，资源4份。本轮原生订单制作/后期源码先全新执行完整原生集成；构建超时后，仅在源码/契约/资源完全未变时受限重试，保留本轮原始通过报告并重新执行其余五项。未沿用上一轮324项。

This native production/POST source first executes the complete native suite freshly. Following a build timeout, a strictly unchanged-source/contracts/resources retry retains this round's original native report and repeats the other five checks; the previous 324-case report is not reused. The manifest records original command/log/report hashes. Mode: `MINI_BUILD_RETRY_WITH_RETAINED_NATIVE_INTEGRATION`. Native PostgreSQL, FFmpeg and actual media are real; model/authorization/ASR/usage/payment/isolation responses in fixtures are synthetic.

| 编号 / No. | 检查 / Check | 结果 / Result | 证明范围 / Scope |
| --- | --- | --- | --- |
| 01 | 类型/单元/完整原生集成/服务端/双小程序 / Types, tests and builds | 六项PASS | [实现索引](../../assets/implementation/current.json)，不等于真机或生产准入 |
| 02 | 内部有声制作与后期 / Private native production and POST | 10项原生整链PASS | 两路线、实际整轨/ALAC、受控一次ASR、字幕/配乐、恢复/撤权；完整有声QC/交付未接入 |
| 03 | ASR声道副本 / ASR channel derivative | 4项单元PASS | 双边均值/固定舍入、PCM保持、历史拒绝、静音/相消拒绝，不是语义听音 |
| 04 | 声音合同/持久转写/独立内核 / Audio foundation | 23 / 17 / 15项原生PASS | 原合同/账务/许可、原任务回执、实际PCM/后期；真实授权/识别未准入 |
| 05 | 文档与契约 / Documentation and contracts | 4600项PASS | [摘要](contracts.json)，不代替功能执行 |
| 06 | 页面媒体 / UI media | 20文件原SHA | 10截图、概览、WebM/MP4/GIF和说明，[来源](../media/capture-manifest.json) |
| 07 | 声音媒体 / Audio media | 12文件原SHA | 四样式MP4/PNG、源MP4/合成WAV/概览/GIF，[来源](../media/native-audio/capture-manifest.json) |
| 08 | 发布/暂存 / Publication and staging | 独立核验 | [发布摘要](publication.json)、[暂存审计](repository-audit.json) |

本轮先修复四次局部失败；首次完整334项中324通过、10项样例失败，原因是媒体测试替身在渲染全部完成后才回复turn/start，超过原30秒应答时限，依赖同一成品的样例断言随后连锁失败。[原始日志SHA与修正范围](native-order-attempts.json)保留；这些失败不计入通过，也未与旧报告拼接。替身现先应答制作/后期，再异步通知完成，其他阶段仍覆盖提前完成通知；样例心跳停止并等待在途查询后再提交。生产协议时限、断言、原预算/截止均未放宽。上方完整报告在修正后的当前源码重新全量执行。既有Windows原生异常`0xC0000374`仍无根因结论，长期稳定性/生产准入继续待验。

The first full run has 324 passes and ten cascading sample failures, so it is retained as a failure. Its synthetic media fixture incorrectly deferred the start acknowledgment until rendering ended. Correcting the asynchronous acknowledgment/completion protocol and fixture heartbeat does not change production timeouts or business limits. A fresh complete run is required; focused retries and earlier partial reports are not combined into success.

原始日志、完整测试JSON、原生数据库、凭证和运行目录留在忽略的`runtime/`，公开摘要只保留命令结果、计数和SHA。每个付费意图、原截止及租约代次的业务约束没有因测试耗时放宽。

本次没有改前端、录制脚本或独立后期内核媒体；没有打开浏览器。沿用已核验的共享页面Vite回放、10页断言及原媒体SHA，不代表支付宝/抖音真机或Plus。声音演示仍是合成提示音/人工时间码，未改标为此次ASR、真实中文语音或官方人物样片。C基线25份及冻结归档原字节不变。

No browser was opened. Existing screenshots, recordings and GIFs retain their provenance. The new internal POST connection does not relabel previous audio fixtures as real ASR. Publication checks cover local links, declared media/source hashes, staged bytes, ignore rules and limited credential patterns; they do not certify physical erasure or exhaustive secret auditing.

公开有声报价/订单、独立听音/QC/双复核/有声交付、官方多人、真实服务/隔离/进程回收、真机、完整社区/售后、全变体基准及Plus仍未完成。全58项/52P0、三路线、10风格/14变体保留；全部方案禁售，完整产品/生产准入为false。

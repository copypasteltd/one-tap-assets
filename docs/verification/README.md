# 验证与发布证据 / Verification and publication evidence

2026-10-29声音文件QC源码：**58单元 / 336原生集成**通过，34个集成文件，完整原生报告跨度约1645.51秒。源码/测试/配置摘要327份，运行契约42份，资源4份。本轮声音文件QC源码先全新执行完整336项原生集成；小程序180秒超时后受限重试，仅验证脚本的小程序整套窗口改600秒；原生报告对应应用/测试/契约/资源完全未变，原验证脚本留存并逐字节核对构建窗口、注释与专项单元报告分类三处差异。保留本轮原始336项报告并重跑其余五项，未沿用上一轮334项。

This native file-QC source first freshly executes all 336 native cases. A restricted retry changes only the verifier’s mini-build command window from 180s to 600s; application, tests, contracts and resources match the original native run. The four-case scope flag also selects the correct unit report. The original verifier is retained and the exact timeout/comment/report-kind delta checked. This round’s native report is retained and the other five checks repeat; no prior-round 334-case report is reused. Mode: `MINI_BUILD_RETRY_WITH_RETAINED_NATIVE_INTEGRATION`. Native PostgreSQL, HTTPS/stdio/MCP, FFmpeg and actual media execute locally. Model, recognition, authorization, usage, payment and isolation responses are explicitly synthetic.

| 编号 / No. | 检查 / Check | 结果 / Result | 证明范围 / Scope |
| --- | --- | --- | --- |
| 01 | 类型/单元/完整原生集成/服务端/双小程序 / Types, tests and builds | 六项PASS | [实现索引](../../assets/implementation/current.json)，不等于真机或生产准入 |
| 02 | 有声制作/POST/文件QC / Private audio production/POST/file QC | 12项原生PASS | 实际整轨/ALAC/AAC、一次原ASR、混音重算、完整私有封存、篡改/撤权/最终阶段拒绝；外部响应合成 |
| 03 | 完整声音审查文件 / Complete stereo review files | 4项单元PASS | 规范WAV/原双声道PCM、非法长度、字幕句/词实际帧和时间轴拒绝 |
| 04 | 声音原有基础 / Original audio foundations | 23 / 17 / 15项原生及4项声道单元PASS | 原合同/费用/许可、持久ASR和独立后期内核；真实中文语音/听感未验 |
| 05 | 文档与契约 / Documentation and contracts | 4627项PASS | [摘要](contracts.json)，不代替功能执行 |
| 06 | 页面媒体 / UI media | 20文件原SHA | 10截图、概览、WebM/MP4/GIF和说明，[来源](../media/capture-manifest.json) |
| 07 | 声音媒体 / Audio media | 12文件原SHA | 四样式MP4/PNG、源MP4/合成WAV/概览/GIF，[来源](../media/native-audio/capture-manifest.json) |
| 08 | 发布/暂存 / Publication and staging | 独立核验 | [发布摘要](publication.json)、[暂存审计](repository-audit.json) |

声音文件技术验收后的包为SEALED/PENDING，没有独立听音或最终语义PASS。两条有声路线的最终事实/风格角色、报告身份和交付入口仍拒绝INDEPENDENT_AUDIO_REVIEW_REQUIRED；公开声音订单继续NATIVE_AUDIO_NOT_ADMITTED。实际字幕帧和ASR文字不能替代听音，信号比较不证明文字被说出、口型或商品事实正确。

Technical QC seals actual complete stereo and text evidence; it does not certify independent listening or semantic quality. Final fact/style roles, report identity and publication retain the listening guard. Public audible order creation remains closed.

本轮[验证来源摘要](native-qc-attempts.json)记录本轮原日志/报告SHA及完整报告来源。首次全量在代码复核发现新增撤权断言误用通用资源错误码后主动中止，未计为通过；修正为执行上下文先返回的AUDIO_LICENSE_UNAVAILABLE，专项确认后重新全量执行，生产门禁未改。随后完整执行达1800秒且原生订单两项失败，保留失败；两项单独复测通过，尚未稳定复现。另将所有角色替身改为先ACK后异步完成，专用协议测试继续覆盖提前完成，新增首失败停止及私有诊断；生产时限/断言不变。随后专项9通过/1超时/2未执行仍记失败，单独POST撤权故障用例改180秒以容纳原45秒回收，并加强实际撤权/ASR唯一/工具错误码检查。随后一次全量在类型检查阶段180秒超时，没有类型诊断且未进入单元/集成，原日志和失败索引保留；检查时主机CPU99%、可用内存约4.6GB，只清理本次遗留类型检查进程。再一次类型检查通过，但单元整套在180秒外层超时，仅44项有通过日志，不能算完整通过；进程启动/模块加载占主要耗时，将单元整套命令改360秒，单例30秒不变。再一次类型及58单元通过，原生逐镜完整往返通过，参考整片完整往返在120秒测试外层超时，10项未执行，未计完整通过；两项现包含实际制作/ASR/POST/QC/篡改和最终门禁检查，单独使用240秒测试窗口，其他工具/业务上限及断言不变。完整336项通过后的支付宝构建在CSS压缩阶段180秒超时，第一次源码不变的受限重试在模块加载阶段180秒超时，两次均无编译错误；原日志/索引保留。随后只将本轮验证/构建进程临时设为AboveNormal调度优先级，保持源码/契约/资源、构建180秒与断言不变，其他应用及系统持久配置不改。优先级重试也在CSS压缩阶段180秒超时，第三次失败继续保留；随后仅验证脚本将两个小程序整套窗口改600秒，原应用/测试/契约/资源不变，完整旧验证脚本留存且逐字节确认只有窗口表达式及一行注释变化，使用已有白名单重试规则。源集合因此存在显式验证脚本差异，不能声称所有源码摘要未变。六项命令随后通过；发布汇总发现专项单元标志误查集成报告，四项用例本身全部通过，修正为显式unit报告后按同一白名单重新验证。最终与原验证脚本的精确差异为窗口表达式、注释和报告类别三处；应用与测试及原生报告不变。上方完整结果独立记录，局部通过不拼接为全量。[上一轮失败记录](native-order-attempts.json)继续按历史保留，不与本轮局部结果拼接为通过。Windows原生异常0xC0000374的长期稳定性仍待验。整套串行原生命令上限2400秒、单元整套360秒/单例30秒，通常原生单例120秒、完整往返两项240秒、POST撤权一项180秒/hook60秒/RPC30秒/类型/服务端180秒、小程序整套600秒和业务预算/截止/配额保持原约束。

Prior failed attempts remain historical records. Partial/focused reports and prior-round suites are not combined into full acceptance. Raw logs, JSON, database, credentials and working media remain in ignored runtime; published records contain counts, commands and hashes only.

本轮未改前端、录制脚本或独立后期内核媒体，没有打开浏览器。原共享页面截图/录屏/GIF与声音演示保留来源和SHA；声音仍是合成提示音/人工时间码，不改标为此次ASR或真实中文样片。C设计25份及冻结归档原字节不变。

真实中文ASR/费用/授权、独立听音/语义/口型及最终有声双复核/交付、多人绑定、真实Codex/OS隔离/清理、宿主真机、完整社区/修改与全变体基准、Plus仍未完成。完整58项/52P0、三路线、10风格/14变体保留；全部方案禁售，完整产品/生产准入为false。

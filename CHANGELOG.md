# 更新记录 / Changelog

## 2026-10-29 · 原生声音合同与原订单费用 / Native audio contract and original-order accounting

- 冻结原人物/声音/视频模型组合、授权版本和许可全文摘要、字幕/字体/配乐/压低/循环、原声单位增益、一次整轨ASR及全部声音成本，并绑定订单执行快照。Added a private frozen audio contract and snapshot digest; this does not admit public audible quotes.
- 原总预算覆盖ASR上界和一次性预付许可分摊，保留售后额度；换源/并发/租约恢复不能补充ASR次数，原任务及UNKNOWN费用继续恢复。Added once-only internal prepaid allocations and complete-track ASR limits within the original budget; no external license purchase is claimed.
- 付款及恢复复查许可，许可失效后的已验证付款保留原事实并创建唯一退款意图；迁移023保护许可/人物证据、固定分摊、退役/撤销和ASR合同摘要。Added revoked-rights payment handling and immutable native-audio registrations.
- 新增23项原生PG/实际AAC-PCM/私有文件专项，授权、识别/用量/HTTPS和付款事实为合成；同步双语README、使用/开发约束和实现证据。Added twenty-three native fixtures and bilingual implementation documentation; final full-suite results are recorded in the implementation manifest.
- 首次全量回归定位并修正脱敏订单迟到付款的合同访问顺序，补齐旧支付夹具的原报价SHA；900秒整套超时记录保留，整套命令上限按实测调整为1200秒，单例/断言与业务预算/截止不变，重新全量验证。Preserved the failed first run, corrected payment compatibility and allowed the serial native suite more command-level time without relaxing assertions or business limits.
- 后续324项断言通过但心跳夹具出现未处理拒绝，仍按失败留存；受限修改及媒体夹具串行续期、传播失败，提交前停止并等待在途查询；媒体诊断保留原错误码，重新完整验证。A later all-assertion pass is not accepted because Vitest detected an unhandled fixture heartbeat; serial fixture heartbeats are stopped and drained before commit, and errors remain failures.
- 再次全量遇到媒体测试Worker原生异常退出`0xC0000374`，313/324项的不完整报告留存为失败；单独复测后全新重跑，不拼接成通过结果，长期原生稳定性继续待验。A native worker crash remains a recorded failed attempt; partial and focused reports are not combined into full-suite acceptance.
- 最终本轮完整原生集成324/324、单元50/50通过；支付宝构建180秒超时后，按源码/契约/资源完全未变的受限重试保留本轮原始集成报告，其他五项重新执行并全部通过。发布索引记录来源，不沿用上一轮301项。The current source passes 324 native integration and 50 unit cases; after an Alipay build timeout, a strictly unchanged-source retry retains this round's original integration report and passes the other five checks.
- 本轮服务端改动沿用已核验截图/录屏/GIF原SHA，未打开浏览器；C25份设计与冻结归档不变。Existing UI/audio media retain original hashes and provenance.
- 多人逐镜绑定、受控有声订单工具、独立听音/QC/交付与真实授权/服务未准入；全部禁售和完整产品IN_PROGRESS保留。Multi-presenter routing, audio orders and production remain incomplete.

## 2026-10-29 · 异步音频转写与原任务恢复 / Durable asynchronous transcription

- 新增百炼Qwen3异步文件转写适配、原任务查询、受限HTTPS结果下载和实际字级时间码解析；完整原文/标点/空格保留，长句只按真实词边界拆分，不均分或捏造时间码。Added a bounded asynchronous ASR adapter with original-task recovery and source-preserving word timestamps.
- 原订单POST读取登记视频、实际解码PCM并派生私有单声道WAV；不同左右声道直接拒绝。原视频/PCM/WAV/合同/原截止均绑定。Added native private audio preparation without silently dropping a stereo channel.
- 复用原订单预算及provider_submissions，迁移022增加ASR分流，保留不可变发送标记/任务/请求及追加式原回执；提交/音频写入/结果写入ACK丢失不重购，未知费用不猜测免费。Reused the original ledger and protected receipts; uncertain operations cannot buy again.
- 独立媒体维护器只恢复已存ASR回执；私有单对象OSS签名URL、绝对截止/取消与发送/完成撤权检查已有源码。Added stored-receipt reconciliation and bounded private-object access; external privacy remains unverified.
- 新增17项原生PG/FFmpeg/AAC/PCM/私有文件专项，供应商转写/用量与传输为合成；双语README、配置、开发边界和证据同步。Added seventeen native fixtures with explicit synthetic ASR responses and updated bilingual documentation.
- 当前50单元/301全量原生集成、服务端与双小程序构建通过；首次支付宝构建启动180秒超时留存，受限重试核对全部源码/契约/资源未变，保留本轮原始301项报告并重跑其他五项，未沿用旧284项。Current validation passes with explicit provenance for a same-source mini-build retry; the new native suite is executed freshly.
- 未接入正式有声合同、MCP订单工具、独立听音/QC与原子交付，真实ASR/OSS/中文识别质量未验，全部禁售不变。No audio-order or production admission; the full product remains in progress.

## 2026-10-29 · 原生声音与字幕后期内核 / Native audio and caption kernel

- 新增实际视频原声提取、48kHz双声道PCM摘要/20ms信号证据、唯一音轨/完整解码/时长/削波门禁；信号不冒称人声或中文识别。Added bounded native decoding and physical audio evidence, without treating signal presence as speech recognition.
- 新增绑定实际文件/PCM/证据的转写时间码及四种中文字幕烧录，karaoke要求词级实际时间码，固定字体/AI标识，拒绝错绑、静音区、重叠、字形缺失与ASS注入。Added actual-audio caption binding and four burned-in styles with explicit word timing and protected rendering inputs.
- 许可配乐按冻结音量/循环策略解码，原声保持单位增益，仅背景音按原PCM包络压低；精确采样相加、削波拒绝、实际AAC后波形/相关性/SNR、前后许可撤销检查及原期限/取消清理。Added sample-preserving native mixing, music-only ducking, encoded waveform verification, rights checks and deadline/cancellation handling.
- 15项原生数据库/实际PNG-MP4-AAC-PCM专项通过；使用自绘商品、合成正弦音与人工时间码，不是ASR或人物讲解证据。Added fifteen native fixtures with actual media and explicit synthetic tones/manual timestamps.
- 新增`docs:audio`、四种实际MP4/取帧、GIF及独立来源/SHA清单；同步中英README和开发说明，发布核验检查新增媒体及源码绑定。Added reproducible native media evidence and bilingual repository documentation.
- 未注册有声订单工具，真实ASR/费用恢复、声音/人物准入、Codex听音、封存QC和有声交付仍待完成；四生成式变体、完整产品与生产准入均未通过，官方全部禁售。Audio orders and production speech admission remain disabled; the complete product remains in progress.

记录可核验的最终行为及已知范围；历史设计文档保留原版，最新状态见[状态指南](docs/guides/STATUS.md)。Record actual behavior and limits; historical design records remain preserved.

## 2026-10-28 · 生成式无声整包编排 / Silent generated pack orchestration

- 两条生成式路线接入参考独立核验、唯一制作角色、实际生成PNG/MP4整包、显式后期、专属QC、全包最终双复核与事务交付。Connected both silent generated routes through complete native-media pack orchestration and independent final reviews.
- 新增受控`render_generated_pack`，冻结计划驱动请求；每镜视频按原帧数/顺序处理，整片保留原任务，拒绝原图动画替代。The bounded pack tool uses frozen requests and actual provider video bytes rather than substituting animated originals.
- 参考与最终事实共享原角色额度，租约接管复用原完成角色/意图/费用；新购买前检查原QC规则、次数、视觉与视频规格。Reference and final facts reviews share sold quotas; takeover preserves original identities, costs and deadlines.
- 原生成来源和参考摘要随产物进入后期，QC和发布事务重验实际字节/撤权，撤权导致整包发布回滚。Source/approval bindings survive post and are checked through atomic delivery.
- 修正供应商购买回执/原状态查询丢失时的调度：持久记录原错误，未决购买保持原预留并等待恢复，不直接作为制作失败。Persisted purchase/query failures defer original work rather than retiring the stage or buying again.
- 新增7项原生数据库/媒体/HTTPS/MCP专项，明确合成模型/用量/隔离边界；结果以[实现索引](assets/implementation/current.json)为准。Added seven native execution/recovery/rejection cases with explicit synthetic external evidence.
- 同步中英README、架构/状态/专项与实现证据；页面无变更，沿用实际截图/录屏/GIF及冻结C原件。Updated bilingual documentation and evidence while retaining applicable UI captures and frozen design assets.
- 修正本机Taro并行CSS压缩停滞，改同进程执行相同压缩算法。新增受摘要约束的`--retry-mini-builds`：仅限定构建/核验器变更可留用完整集成报告，业务文件变化会拒绝；类型/单元/服务端/双端构建重新执行。Fixed a native CSS-worker stall without disabling minification; build-only retry preserves verified native integration with explicit provenance and rejects changed application inputs.

官方生成式有声变体、真实Codex/供应商/隔离、生成式社区样例/售后、全量14变体基准、真机和生产准入仍未完成，全部方案禁售。[编排细则](docs/实施/生成式无声整包与阶段编排-v1.0.md)保留限制。Official audio variants, real operation, generated samples/revisions, full benchmarks and production admission remain incomplete; sales stay disabled.

## 2026-10-28 · 参考帧购买门禁与受控生成工具 / Reference-gated generation tools

- 修复参考整片可绕过身份核验并直接使用原图购买视频的缺口；逐镜与整片均绑定原独立报告和对应生成PNG，预留/发送/恢复/媒体提交重验。Fixed an unreviewed reference-film purchase path; both routes now bind the original released identity review and generated PNGs to immutable video intents.
- 新增整片`reference:film`、冻结报告/全帧SHA凭证，沿用迁移021保护；整片预算包含一次参考生成。Added film-reference generation, immutable approval/frame bindings and the missing reference-image cost bound, without a new migration.
- 注册生成参考、提交视频、查询原任务3个订单MCP。平台恢复冻结商品/风格/模型/费率/规格，拒绝任意提示词/原图替换/比例暗换；POST只读原制作完成结果。Registered three scoped tools with platform-derived inputs and read-only completed POST inputs.
- 原网关专项扩至35项，新增6项实际stdio/HTTPS/MCP专项，15项参考核验继续覆盖。保留先红后绿回归摘要。Expanded native purchase/recovery coverage; synthetic model/usage/isolation remains explicit.
- 同阶段同代次同角色唯一约束未放宽。MCP视频协议通过实际租约过期/接管恢复，原次数/费用不重置；完整阶段间编排仍待完成。Same-generation role uniqueness and shared costs/call limits remain enforced; protocol continuation tests use real lease takeover rather than an index bypass.
- 中英README、架构/状态与专项同步；小程序页面未改动，已有实际截图/WebM/MP4/GIF与C冻结稿保持原字节。Updated bilingual documentation; existing UI captures and frozen C files remain byte-identical.

本轮类型检查、50单元/262原生集成、服务端及双小程序构建全部通过，295个源码/测试/配置文件摘要已刷新。首次全量运行触及旧480秒整套超时，保留单项断言/时限后将整套上限调整为720秒并完整重跑通过；原失败日志留存本地。Type checking, 50 unit/262 integration tests and all three builds passed; the 295-file source manifest was refreshed. A first suite-level timeout was preserved before rerunning with a larger suite ceiling, without changing individual test assertions or timeouts.

当前验证数量以[实现索引](assets/implementation/current.json)为准。完整生成式编排/整包/后期/QC/最终双复核/交付、原生有声和真实Codex/模型/隔离/真机准入仍未完成，所有预设禁售。Exact executed test/build results live in the manifest. Complete generated pipelines and real production admission remain incomplete; sales stay disabled.

细则 / Details：[购买门禁与MCP](docs/实施/生成式购买门禁与MCP工具接入-v1.0.md)。

## 2026-10-28 · 0.1.0 · 首次仓库整理 / Initial repository publication

### 已加入 / Added

- 整理原生API、Worker、双小程序、领域/接口契约、Skill、设计与研究资料；21迁移、77业务/26管理契约及17共享页面。Organized native backend, mini-programs, contracts, skills, preserved design and attributed research.
- 提供完整中文/英文README、双语启动/架构/状态/演示指南、文档目录、来源/许可说明和公开核验摘要。Added bilingual READMEs and operational documentation, attribution and public evidence.
- 浏览器回放复用实际共享页面，采用合成Transport和原创示例插画；10页真实截图、约14.56秒WebM/MP4、GIF、总览、媒体SHA清单，录制后关闭浏览器。Added actual browser captures and reproducible local recording without real payments/models/customer media.
- 生成供应商基础已有图片/异步视频、冻结模型/费率、原意图/ACK/查询恢复、原订单预算与实际PNG/MP4检查；29项专项使用合成供应商。Retained durable generation integration with explicit provider fixtures.
- 独立参考身份服务恢复原图/生成帧，逐帧逐锚点检查、原检查点复用、独立角色与释放阻断；15项原生集成。Added reference identity service core; not yet connected to video purchasing.
- 明确后续每轮同步代码、双语说明、适用媒体和本更新记录，正常推送指定远端并核对提交。Established ongoing documentation/media synchronization and verified normal pushes.

### 修正 / Fixed

- 移除指向不存在Plus配置的`dev:web`/`build:web`，总构建采用实际`build:preview`；`test:ui`连接实际回放断言/录制脚本。Removed broken web commands and wired real preview build/UI capture commands.
- Git排除私有运行数据、环境凭证和历史临时output；保留C原稿/归档、字体许可和研究来源；关闭自动换行重写以保全SHA证据。Excluded runtime/private output and preserved exact-byte provenance.
- 修复历史文档的本地缓存/上级目录链接；五种设计选型和5张上游研究缩略图整理至带来源的正式assets，源码研究链接固定上游提交。Repaired publication links and curated attributed design/research assets without changing the frozen C baseline.

### 验证与边界 / Validation and limits

类型检查、**50单元 / 250原生集成**、服务端及支付宝/抖音构建通过；浏览器回放构建与10页捕获通过。真实PG/媒体和合成模型/支付/宿主/隔离的区别见[实现索引](assets/implementation/current.json)。发布核验和文档结果见[公开验证](docs/verification/README.md)。

Type checking, **50 unit / 250 native integration tests**, server and both mini-program builds passed. Browser replay build and ten-screen capture passed. Documentation/publication checks are recorded separately. External model/payment/host/isolation responses remain synthetic.

完整生成式两路线、有声、真实Codex/受限身份/进程清理、云端与真机准入、完整社区/售后、Plus/管理Web及58项完整验收仍未完成，所有官方预设禁售。Full generative/audio operation, real Codex/isolation/cleanup, cloud/device admission, complete community/aftercare, Plus/management UI and full requirement acceptance remain incomplete; all official presets remain unavailable for sale.

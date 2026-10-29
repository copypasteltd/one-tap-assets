# 技术结构与执行逻辑 / Architecture and execution

最新[原生声音最终双复核与事务交付](../实施/原生声音最终双复核与事务交付-v1.0.md)把完整双声道/全画面、原请求/响应/费用、两个独立角色和推理/工具/报告证据连接到有声事务发布。FACTS 唯一平台准备，STYLE 只读；每个消费边界重验原件、费用、授权和原截止。正向语义是刻意构造的控制响应，不代表真实模型听对。Public ordering/sales, real Chinese listening/billing/rights, native isolation and device admission remain closed. 以下历史“未接最终阶段”按本条区分内部接通与生产准入。

2026-10-29增补：[异步转写与原任务回执](../实施/异步音频转写与原任务回执-v1.0.md)已实现内部POST服务：实际视频/PCM→私有单声道WAV→原任务/原费用/回执恢复→实际字级转写。`provider_submissions`增加ASR类型且与Ark分流，媒体维护器只核对已存回执。17项原生专项使用合成供应商，不代表真实中文ASR/OSS、独立听音或正式有声交付已准入。后文历史“持久ASR待实现”按本条区分内部实现与真实服务准入；原有声销售门禁保留。

The internal POST transcription service reuses the original ledger and private-object scope. Its seventeen native fixtures use synthetic provider responses. Frozen audio contracts and scoped private production/POST tools are now connected as described above; private final review/publication is connected; real ASR/listening/billing/storage and production admission remain incomplete; technical file QC is connected.

[中文README](../../README.md) · [English README](../../README.en.md) · [状态 / Status](STATUS.md)

## 入口与模块 / Surfaces and modules

主要产品载体为支付宝/抖音小程序。`src/shared/ui`包含17个共享页面，`platform`定义照片、宿主登录、支付、下载与相册端口；两个小程序壳提供各自宿主适配。`src/preview`只将这些页面适配到React DOM，并注入合成Transport；不连接真实服务，也不是Plus。Plus与管理Web界面仍待开发。

The primary surfaces are Alipay/Douyin mini-programs. Seventeen shared screens depend on platform ports rather than directly coupling every page to one host. The browser adapter reuses those screens with synthetic transport; it is not the Plus application. Plus and management web UI remain future work.

`src/api`是Fastify模块化API，负责鉴权、租户隔离、商品/照片、方案、报价/订单、支付恢复、社区、交付和管理路由。`src/worker`是独立原生进程，执行数据库持久阶段、outbox与受控工具。PostgreSQL同时承载业务事实、租约、队列、费用意图和不可变回执，不额外引入Redis。私有媒体使用登记存储端口，开发可用本地受限目录，生产OSS仍需准入。

The Fastify API owns domain boundaries and tenant-scoped operations. A separate native worker executes durable stages, outbox events and controlled tools. PostgreSQL stores business state, leases, queues, cost intents and receipts. There is no Redis or local virtualization requirement. Private storage has a local development implementation and a separately admitted production OSS boundary.

## 数据流与冻结 / Data flow and frozen contracts

| 阶段 / Phase | 输入、输出和约束 / Inputs, outputs and boundaries |
| --- | --- |
| Photos → `ANALYZE` | 3–5张原图版本；EXIF移除/字节摘要；多模态档案、证据、unknown和商品锁 / Versioned originals, normalized bytes, evidence and identity lock |
| `PLAN` | 已登记风格/变体/SkillBundle与商品档案；输出结构化镜头、文案和素材计划 / Registered bundle + product evidence → structured pack plan |
| Quote / Order | 冻结输入版本、路线、模型/费率、素材清单、声音、预算、截止与售后额度 / Freeze exact specification, resources, cost and entitlement |
| `PRODUCTION` → `POST` | 受控MCP与实际媒体/生成供应商；工具输入输出、资源与费用可追踪 / Scoped tools, actual media and durable original provider submissions |
| `QC` | 实际文件、采样帧、字体、规格/数量与封存文本 / Actual-file validation and a sealed packet |
| Facts + Style | 独立新角色、真实图片载荷、不可变报告与运行证据 / Fresh independent roles, actual image payloads, immutable reports |
| `DELIVER` | 数据库事务重新核对后发布manifest；下载验证实际SHA / Revalidate transactionally and publish a hash-bound manifest |
| Release / Retention | 撤权、独立实例回收、文件到期/删除与签名日志 / Revoke capabilities, reap instances, enforce retention and replay deletion history |

内容角色不通过任意Shell直接决定交付。工具范围、单次/整单预算、次数、期限和租户由服务端验证；图片/模型输出中的指令不成为工具授权。SkillBundle版本和摘要随冻结输入保留。原图无声路径已有集成证据，生成式和真实运行边界见[状态](STATUS.md)。

The content role cannot publish by arbitrary shell execution. Server-side scopes, tenant checks, cost/call limits and deadlines authorize tools; instructions inside images/model output do not. Bundle versions/hashes are frozen with the inputs. Each route has separate fixture coverage; synthetic roles cannot certify real operation or official audio variants.

## 付费副作用与故障恢复 / Paid effects and recovery

每个付费动作先持久化唯一意图、原订单和预算预留，再向供应商提交。ACK、任务ID、查询回执和实际对象分别保存；未知结果保持`UNKNOWN`并查询原任务，不能因重试或换Worker重新购买。已发生的已知费用独立结算，即使返回文件错误或业务取消也不能抹掉。超时不自动重置预算和原截止。

Persist a unique intent and reserve the original order’s budget before contacting a paid provider. Keep the ACK, immutable task ID, query receipts and actual media separately. Unknown results recover the original task without repurchasing. Known incurred cost remains accountable even if media is invalid or the business scope is cancelled. Retries do not reset budgets or deadlines.

任务租约带代次与心跳，原子领取/接管防止两个Worker重复履约，旧代次不能完成新阶段。费用、支付、退款、制作、交付为不同状态机。幂等键绑定用户、端点和请求摘要，前端防连点不能代替持久幂等。本人恢复查询和逐文件相册journal解决回调/下载/宿主回执丢失。

Lease generations and heartbeats fence stale workers. Financial, payment, refund, production and delivery state machines remain distinct. Durable idempotency binds owner, endpoint and request hash. User-scoped recovery and per-file album journals handle lost replies; client button disabling is not transaction safety.

## 生成参考身份核验 / Reference identity

`generation/reference-*`恢复真实原图、生成PNG、商品锚点与冻结合同。独立REVIEW_FACTS只获两个限定工具，报告逐帧/逐锚点引用原图证据，且需实例已释放。两路线视频意图在不可变`prepared`中绑定完整报告和实际生成帧，预留/发送/恢复/媒体提交重新验证。3个订单MCP继续提供受控原节点操作；制作阶段新增`render_generated_pack`恢复实际生成图/视频并组装整包，之后显式POST、专属无声QC、最终全包双复核和事务交付。[购买门禁](../实施/生成式购买门禁与MCP工具接入-v1.0.md)与[完整无声编排](../实施/生成式无声整包与阶段编排-v1.0.md)分别记录边界。

平台按冻结Codex计划生成参考，独立核验结束释放后才启动唯一制作角色，避免串行工具消费者嵌套等待角色。参考与最终事实角色共享原两轮额度，五次推理和十二次工具调用必须在原单预算内。生成来源与参考报告摘要随产物继承，在后期、QC、发布预检查与事务内核对实际字节/撤权；接管复用原意图与已完成角色。专项使用原生数据库/媒体/协议与合成模型/用量/隔离；有声、官方全变体及真实服务未准入。

The platform derives references from the frozen Codex plan, releases their independent reviewer and then starts the unique production role. The bounded pack tool assembles actual generated images/clips, followed by explicit post, silent-route QC, fresh whole-pack facts/style reviews and atomic delivery. Reference/final facts reviews share the sold quota; takeover reuses original intents and completed roles. Source and approval hashes, stored bytes and revocation are rechecked through publication, including its transaction. Native protocol/media fixtures do not certify real models, OS isolation, audio or every official variant.

The service reviews actual originals/generated PNGs against every identity anchor and requires instance release. Both routes bind the original report and generated frames to immutable video intents and revalidate them before paid effects and media completion. Scoped MCP handlers derive frozen inputs; POST reads completed original outputs only. The 15 reference, 35 gateway and six MCP cases use native media/database and synthetic inference/isolation. Same-stage same-generation role uniqueness, shared cost/call limits and original deadlines remain enforced; protocol continuation tests use actual lease takeover. Both silent generated routes and private native-audio final delivery are now connected as described above; real-service and full-variant admission remain incomplete.

## 实例与隐私 / Instances and privacy

每个运行有独立目录/工具能力/推理范围和原租约绑定；独立回收器保留不可变释放尝试并接管孤儿。当前真实受限OS身份启动器、完整进程树清理和生产隔离未通过。生产要求服务专用凭证，不借用个人登录态；本地模拟释放不等于真实隔离证明。

Each run binds its directory, tool/inference capabilities and original lease. A separate reaper records immutable attempts and handles orphans. Real restricted OS identity, full process-tree termination and production isolation remain unverified; fixture cleanup cannot certify them.

私有对象先登记意图，未知写入核对原字节后才删除；未决费用/工具/写入继续阻断。主库私有载荷有受控脱敏与摘要回执；独立签名日志记录冻结删除集合，旧备份恢复必须先阻断再重放。主库逻辑脱敏、底层页/WAL、异地备份、供应商副本、OSS版本删除与财务恢复是不同边界，目前完整隐私准入仍未完成。

Register private writes before I/O; reconcile original unknown bytes before erasure and retain unresolved billing/tool/write blockers. Controlled database redaction and signed deletion replay do not establish physical erasure across WAL, backups, replicas, providers or real OSS. Privacy restore and financial recovery have separate gates and remain incomplete for production.

## 契约和设计 / Contracts and design

业务77/管理26接口、229业务schema及71逻辑实体以`assets/development/v1.1/`及生成源为准；当前数据库25个迁移。修改契约同步生成源、产物、客户端、迁移与恢复测试，不能破坏已售快照。C设计25个基线文件与原始归档保持原字节，界面从tokens派生。[开发规范](../开发/README.md)有完整细则。

The versioned development assets define 77 business/26 management endpoints, 229 business schemas and 71 logical entities; the current database has 25 migrations. Changes update generators, generated contracts, callers, migrations and recovery tests while retaining sold snapshots. The 25-file C baseline and archive remain byte-preserved; implementation uses its tokens.

## 原生声音内核 / Native audio kernel

`src/worker/media/native-audio.ts`提取有界实际PCM与信号证据；`native-captions.ts`检查转写来源/时间码并编译四字幕；`native-audio-post.ts`核对许可、保持原声单位增益、仅压低配乐、实际字幕烧录和编码后波形。`native-order-pipeline.ts`通过受控订单MCP包装制作、原整轨ASR和POST，完整PCM用ALAC无损中间片保持，最终输出AAC。原合同冻结人物/声音/视频模型、许可、一次ASR、字幕/配乐及原预算；迁移022/023保护原请求和授权记录。

`review/native-audio.ts`独立重建混音并比较实际AAC，保存完整原声/成片双声道WAV、精确原ASR JSON、ASS和技术JSON；`review/qc.ts`补字幕句词时点实际帧，封存时复查来源/授权/配乐/私有写入/实际字节。迁移024只扩展已有不可变证据kind。全部材料私有、只读原成功转写，不新增识别或推理购买。技术QC包仍为SEALED/PENDING；独立听音与最终事实/风格报告已按上述专项连接；有声发布重新检查原听音、实际媒体、原费用和授权，不能由 ASR 或图像报告替代。公开声音订单继续禁售。

The native media kernel and scoped ORDER pipeline now connect full-track production/ASR/POST and technical QC. Actual PCM is preserved in an ALAC intermediate before AAC POST. QC reconstructs the frozen mix and seals complete source/final stereo WAV, original settled transcript, ASS and technical JSON, plus actual caption-timecode frames. Commit revalidates ownership, original files, licenses, music and evidence bytes. Migration024 extends existing immutable evidence kinds. No second ASR or inference is purchased. Private original listening, final review and atomic delivery are connected; official multi-shot consistency, real listening/providers/billing and production admission remain incomplete; public native speech admission stays closed.

## 可见AI标识 / Visible AI disclosure

平台在既有私有报价合同冻结标识策略，生成式制作/POST实际绘制，完整PNG字形及不透明Alpha/所有视频帧检查并绑定产物清单。QC封存策略与真实文件证明，最终双角色及事务交付消费同一原包；原图与旧媒体字节保留。[完整约束](../实施/AI可见标识与逐帧文件验收-v1.0.md)。The original private contract binds platform-owned disclosure; real glyph/all-frame checks precede immutable review and publication. Missing historical policies block without new model purchases.

## 完整文字与购买前排版 / Complete text and pre-purchase layout

实际短片字幕的 intent 与标题、配套文案共用原商品断言门禁。固定字体按真实字形测宽、按 grapheme 完整换行，验证全部后缀/缺字及标题、章节、页脚和 AI 标识的安全区；容量不足明确拒绝，不截断或缩字。相同排版器在规划、报价、制作角色/参考购买前及媒体工具内预检；社区风格来自原冻结映射或真实保存的选择，历史选择缺失返回 `PLAN_INPUT_CHANGED`。

制作器版本参与媒体输入摘要；同一阶段/phase 的原操作若输入不同，返回 `MEDIA_INPUT_CHANGED`，不替换操作或再次购买。这些门禁与完整自动素材修复、历史迁移和真实语义验收分别跟踪。[实现与验证细则](../实施/完整展示文字与购买前排版校验-v1.0.md)。

Visible shot intent shares the existing product-claim gate. The pinned font is measured using actual glyphs, preserving complete graphemes and suffixes within text/disclosure safe areas. Overflow is rejected. The same renderer preflights content, quotes and execution before new production/reference purchases. Missing original selections and changed original media inputs fail explicitly; neither guard implements automatic media repair or historical migration.

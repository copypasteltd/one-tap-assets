# 技术结构与执行逻辑 / Architecture and execution

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

The content role cannot publish by arbitrary shell execution. Server-side scopes, tenant checks, cost/call limits and deadlines authorize tools; instructions inside images/model output do not. Bundle versions/hashes are frozen with the inputs. Silent photo-layout coverage must not be generalized to generative routes or real operation.

## 付费副作用与故障恢复 / Paid effects and recovery

每个付费动作先持久化唯一意图、原订单和预算预留，再向供应商提交。ACK、任务ID、查询回执和实际对象分别保存；未知结果保持`UNKNOWN`并查询原任务，不能因重试或换Worker重新购买。已发生的已知费用独立结算，即使返回文件错误或业务取消也不能抹掉。超时不自动重置预算和原截止。

Persist a unique intent and reserve the original order’s budget before contacting a paid provider. Keep the ACK, immutable task ID, query receipts and actual media separately. Unknown results recover the original task without repurchasing. Known incurred cost remains accountable even if media is invalid or the business scope is cancelled. Retries do not reset budgets or deadlines.

任务租约带代次与心跳，原子领取/接管防止两个Worker重复履约，旧代次不能完成新阶段。费用、支付、退款、制作、交付为不同状态机。幂等键绑定用户、端点和请求摘要，前端防连点不能代替持久幂等。本人恢复查询和逐文件相册journal解决回调/下载/宿主回执丢失。

Lease generations and heartbeats fence stale workers. Financial, payment, refund, production and delivery state machines remain distinct. Durable idempotency binds owner, endpoint and request hash. User-scoped recovery and per-file album journals handle lost replies; client button disabling is not transaction safety.

## 生成参考身份核验 / Reference identity

`generation/reference-*`恢复真实原图、生成PNG、商品锚点与冻结合同。独立REVIEW_FACTS只获两个限定工具，报告逐帧/逐锚点引用原图证据，且需实例已释放。15项原生集成使用合成模型/隔离；视频购买门禁与生成生产工具尚未连接，因此不能宣称生成路线可交付。[专项说明](../实施/参考帧独立身份核验-v1.0.md)。

The service reviews actual originals/generated PNGs against every identity anchor and requires instance release. Its 15 native integration cases use synthetic model/isolation responses. It is not yet connected to video purchasing or production tools, so it does not authorize complete generative delivery.

## 实例与隐私 / Instances and privacy

每个运行有独立目录/工具能力/推理范围和原租约绑定；独立回收器保留不可变释放尝试并接管孤儿。当前真实受限OS身份启动器、完整进程树清理和生产隔离未通过。生产要求服务专用凭证，不借用个人登录态；本地模拟释放不等于真实隔离证明。

Each run binds its directory, tool/inference capabilities and original lease. A separate reaper records immutable attempts and handles orphans. Real restricted OS identity, full process-tree termination and production isolation remain unverified; fixture cleanup cannot certify them.

私有对象先登记意图，未知写入核对原字节后才删除；未决费用/工具/写入继续阻断。主库私有载荷有受控脱敏与摘要回执；独立签名日志记录冻结删除集合，旧备份恢复必须先阻断再重放。主库逻辑脱敏、底层页/WAL、异地备份、供应商副本、OSS版本删除与财务恢复是不同边界，目前完整隐私准入仍未完成。

Register private writes before I/O; reconcile original unknown bytes before erasure and retain unresolved billing/tool/write blockers. Controlled database redaction and signed deletion replay do not establish physical erasure across WAL, backups, replicas, providers or real OSS. Privacy restore and financial recovery have separate gates and remain incomplete for production.

## 契约和设计 / Contracts and design

业务77/管理26接口、229业务schema及71逻辑实体以`assets/development/v1.1/`及生成源为准；当前数据库21个迁移。修改契约同步生成源、产物、客户端、迁移与恢复测试，不能破坏已售快照。C设计25个基线文件与原始归档保持原字节，界面从tokens派生。[开发规范](../开发/README.md)有完整细则。

The versioned development assets define 77 business/26 management endpoints, 229 business schemas and 71 logical entities; the current database has 21 migrations. Changes update generators, generated contracts, callers, migrations and recovery tests while retaining sold snapshots. The 25-file C baseline and archive remain byte-preserved; implementation uses its tokens.

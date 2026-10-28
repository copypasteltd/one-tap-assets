# 更新记录 / Changelog

记录可核验的最终行为及已知范围；历史设计文档保留原版，最新状态见[状态指南](docs/guides/STATUS.md)。Record actual behavior and limits; historical design records remain preserved.

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

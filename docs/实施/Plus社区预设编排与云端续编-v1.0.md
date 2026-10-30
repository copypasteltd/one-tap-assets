# Plus社区预设编排与云端续编 v1.0

2026-10-31。收口P01-F18中的复杂预设创作，并复用P01-F09/F17现有社区草稿、样例、授权与发布流程。移动端仍是拍照、识别、选方案、确认付款和领取的主要载体。Plus适合在较大画布上组合、比较和续编方案。

## 1. 用户操作

1. 在Plus首页勾选“允许编排社区预设草稿”，生成接续码。
2. 原账号小程序进入“账户与隐私 → 接续到电脑 Plus”，核对接续码、预设编排权限，选择当前小程序作品并明确允许。
3. 在电脑打开“预设编排”。填写作者自己的方案名称、说明和标签；这是社区作者功能，不增加普通买家拍商品时的填表要求。
4. 选择唯一主风格，再组合叙事顺序、节奏、镜头、字幕样式和可选路线限定。最多10种执行规格、30项平台资源。侧栏显示组合清单和兼容性问题。
5. 保存云端草稿。原账号手机“社区 → 我的草稿”和电脑草稿列表读取同一记录；原手机创建或依法派生的草稿也可继续编辑，派生来源保持固定。
6. 样例制作、照片使用/公开授权、许可确认和发布申请回原账号小程序继续。保存和编排不代表发布、准入、启售或产生素材。

## 2. 权限和数据

| 编号 | 规则 | 实现 |
| --- | --- | --- |
| R01 | 单独申请、明确原生确认 | `prepare_community_drafts` → `allow_community_drafts` → `can_edit_community_drafts`；沿用5分钟码与1小时独立会话 |
| R02 | 老连接不扩权 | 040迁移默认false；数据库触发器固定链接和会话的作者权限，改权限须新建接续 |
| R03 | 共享作品不授予作者身份 | 作者连接必须`account_binding_id IS NULL`且来源身份等于批准身份；选择已绑定来源直接拒绝 |
| R04 | 最小接口范围 | 仅3个组件/规格/资源目录与4个本人草稿接口：创建、分页、读取、修订 |
| R05 | 原账号所有权 | 复用原`preset_drafts`租户/作者边界；不复制账户、订单或社区身份 |
| R06 | 每次请求重查 | 事务内锁、有效期和撤销检查；通用幂等命中也不能绕过当前会话权限 |
| R07 | 原发布链路保留 | Plus不获样例、授权、许可确认、派生、发布、财务或绑定操作权 |

不新增业务接口或逻辑实体。继续115业务/38管理接口、328schema/84实体，迁移增至40。API/管理OpenAPI兼容增加可选字段，旧客户端仍可提交原请求。原39迁移、方案C、旧媒体、旧版本契约保留；本次被更新的当前v1.1文件原字节另存于[基线](../verification/plus-preset-contract-baseline-e9bcc00/index.json)。

## 3. 编排、冲突和恢复

- 使用平台目录中的组件版本，服务端重新检查唯一主风格、同组单选、执行路线和全部规格兼容、资源有效性。用户的展示文字不能成为Skill、工具或执行指令。
- 名称最多100字，说明2000字；标签1至10个，每项最多50字。目录停用项可显式移除；不偷偷替换用户选择。
- 新建和保存使用独立幂等键；保存回执未知时保留同一份输入、修订号和键，锁定修改及切换，提示“核对原次保存”。确认后才开放新意图，避免重复建草稿。
- 使用`expected_revision`执行原子修订。手机/另一台电脑先保存时，电脑保留本地内容并展示云端名称、说明、标签、组件、规格、资源和派生设置。用户明确选择采用云端，或保留当前内容基于刚读取的修订再次保存；再次发生并发仍拒绝覆盖。
- 离开有未保存内容的编辑器和关闭页面时提示；无本地持久化凭证或私有草稿缓存。会话到期、手机撤销或鉴权失败时清空工作台，云端已确认草稿保留。
- 组合结构预览仅解释清单，不冒充实际样例、最终生成画面、销售准入或质量审核。

## 4. 开发和交付

核心源码为`src/web/preset-workspace.tsx/.css`、`src/api/modules/plus-access.ts`、040迁移、手机接续同意界面和Plus入口。契约生成入口为`scripts/plus_contracts.py`。

定向检查为`tests/integration/plus-preset-authoring.test.ts`的6项实际HTTP/原生PostgreSQL场景，另保留7项Plus接续回归，合计13项。新界面录制入口`scripts/record-plus-presets.ts`调用实际编译后的Plus、原生处理器及临时PostgreSQL；身份、既有订单/QA与示例商品PNG为合成数据。录制模拟的是一次实际提交后的网络回执丢失，不是仅在浏览器内改状态。

必要类型、服务端、Plus和双小程序编译状态见[当前构建](../delivery/current.json)，新截图/MP4/WebM/GIF见[媒体](../media/plus-presets/README.md)，准确运行范围见[证据](../verification/plus-preset-source.json)。不执行全面测试；真实平台身份、付款、生成/语义服务、专用原生OS隔离、双端真机和云端准入另行验收，当前关闭真实销售。

初次录制误将正式服务`/plus/`路径用于仅提供HTML文件的独立预览服务器，已将未打入应用包的录制脚本改为`/plus.html`并重新核对类型。四个应用构建保留原字节；当前记录分别保留原编译源码摘要、录制修正后的最终源码摘要和原失败日志，不将录制脚本修正冒充应用重编。

## 5. English usage and scope

Request **community preset authoring** on the Plus welcome screen, then explicitly approve it from the original account's mini-program. Open **Preset composition**, combine one style with narrative/rhythm/camera/caption directions and up to ten supported specifications, review compatibility and save an owned cloud draft. Resume that same draft on desktop or in the original mini-program's community draft list.

This is a separately frozen capability; existing sessions remain unprivileged and a linked-account project session cannot act as the linked account's author. Sample production, rights, license acceptance and publication continue on the originating mini-program. Unknown save acknowledgements reuse the original request. Concurrent mobile/desktop revisions require an explicit choice, with local edits retained. Thirteen focused native checks and the recorded compiled UI have their exact provenance in the linked evidence; they do not establish production admission.

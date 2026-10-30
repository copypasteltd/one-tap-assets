# 当前交付与功能状态 / Delivery and functional status

## 本轮纯 HTTP 收口 / HTTP-only correction

| 编号 | 本轮已完成 | 结果 |
| --- | --- | --- |
| H01 | 服务入口 | HTTP38480直接访问；38443关闭，删除HTTPS跳转及网页证书入口 |
| H02 | 后端和浏览器 | HTTP基址、禁止HTTP配置误开TLS、无HSTS/CSP升级；随机键和复制兼容普通HTTP |
| H03 | 关键构建 | 5专项、类型、Linux服务端/网页/双小程序PASS；双端各17页、API均HTTP |
| H04 | 实际访问 | 服务端16项、跨LAN8项、4页面；128个部署键及原生复制成功，无HTTPS请求 |
| H05 | 配置与说明 | /root/cfg凭据说明同步HTTP；中英README、模板、证据和新截图/录屏/GIF |

| 编号 | 待完成 | 条件 |
| --- | --- | --- |
| H06 | 正式域名 | 用户后续提供，继续按要求配置HTTP基址/跨域/回调及双端API |
| H07 | 真实服务与验收 | 平台/商户/模型/Codex隔离准入、真机、OSS及恢复；目前真实生成和支付关闭 |

来源：[HTTP部署](../deployment/HTTP内网部署与运维-2026-10-31.md)、[构建与5专项](../verification/http-lan-build.json)、[浏览器](../verification/http-lan-browser.json)。不执行全面测试，已关闭本轮所属浏览器；下方前轮历史记录不能用于重新启用HTTPS。

## 2026-10-31 内网部署 / LAN deployment

| 编号 | 本轮完成 | 结果 |
| --- | --- | --- |
| D01 | 独立原生环境 | Node24 / pnpm10 / FFmpeg8.1 / PostgreSQL17；原有业务保留 |
| D02 | 高位入口 | 仅HTTP38480，38443不监听、不升级跳转；内部API38410/DB35432仅本机 |
| D03 | 构建与初始化 | Linux四目标；40迁移、10官方预设、14变体、19Skill/14bundle；全部禁售 |
| D04 | 常驻与备份 | 四应用进程、专用DB、备份timer已自启；首份DB备份已生成 |
| D05 | 明文凭据 | 服务器/root/cfg/one-tap-assets/credentials.txt，root/0600；不进入Git |
| D06 | 关键核对与媒体 | 服务端16项/工作站HTTP8项；4页面无异常，4截图与MP4/WebM/GIF |
| D07 | 交付维护 | 中英README、部署运维、配置快照与健康检查、正常提交推送 |

| 编号 | 待完成 | 条件 |
| --- | --- | --- |
| L01 | 正式域名切换 | 用户提供域名后改公开基址、回调、跨域和双端API，服务继续HTTP |
| L02 | 实际身份与商户 | 平台AppID/密钥、商户、原生宿主与真机验证 |
| L03 | 模型及Codex服务 | 专用凭据/费率/预算、原生隔离启动器、实际四阶段执行与双复核准入 |
| L04 | 生产运行与恢复 | 私有OSS、素材及日志异机备份、生产质量/容量与恢复验收 |

来源：[部署细则](../deployment/HTTP内网部署与运维-2026-10-31.md)、[服务端](../verification/http-lan-server.json)、[跨LAN](../verification/http-lan-client.json)、[浏览器](../verification/http-lan-browser.json)。LAN deployment已完成；公网正式部署、full_product_verified与production_admitted仍未成立。不执行全面测试；所属浏览器已关闭，不调用Docker/WSL/虚拟化。

## 上一轮源码功能收口记录 / Prior source delivery scope

以下原始构建/包状态保留当时范围，包括旧cloud_deployed标志；本轮部署以以上独立回执为准。


2026-10-31：按主要功能可交付收口，不以全面测试绿灯为前提。双小程序拍照与多模态识别、社区预设、逐件确认付款、阶段制作/后期/QC/独立双复核、领取和相册接口已有源码；本人双端主动绑定和共享作品保留。Plus保留图片编辑、图片批量、原片视频剪辑，并补齐复杂社区预设编排及同一份云端草稿续编。

[开始使用](../../START-HERE.md) · [预设编排细则](../实施/Plus社区预设编排与云端续编-v1.0.md) · [准确证据](../verification/plus-preset-source.json) · [截图与录屏](../media/plus-presets/README.md) · [当前构建](../delivery/current.json) · [ZIP及SHA256](../delivery/package.json)

## 本轮完成 / Completed

| 编号 | 事项 | 具体内容 |
| --- | --- | --- |
| C01 | Plus预设编排 | 主风格、叙事、节奏、镜头、字幕、路线、最多10规格与平台资源；组合清单和兼容性检查 |
| C02 | 原账号作者权限 | 手机独立确认、040迁移默认false、数据库固定权限；本人草稿7接口范围，绑定作品不能借用作者身份 |
| C03 | 云端草稿续编 | 新建、分页、读取、原子修订；手机和电脑使用同一记录，已有派生来源保持 |
| C04 | 保存异常收口 | 未知回执锁定原输入/键重试；并发修订保留本地，展示云端完整声明后明确选择 |
| C05 | 原生发布衔接 | 自有样例、授权、许可和发布继续手机处理；普通买家拍商品保持免填表 |
| C06 | 重点验证与必要构建 | 6项作者专项与7项Plus回归通过；类型、服务端、网页与双端编译的实际状态见当前构建，不执行全面测试 |
| C07 | 交付资料 | 中英README、需求/验收补充、实施细则和新截图/MP4/WebM/GIF；方案C、原39迁移及200历史媒体原字节保持 |
| C08 | 源码与产物包 | 保留START-HERE、delivery:final、解压描述和SHA清单，正常提交并推送到授权仓库 |

## 上线前事项与后续扩展 / Launch dependencies and extensions

| 编号 | 待处理 | 完成条件 |
| --- | --- | --- |
| P01 | 实际服务和运行环境 | 配置真实身份/支付/存储/视觉/生成/听音/费率、专用OS隔离启动器和云环境，完成实际准入后逐项启用 |
| P02 | 双小程序真机 | 实际AppID和域名；官方工具及iOS/Android登录、付款、下载相册、绑定与解除验收 |
| P03 | 进阶扩展 | 多轨、视频批量和真实自动转写按后续独立范围实施 |
| P04 | 完整运营验收 | 全部58项、14变体真实质量/成本/容量、商家可用性和长期稳定性；不作为本轮全面测试要求 |

当前40迁移、115业务/38管理接口、328schema/84实体，双端各17页面。新检查运行真实PostgreSQL与HTTP；身份、既有订单/QA及示例PNG为合成夹具。新媒体调用实际编译Plus，未执行实际宿主登录、模型生成或样例发布。真实销售关闭，full_product_verified=false、production_admitted=false、cloud_deployed=false。关闭所属浏览器、临时服务和临时数据库模式，保留原生开发数据库，不使用Docker/WSL/虚拟化。

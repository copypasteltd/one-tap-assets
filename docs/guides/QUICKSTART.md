# 原生快速启动

2026-10-30快速功能收口：[Plus独立图片正式制作与手机付款交付](../实施/Plus独立图片正式制作与手机付款交付-v1.0.md) · [准确证据](../verification/plus-render-source.json)。电脑保存图片编辑修订并经手机明确授权整理独立清单，冻结来源/裁切/尺寸/文案/风格/价格，再回原小程序确认费用并主动付款；CONTENT、制作、后期、QC、事实和风格独立复核后交付新 PNG 与文案。原素材与原订单权益保留，旧电脑连接不会自动获得制作权限。新增036迁移、4接口；518源码/36迁移/95业务38管理、296schema80实体、42契约/Skill槽位和4字体资源，仍为17个小程序页面。新权限/报价/付款/实际交付4项最终源码专项、类型/server/preview/本机启动和6浏览器检查通过；早期7项单元及首轮中7项工作台断言保留原源码差异，8次初始失败及类型诊断不改标。新增9媒体，总171，旧162媒体和方案C原件保持。付款/模型/审核结论/进程身份为合成；全面测试与宿主真机未执行，真实服务和销售关闭，完整产品/生产/云端false。Plus视频、字幕、批量和复杂作者工具、长期双平台身份绑定及完整验收仍待。

网页入口为本机启动后的同源 HTTPS `/plus/`。`PLUS_IMAGE_RENDER_ENABLED=false` 默认保持草稿编辑；正式图片制作还需正整数独立价格、价格版本以及既有付款/方案/Skill/Codex/复核/资源准入。配置项见[环境模板](../../.env.example)。

以下记录保留历史来源，当前状态以本轮说明与准确证据为准。

当前启动应用035迁移并提供同源HTTPS的 `/plus/`。电脑生成码后，在小程序「账户与隐私 → 接续到电脑 Plus」输入并主动确认；连接1小时，可查看本人素材并保存独立图片编辑草稿，随时撤销。[操作与权限](../实施/Plus手机确认与独立编辑草稿-v1.0.md)。原服务和销售开关保持关闭。使用项目当前构建启动器会自动指定构建目录；手动启动必须将 `YPCC_BUILD_ROOT` 指向当前构建根目录。

以下内容保留其历史来源，当前状态以上述记录及本轮证据为准。

当前API启动会应用033迁移。`/ops/metrics` 新增分群明细；metrics:read 用于查看，metrics:classify 经管理API标记内部测试/外部/未分类；令牌不放浏览器存储。领取页新增可撤回的自愿反馈，[完整接口、权限及统计口径](../实施/自愿使用反馈与分群运营统计-v1.0.md)。

以下内容保留其历史来源，当前状态以上述记录及本轮证据为准。

一键开发初始化：`.\scripts\setup-local.ps1`；运行检查：`.\scripts\run.ps1 doctor`；启动API/Worker/回收/维护：`.\scripts\run.ps1 local:start`。源码ZIP和实际构建说明见[交付指南](../delivery/README.md)。

内部[最终声音双复核与事务交付](../实施/原生声音最终双复核与事务交付-v1.0.md)已连接两路线，测试使用原生数据库/媒体及显式合成语义、供应商、授权/用量和隔离响应。LISTENING 与 ASR 配置默认关闭，示例地址/密钥/精确出口留空，还须冻结模型/能力/费率及原合同。环境变量不会启售；维护只核对已存原响应，UNKNOWN 不重购。公开有声订单、真实听感/账单/授权与宿主真机仍未准入。

[English](QUICKSTART.en.md) · [项目说明](../../README.md) · [当前状态](STATUS.md)

转写专项提供独立的 `ASR_SERVICE_ENABLED=false` / `ASR_BASE_URL` / `ASR_API_KEY` / `ASR_ALLOWED_HOSTS` 配置，默认不启用。仅设置环境值不能开放有声订单；内部服务仍须原 POST 租约、冻结模型/费率、登记私有视频和受限 HTTPS 存储。[完整配置与17项专项复现](../实施/异步音频转写与原任务回执-v1.0.md)。[声音合同与原订单费用](../实施/原生声音合同与原订单费用-v1.0.md)另说明人物/声音/配乐许可、字幕、一次整轨ASR、迁移023及23项原生专项；内部受控声音工具及文件QC已有；真实授权/服务与最终听音/双复核/交付的生产质量仍未准入。

本指南面向Windows PowerShell，命令全部在克隆的项目根目录执行。当前工作区为`E:\dev\sandbox\支付宝黑客松\一品成片`。禁止启动Docker、WSL、虚拟机或间接容器脚本；工具、缓存、构建、测试媒体、数据库均留在`runtime/`，该目录不提交。

## 1. 依赖与浏览器回放

准备Git、PowerShell和网络；文档契约核验另需本机Python 3。原生开发验证使用Node 24.22.1、pnpm 10.13.1；初始化脚本从Node官方源获取24 LTS并核对官方摘要，PostgreSQL使用EDB 17.6-1原生二进制（记录下载摘要，不宣称已有独立发布方摘要）。

```powershell
.\scripts\bootstrap-native.ps1
.\scripts\run.ps1 install --frozen-lockfile
.\scripts\run.ps1 dev:preview
```

浏览器访问`http://127.0.0.1:4173/`。回放复用共享页面，数据全部来自`src/preview/fixtures.ts`；不调用业务API、供应商或支付，不需要`.env.local`。顶部场景选择器可直接进入订单/领取等后续状态，不代表已经完成真实制作。用完关闭标签并在服务终端按`Ctrl+C`。

## 2. 原生数据库与API

本机需要原生FFmpeg与ffprobe可执行文件；可放在项目的`runtime/tools/`，脚本不会借助WSL或自动调用其他项目里的容器。提供可用的Windows二进制并核对来源，随后配置路径。

```powershell
.\scripts\bootstrap-native.ps1 -Postgres
.\scripts\run.ps1 exec tsx scripts/dev-setup.ts
```

首次执行自动生成`.env.local`、`runtime/tls/`证书及随机密码，启动`127.0.0.1:55432`的原生PostgreSQL，创建UTF-8应用库并运行迁移/种子。不要先把空`.env.example`覆盖成`.env.local`，初始化器只在文件不存在时生成凭证；已有配置应自行确认匹配的本地数据库。不要输出或提交随机凭证。

在生成文件中配置以下非凭证示例，替换为项目内实际路径：

```dotenv
FFMPEG_PATH=E:/your-checkout/runtime/tools/ffmpeg/bin/ffmpeg.exe
FFPROBE_PATH=E:/your-checkout/runtime/tools/ffmpeg/bin/ffprobe.exe
PAYMENTS_ENABLED=false
PROVIDER_GENERATION_ENABLED=false
COMMUNITY_PUBLISHING_ENABLED=false
CODEX_SERVICE_ENABLED=false
```

```powershell
.\scripts\run.ps1 dev:api
```

API默认`https://localhost:3100`；证书仅用于本地开发，不是生产域名证书。未准入的功能应保持阻断；此时可检查路由和开发数据，不会自动成为付费制作服务。具体业务/管理契约分别在`assets/development/v1.1/contracts/`中，生成客户端位于`src/shared/contracts/`。

## 3. 独立Worker与维护

每个命令放在独立的项目根目录终端：

```powershell
.\scripts\run.ps1 dev:worker
.\scripts\run.ps1 dev:reaper
.\scripts\run.ps1 dev:media-maintenance
```

开发Worker在付费开关关闭时可运行恢复/维护基础，不注册未获准制作能力，不能假装消费所有生产任务。生产模式缺少必需阶段时拒绝启动生成服务。`start:api`、`start:worker`、`start:reaper`、`start:media-maintenance`运行`build:server`生成的编译入口。

独立签名删除日志的管理入口为：

```powershell
.\scripts\run.ps1 privacy:journal initialize
.\scripts\run.ps1 privacy:journal status
```

只有配置独立日志目录、来源和签名密钥后才初始化；目录不得随数据库旧备份一起回滚。恢复使用`block/replay/finish --expected-head-sha256=<外部固定摘要>`，须先阅读[原生备份恢复协议](../实施/数据库外删除日志与原生备份恢复-v1.0.md)。财务恢复未准入时保持付费关闭；不要重建空日志、删锁或伪造检查点来绕过门禁。

## 4. 双小程序构建与真实联调

```powershell
$env:TARO_APP_API_BASE = 'https://your-admitted-api.example'
.\scripts\run.ps1 build:alipay
.\scripts\run.ps1 build:douyin
```

输出`runtime/build/mini-alipay/`和`runtime/build/mini-douyin/`，在支付宝/抖音官方开发者工具中导入。真实联调需要应用/商户权限、可信HTTPS域名与白名单、回调、宿主登录/上传/支付/相册权限。抖音支付还需要核验后的`TARO_APP_DOUYIN_TRADE_CONTRACT`，不能由示例合同替代。不要把商户/供应商密钥写入`TARO_APP_*`。

本地自签证书和127.0.0.1不直接构成手机可访问的正式后端。网页Plus和管理Web尚未实现，因此没有`dev:web`；`dev:preview`是有标识的共享页面回放。

## 5. 检查与录制

```powershell
.\scripts\run.ps1 typecheck
.\scripts\run.ps1 test
.\scripts\run.ps1 test:integration
.\scripts\run.ps1 build:server
.\scripts\run.ps1 build:preview
.\scripts\run.ps1 verify:implementation
.\scripts\run.ps1 verify:docs
.\scripts\run.ps1 verify:publication
```

`verify:implementation`集中顺序运行类型、单元、原生集成、服务端和双小程序六项，并刷新源码/契约/资源摘要；其他逐项命令用于有针对性的检查，不必无变化重复全套。集成测试需要上述数据库与原生FFmpeg/ffprobe，角色/供应商/宿主为显式合成夹具。日志在忽略的`runtime/test-results/`，公开摘要在`docs/verification/`。

回放录屏需先启动`dev:preview`，再按[演示指南](DEMO.md)执行`docs:media`。源码变化要刷新实现证据；UI变化要更新对应截图、录屏、GIF及清单，文档变化要核对链接。发布时正常提交推送并核对远端，遵循[贡献约束](../../CONTRIBUTING.md)。

可见标识可独立复录：`.\scripts\run.ps1 docs:disclosure`。它使用自绘素材和原生静帧视频，不调用外部模型；检查实际图片及完整450帧，关闭连接并回收目录。见[标识媒体与范围](../media/ai-disclosure/README.md)。

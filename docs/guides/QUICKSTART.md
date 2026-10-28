# 原生快速启动

[English](QUICKSTART.en.md) · [项目说明](../../README.md) · [当前状态](STATUS.md)

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

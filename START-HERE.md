# 一品成片：交付使用入口 / Start here

主入口是**支付宝小程序、抖音小程序**；Plus网页承担图片深化、视频选段/裁切/定时字幕、原声保留/静音及图片批量制作。普通用户拍照后由多模态识别商品，再选择社区方案，确认素材清单和费用，制作完成后领取并保存到相册。官方提供10套风格、14个执行变体。

The primary clients are the Alipay and Douyin mini-programs. Users take photos, receive a multimodal product analysis, select a community preset, confirm the deliverables and price, then collect the resulting assets. Plus provides advanced image/video editing and image batches. The official catalog has 10 styles and 14 execution variants.

## 1. 先看交付范围 / Check the package

| 编号 / No. | 内容 / Contents | 入口 / Entry |
| --- | --- | --- |
| 01 | 双小程序及共享页面 / Native mini-programs and shared screens | `src/mini-alipay/`, `src/mini-douyin/`, `src/shared/` |
| 02 | API、持久队列、制作/复核/回收 / API, durable jobs, production, review and cleanup | `src/api/`, `src/worker/` |
| 03 | Plus / Advanced workspace | `src/web/`, API `/plus/` |
| 04 | 实际构建状态 / Actual build results | [current.json](docs/delivery/current.json) |
| 05 | ZIP、文件摘要与缺项 / Archive, hashes and omissions | [package.json](docs/delivery/package.json), archive `DELIVERY-MANIFEST.json` |
| 06 | 当前完成与待办 / Completed and pending work | [STATUS](docs/guides/STATUS.md) |
| 07 | C设计、截图、视频和GIF / Design, screenshots, recordings and GIFs | [视频工作台媒体](docs/media/plus-video/README.md), [设计定型](docs/设计/定型/C-柚子创作社-v1.0/README.md) |

包内`docs/delivery/package.json`是生成的交付描述，文件摘要见根目录`DELIVERY-MANIFEST.json`；ZIP整体SHA256保存在包外的`SHA256SUMS`和仓库交付指针中，避免自引用。 / The embedded descriptor and root manifest work after extraction; the ZIP digest is supplied outside the archive.

仓库构建使用新的独立目录；ZIP将本次成功的产物映射到`runtime/build/`。启动入口核对记录内的源码、契约、字体和所用产物摘要，再选择实际目录；当前构建损坏时会明确报错。显式设置`YPCC_BUILD_ROOT`表示开发者主动选择本地产物，该模式会标记为未校验。

Repository builds use fresh isolated output directories. The ZIP maps successful outputs to `runtime/build/`. Startup verifies the recorded source, contract, font and selected output hashes before choosing a directory. An explicit `YPCC_BUILD_ROOT` selects developer outputs and is reported as unverified.

## 2. Windows首次运行 / First run

进入仓库或解压后的`one-tap-assets`目录：

From the repository or extracted `one-tap-assets` directory:

```powershell
.\scripts\setup-local.ps1
.\scripts\run.ps1 doctor
.\scripts\run.ps1 local:start
```

初始化联网安装项目内原生工具和固定依赖，保留已有`.env.local`，建立开发数据库/HTTPS并构建服务端和网页。FFmpeg/ffprobe需通过PATH或`.env.local`配置。本地启动会运行API、Worker、独立实例回收器和媒体维护器，终端给出实际地址与构建编号。按`Ctrl+C`停止本组服务，保留数据库。不使用Docker、WSL或虚拟机，也不自动打开浏览器。

Setup downloads project-local native tools and pinned dependencies, preserves `.env.local`, prepares the development database/HTTPS and builds the server/web pages. Configure native FFmpeg/ffprobe through PATH or `.env.local`. Startup prints the selected build and addresses. Press `Ctrl+C` to stop the owned services while preserving PostgreSQL. No Docker, WSL, VMs or automatic browser launch is used.

默认API：`https://localhost:3100`；实际Plus：`https://localhost:3100/plus/`。浏览器页面回放可另运行：

Default API: `https://localhost:3100`; actual Plus: `https://localhost:3100/plus/`. To view the synthetic shared-screen replay separately:

```powershell
.\scripts\run.ps1 preview:serve
```

访问`http://127.0.0.1:4173/`。回放使用合成数据；实际Plus在API同源地址运行，需要手机主动授权。浏览完关闭所属无用标签，终端按`Ctrl+C`结束回放。

Open `http://127.0.0.1:4173/`. The replay uses synthetic data. Actual Plus runs at the API origin and requires explicit phone authorization. Close unused tabs and stop the preview terminal when finished.

## 3. 双小程序与重新交付 / Mini-programs and rebuilding

在对应官方开发者工具中导入成功产物，配置真实AppID、合法HTTPS API域名、登录/支付合同及权限。ZIP内目录为`runtime/build/mini-alipay`与`runtime/build/mini-douyin`；仓库独立目录以构建记录为准。默认API原点用于本机开发，真机使用前必须设置`TARO_APP_API_BASE`并重新构建；抖音支付还需已核验的`TARO_APP_DOUYIN_TRADE_CONTRACT`。

Import successful outputs into the official developer tools and configure actual application IDs, approved HTTPS origins, login/payment contracts and permissions. Device builds require `TARO_APP_API_BASE` and a rebuild. Douyin payments also require a verified `TARO_APP_DOUYIN_TRADE_CONTRACT`.

在Git仓库中快速生成新交付包：

To create another delivery from the Git repository:

```powershell
.\scripts\run.ps1 delivery:final
# Only server/web, with mini-program outputs explicitly NOT_RUN:
.\scripts\run.ps1 delivery:final --skip-mini
```

执行必要类型检查、所选构建并打包，不运行全面测试。失败目标保留实际状态，成功产物可随源码出包；源码/契约/产物摘要不一致则拒绝混包。终端及[交付清单](docs/delivery/package.json)给出ZIP路径和SHA256。包不含依赖目录、工具、密钥或数据库，并非离线安装器。

This runs type checking, selected builds and packaging without the full test suite. Failed targets remain explicit; a partial archive can still contain successful outputs and all source. Source/contract/output mismatches stop packaging. Dependencies, tools, credentials and databases are excluded; the archive is not an offline installer.

## 4. 上线前仍需完成 / Still required for live operation

| 编号 / No. | 待完成 / Required work |
| --- | --- |
| P01 | 专用原生隔离启动器、OS身份/权限/网络限制及真实清理证明 / Dedicated native isolation and cleanup admission |
| P02 | 真实Codex、视觉/生成/听音、用量费率、存储、登录支付和云环境 / Actual providers, billing, storage, host identity/payment and cloud configuration |
| P03 | 双平台官方工具与iOS/Android真机登录、付款、下载、相册验收 / Host-tool and device acceptance |
| P04 | 完整58项、官方变体质量/成本容量及长期运营验收 / Full acceptance, quality, cost, capacity and operations |

真实服务和销售默认关闭。当前源码、原生媒体/数据库链路及构建证据不等于真实模型质量、生产隔离或云端上线。ASR、多轨/视频批量、长期跨平台绑定等扩展范围见[当前状态](docs/guides/STATUS.md)。详细方案与使用逻辑见[中文README](README.md) / [English README](README.en.md)。

Live services and sales remain disabled by default. Source, native media/database execution and build evidence do not establish real model quality, production isolation or cloud deployment. See the status page for remaining extensions.

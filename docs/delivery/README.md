# 源码交付与快速启动 / Source delivery and quick start

2026-10-31快速功能收口：Plus原片视频选段、裁切、定时字幕、原声保留/静音、独立手机授权与确认付款、新MP4/真实首帧封面/文案交付已接通。有声选段封存完整原选段与成片WAV，通过原声技术比对、独立听音及事实/风格双复核；手填字幕不冒充ASR。有声视频的免费受限售后仅修改文案并保留原音视频。4项原生关键链路检查、4项真实浏览器流程及类型/server/Plus/支付宝/抖音构建通过，未执行全面测试。543源码、38迁移、106业务/38管理接口、316schema/82实体；新增10份截图/MP4/WebM/GIF，原180媒体及方案C保持。原生数据库/HTTPS/MCP/FFmpeg实际运行，账户、付款、模型/听音判定及隔离身份为合成；真实服务和销售默认关闭。双端真机、真实服务/隔离准入、云端部署、多轨与视频批量/自动转写/复杂作者工具、长期身份绑定及58项完整验收仍待。

[视频剪辑需求、协议与配置](../实施/Plus原片视频剪辑与定时字幕-v1.0.md) · [截图与录屏](../media/plus-video/README.md) · [准确证据](../verification/plus-video-source.json) · [编号完成与待办](../guides/STATUS.md)。下文保留此前方案和历史验证来源；当前新增范围以上述视频剪辑说明及本轮证据为准。

## 1. 交付内容 / Contents

| 编号 / No. | 内容 / Component | 入口 / Entry |
| --- | --- | --- |
| 01 | 支付宝、抖音小程序及17个共享页面 / Both mini-programs and 17 shared screens | `src/mini-alipay/`, `src/mini-douyin/`, `src/shared/` |
| 02 | API、鉴权、照片、方案、订单、资金恢复、领取、社区与售后 / API and business modules | `src/api/` |
| 03 | 内容、制作、后期、QC、独立双复核、交付及实例回收 / Production and recovery workers | `src/worker/` |
| 04 | 十套官方风格、三路线规格、Skill和固定字体 / Presets, specifications, skills and fonts | `assets/` |
| 05 | 双语说明、C定型稿、截图、MP4/WebM/GIF、开发文档 / Bilingual docs, designs and media | `README.md`, `README.en.md`, `docs/` |
| 06 | 本轮成功构建的服务端与网页；双小程序保留完整源码 / Current server/web outputs; complete mini-program sources retained | 包内 / In archive: `runtime/build/` |
| 07 | 每项文件SHA-256、构建状态与排除项 / File hashes, build status and exclusions | 包内 / In archive: `DELIVERY-MANIFEST.json` |

源码与构建文件放在同一ZIP，成功产物按实际状态纳入；失败或超时的目标不借用历史文件。包不包含真实配置、个人Codex账户、客户照片、数据库、运行日志或依赖目录。需要联网安装固定依赖及原生工具，并配置外部服务；这不是离线安装器。

One ZIP contains the source and outputs that actually built successfully. Failed/timed-out targets never reuse older outputs. Credentials, personal Codex profiles, customer photos, databases, logs and `node_modules` are excluded. Native tools, pinned dependencies and external services must be installed/configured; this is not an offline installer.

## 2. 首次启动 / First run

在Windows解压到普通项目目录，进入ZIP中的`one-tap-assets`目录后执行：

Extract on Windows, enter the `one-tap-assets` directory, then run:

```powershell
.\scripts\setup-local.ps1
.\scripts\run.ps1 doctor
```

初始化脚本安装项目内的Node 24、pnpm、原生PostgreSQL和依赖，生成本地HTTPS证书与随机凭证，迁移/种子化开发库，并构建服务端与共享页面。已有`.env.local`保留。FFmpeg/ffprobe使用PATH上的原生程序，或在`.env.local`配置`FFMPEG_PATH`和`FFPROBE_PATH`；`doctor`显示缺项，不输出密钥。全部操作不调用Docker、WSL或虚拟机。

Setup installs project-local Node 24, pnpm, native PostgreSQL and dependencies, creates local HTTPS certificates/random credentials, migrates/seeds the development database and builds the server and shared-screen replay. An existing `.env.local` is preserved. Use native FFmpeg/ffprobe on PATH or configure their paths there; `doctor` reports missing dependencies without printing secrets. No Docker, WSL or VMs are used.

### 查看页面 / View screens

```powershell
.\scripts\run.ps1 preview:serve
```

打开`http://127.0.0.1:4173/`。这是双小程序共享页面的浏览器回放，包含合成商品/订单，供查看拍照、识别、方案、订单、领取及作者入口；它不发起真实付款或模型调用，也不是Plus编辑器。关闭本次浏览器标签，终端按`Ctrl+C`停止。

Open `http://127.0.0.1:4173/`. This serves the compiled shared mini-program screens with explicitly synthetic product/order data. It does not buy models, perform payments or implement the Plus editor. Close the opened tab when finished and press `Ctrl+C` to stop.

### 启动后端 / Start the backend

```powershell
.\scripts\run.ps1 local:start
```

一次启动API、Worker、独立实例回收器和媒体维护器。入口先迁移开发库，等待API与Worker就绪；任一子服务退出时停止本组。`Ctrl+C`只停止本次启动的子服务，保留原生数据库。API默认`https://localhost:3100`；`/healthz`检查数据库连接，`/readyz`还检查当前删除日志门禁。可用`local:start --once`做一次启动/停止检查。

This starts API, Worker, instance reaper and media maintenance together. It migrates the development database, waits for API/Worker readiness and stops the owned group if a service exits. `Ctrl+C` stops only these children and leaves PostgreSQL running. The default API is `https://localhost:3100`; health/readiness endpoints inspect the database and applicable privacy gate. `local:start --once` starts, checks readiness and stops the group.

真实服务使用小程序宿主登录、支付合同、视觉/生成服务、Codex服务凭证及原生受限启动器。默认开关关闭；启动基础服务不会自动启售。配置说明见[快速启动](../guides/QUICKSTART.md)与[环境示例](../../.env.example)。

Live operation requires host login/payment contracts, vision/generation providers, dedicated Codex credentials and the native restricted launcher. Default switches remain off; starting local infrastructure does not enable sales. See [quick start](../guides/QUICKSTART.en.md) and the [environment catalog](../../.env.example).

## 3. 构建与打包 / Build and package

```powershell
# 手机和平台开发者工具应使用实际已配置的HTTPS API。
# Use the configured HTTPS origin for device/developer-tool builds.
$env:TARO_APP_API_BASE = 'https://your-api.example'
.\scripts\run.ps1 delivery:build --smoke
.\scripts\run.ps1 delivery:package
```

未设置API地址时，本地交付构建使用`https://localhost:3100`；手机使用前必须改为手机可访问且符合宿主配置的地址并重新构建。抖音支付还需配置已核验的`TARO_APP_DOUYIN_TRADE_CONTRACT`。将成功构建的`runtime/build/mini-alipay`或`mini-douyin`导入对应平台官方开发者工具，配置应用ID、域名及权限。

Without an explicit origin, delivery builds use `https://localhost:3100` for local development. Device builds must be rebuilt with a reachable host-approved origin. Douyin payments additionally require `TARO_APP_DOUYIN_TRADE_CONTRACT`. Import successful mini-program outputs into the corresponding official developer tools and configure application IDs, domains and permissions.

`delivery:build --server-only`仅进行类型与服务端构建，其他目标记为NOT_RUN；适用于后端专项收口。该模式的成功只代表所选服务端构建，完整构建状态仍单独保留。The server-only mode explicitly leaves other build targets NOT_RUN.

`delivery:build --skip-mini`执行类型、服务端和网页构建，小程序目标记为NOT_RUN。当前快速交付采用此模式；ZIP包含两端完整源码及当前服务端/网页产物，最终快照未重建小程序，也没有混入旧编译物。初版支付宝TIMEOUT、抖音PASS见[原构建记录](../verification/support-desk-initial-build.json)，不升级为最终快照通过。需要小程序产物时，配置实际HTTPS地址并执行上面的完整构建。

`delivery:build --skip-mini` builds the server and web pages, explicitly leaving both mini-program outputs NOT_RUN. This focused package includes complete mini-program source and current server/web outputs. Earlier Alipay TIMEOUT and Douyin PASS belong to the original snapshot; current mini-program binaries are excluded. Run a full build with the configured HTTPS API when producing host outputs.

`delivery:build`直接调用已安装的固定工具，输出到新的独立目录。执行类型检查、服务端、共享页面、支付宝和抖音构建，每个命令最多180秒；一个目标失败后仍记录其他目标。`--smoke`仅选照片上传/恢复及原图素材完整双复核交付相关文件，最多180秒；不运行全套。所有状态和日志摘要写入[current.json](current.json)，完整日志留在忽略目录。打包不要求全部检查通过，包清单会显示实际缺项。

`delivery:build` directly invokes installed pinned tools into a fresh isolated directory. Type/server/replay/Alipay/Douyin commands each have a 180-second delivery-check cap, and failures do not hide other targets. Optional `--smoke` selects photo upload/recovery and photo-pack review/delivery cases, with its own 180-second cap; it does not run the full suite. [current.json](current.json) records exact results and local log hashes. Packaging does not require all checks to pass, and missing components remain explicit.

打包后终端输出ZIP路径、SHA-256、文件数量和各目标状态，产物位于`runtime/releases/`。ZIP包含自身之外每份文件的摘要清单。源码或运行契约变更后必须重新构建；打包时逐项校验成功构建的字节，拒绝悄悄混入新源码或旧产物。

The packager prints the ZIP path, SHA-256, file counts and component statuses under `runtime/releases/`. Its embedded manifest lists every payload file except the manifest itself. Source/contract changes require a new build, and packaged build bytes are checked against the actual build inventory.

## 4. 主流程与剩余工作 / Main flow and remaining work

核心目标仍为：拍照→多模态商品档案→社区预设/规格→冻结清单与费用→内容/制作/后期→文件QC与两个独立复核→交付/相册→实例释放。三路线、官方十套/最少十四变体、交付前修复和社区/售后要求继续保留。

The intended main flow remains photos → multimodal product profile → community preset/specification → frozen pack/budget → content/production/POST → QC and independent dual review → delivery/album → instance release. All three routes, ten official styles/at least fourteen variants, repair, community and aftercare remain required.

| 编号 / No. | 交付后的剩余工作 / Remaining work |
| --- | --- |
| 01 | 原生有声失败修复及保留原声售后已有源码；真实口播质量和各资源完整准入待验 / Native repair/retained-audio aftercare source exists; real voice/resource admission remains pending |
| 02 | 真实Codex原生隔离/清理、模型质量/计费、语音授权及连续多镜变体 / Real runtime, providers, speech and official variants |
| 03 | 支付宝/抖音真机登录、支付/退款、下载/相册和服务域名配置 / Native device and host integrations |
| 04 | 静音/有声社区买家源码和生成式售后已接通；完整商业准入、Plus及云部署待完 / Community buyer/aftercare source is connected; complete admission, Plus and cloud remain pending |
| 05 | 已记录的原生数据库超时与完整验收；不阻断当前源码候选打包 / Historical timeout investigation and comprehensive acceptance |

历史全量失败和单项证据保留在[验证索引](../verification/README.md)；它们不被本轮快速构建改写为全通过。[当前状态](../guides/STATUS.md)继续记录功能缺口。每轮同步双语README、更新说明和远端仓库。

Historical failures remain in the [verification index](../verification/README.md); focused delivery builds never turn them into a complete pass. The [status guide](../guides/STATUS.md) retains functional gaps. Bilingual README, changelog and the remote repository continue to be synchronized.

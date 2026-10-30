# 支付宝与抖音小程序交付导入 / Mini-program import

本项目优先使用支付宝、抖音小程序，网页 Plus 承担深化编辑与批量整理。手机流程为拍照 → 多模态分析 → 社区预设 → 核对费用并付款 → 制作、后期和交叉核验 → 领取、保存相册。用户无需填写商品表格，识别出的待核对事实需要在交付前核验。Plus 由手机明确授权，不能代替手机付款。

## 交付目录

解压交付 ZIP，进入 `one-tap-assets/runtime/build/`，分别导入下列子目录。源码仓库不提交编译产物；在仓库中运行构建命令可重新生成目录。当前包位置及 SHA256 见[交付指针](../delivery/package.json)，准确构建见[构建记录](../delivery/current.json)。

| 平台 | 导入目录 | IDE 配置 | 原生模板 / 样式 |
| --- | --- | --- | --- |
| 支付宝 | `mini-alipay/` | `mini.project.json` | `.axml` / `.acss` |
| 抖音 | `mini-douyin/` | `project.config.json` | `.ttml` / `.ttss` |

两个目录都包含 `app.json`、`app.js`、共享样式、17 个页面、运行时依赖、示例输入照片来源说明和 `delivery-manifest.json`。页面样式可由 Taro 合并进全局样式，不能仅凭单页没有独立样式文件判断缺失。示例图片来自已冻结的方案 C 设计稿，仅为输入展示，不代表买家生成成品。

## 开发者工具操作

1. 打开对应平台的官方开发者工具，选择导入项目，目录定位到上述平台子目录，不能选择整个仓库或 `runtime/build/`。
2. 使用自己拥有权限的实际 AppID。交付配置不预填测试 AppID，也不包含商户或供应商密钥。抖音配置保留域名检查。
3. 选择与应用匹配的运行环境及账号。在平台后台配置请求、上传、下载等实际使用的可信 HTTPS 域名，配置对应回调和应用权限。
4. 先检查页面、预设和帮助入口，再按[真机检查清单](#真机检查清单)进行登录、拍照、支付和相册验收。编译和目录检查通过不等于宿主运行通过。
5. 完成后关闭本次创建的开发者工具窗口及不用的浏览器页签，保留其他工作和原生开发数据库。

支付宝的项目文件及 `miniprogramRoot` 字段见[官方项目配置说明](https://miniprogram.alipay.com/docs/miniprogram/mpdev/framework_project)。抖音字段见[官方项目配置](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/framework/general-configuration)，导入与 AppID 要求见[官方开发者工具导入指南](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/dev-tools/developer-instrument/page/startpage)。

## 使用实际服务地址重新构建

默认交付使用 `https://localhost:3100`，适合本机联调，手机上的 localhost 指向手机自身。真机必须使用已配置的平台可访问 API 地址重新编译；当前包不声称已经部署云端。

```powershell
# Windows 原生 Node 24.22.1 / pnpm；不使用 Docker 或 WSL。
$env:TARO_APP_API_BASE = 'https://your-admitted-api.example'
.\scripts\run.ps1 build:alipay
.\scripts\run.ps1 build:douyin
```

默认输出到仓库内 `runtime/build/mini-alipay/` 和 `runtime/build/mini-douyin/`。`TARO_APP_*` 会写入客户端，是公开构建配置，不能存放密码、API 密钥、商户私钥或个人 Codex 凭证。抖音交易还需要已核验的 `TARO_APP_DOUYIN_TRADE_CONTRACT`，不能用示例值冒充交易准入。服务端私密配置见[环境模板](../../.env.example)与[原生启动指南](QUICKSTART.md)。

重新生成完整交付包：

```powershell
.\scripts\run.ps1 delivery:build
.\scripts\run.ps1 delivery:package
```

交付构建对每端编译设置 360 秒上限，类型、服务端和网页仍各为 180 秒。该机器曾出现支付宝工具链初始化使完整编译达到约 255 秒，旧的 180 秒超时记录保留；后续构建耗时可能随本机状态变化。时限到达会终止本次编译进程树，失败候选不会被装入可执行包。

## 目录检查与清单

`scripts/mini-artifacts.cjs` 在真实 Taro 编译成功后生成平台配置和文件清单。它核对全部声明页面的脚本、JSON、模板及共享样式，解析 JavaScript，检查本地脚本/模板依赖，拒绝缺失文件、越界依赖或符号链接。交付流程再将编译页面与对应源码配置逐项比较，并复核清单中的字节数与 SHA256。

`delivery-manifest.json` 不包含自身摘要，记录其余产物。它证明所列目录内容一致，不提供平台签名，也不代表真实 AppID、登录或支付已验证。在开发者工具修改项目配置后，目录与原交付清单会自然产生差异；原始 ZIP 和 SHA256 应作为留存副本。

## 真机检查清单

| 编号 | 待核对的实际功能 | 通过依据 |
| --- | --- | --- |
| D01 | 两端 AppID、域名、权限和首次进入 | 开发者工具及实际手机正常打开 17 个页面入口 |
| D02 | 实际账号登录、会话隔离与删除/撤销 | 平台真实登录结果及服务端当前权限记录 |
| D03 | 拍照/相册、上传、多模态判断与社区预设 | 实际照片、确认过的识别内容和预设版本 |
| D04 | 报价、主动付款、回调、取消与退款 | 平台真实订单状态、签名回调及金额核对 |
| D05 | Codex 分阶段制作、后期、QC 和双复核 | 真实服务证据与受控实例释放记录 |
| D06 | 领取、私有下载、保存相册、权限拒绝与重试 | 实际文件和系统相册结果；无越权或重复收费 |
| D07 | Plus 手机批准、逐件批量报价付款和撤销 | 同一用户和版本，独立订单及可恢复进度 |

本轮只做对应编译与文件完整性检查，不执行全面测试。此前业务主链路使用实际 PostgreSQL、HTTPS、MCP 和 PNG 执行，但身份、付款、模型、语义核验和进程身份为合成；真实服务与销售默认关闭。完整产品验收、生产准入及云端部署仍未完成。

## English

Import `one-tap-assets/runtime/build/mini-alipay/` into the Alipay IDE or `mini-douyin/` into the Douyin IDE. Each directory contains all 17 pages, shared styles, runtime dependencies, IDE configuration, illustrative input images and a SHA256 inventory. Select your actual application ID in the IDE; no usable account ID or secret is supplied. Douyin domain checking stays enabled.

The packaged API origin defaults to `https://localhost:3100`. Rebuild with your accessible, admitted HTTPS origin in `TARO_APP_API_BASE` before using a physical phone. Client build variables are public; merchant, supplier and Codex credentials belong only on the server. Douyin checkout additionally requires a verified trade contract. Follow the commands above; run the corresponding official IDE against the compiled platform directory, rather than the repository root.

The delivery pipeline uses the actual Taro compiler, checks every page against source, parses scripts, resolves local script/template dependencies and verifies all inventoried bytes. Native compilers have a bounded 360-second deadline. Failed candidates are excluded. Native IDE launch, physical-device login, camera, payment, album saving and real-service admission remain separate acceptance tasks; none is inferred from compilation.

The mobile product workflow remains photo → multimodal product analysis → community preset → explicit quote/payment → staged production and independent review → private delivery/album saving. Plus requires explicit phone approval and returns each batch item to mobile checkout. See the [bilingual project overview](../../README.en.md), [current work and remaining items](STATUS.md) and [exact evidence](../verification/mini-closure-source.json).

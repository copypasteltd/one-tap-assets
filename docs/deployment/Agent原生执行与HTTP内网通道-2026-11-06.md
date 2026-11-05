# Agent 原生执行与 HTTP 内网通道

本轮处理上一份[真实 Agent 阻塞核查](../评估/真实Agent可用性与阻塞清单-2026-11-06.md)中的代码和部署适配问题。公开入口继续为 `http://192.168.31.20:38480`，不配置 HTTPS、证书或升级跳转。域名解析与反代由用户处理。真实模型凭据、计价与准入仍必须使用实际服务回执，不能用合成检查代替。

## 执行结构

Worker → 锁定摘要的启动器客户端 → root 专用 Unix socket broker → 独立 Linux 账号 / AppArmor / 出站规则 / systemd 进程组 → Codex app-server → 平台受控推理出口和 MCP 工具。

每个角色创建新 HOME、工作目录、临时目录和上下文。内容梳理、制作、后期及两个独立复核继续使用既有角色合同、六份可信 Skill、预算、截止时间和交付门禁。本轮没有修改销售条件、订单权益、费用结算或 UNKNOWN 原请求恢复规则。

| 编号 | 已补齐的代码 | 作用 |
| --- | --- | --- |
| C01 | Linux ELF / Python 客户端与 Windows EXE 分平台检查 | 去除 Ubuntu 被 `.exe` 条件阻断的问题；拒绝通用 Shell、解释器及虚拟化程序替代执行器 |
| C02 | 内部 Agent 网关统一校验 | HTTP 仅允许 `127.0.0.1` / `::1`，公开域名不会决定角色出口；外部模型出口保留原 HTTPS 与白名单要求 |
| C03 | root broker 与无权限客户端 | 服务账号通过 Unix 对端身份认证，角色使用无密码、不可登录、无 HOME 的临时账号 |
| C04 | 目录、网络与资源限制 | AppArmor 只准输入、Skill、配置和必要程序；ACL 区分角色；UID 出站规则只允许本机 API；进程组、内存、任务数、截止时间共同约束 |
| C05 | 原生清理与重启恢复 | 持久化不含令牌的清理计划；终止整组子进程，核实后删除临时文件、权限、网络规则和账号；重复释放可核对原回执 |
| C06 | 凭据与构建锁定 | 临时权限不进入命令参数或 systemd Environment；启动后删除私有环境文件；客户端锁定 root broker 和 C bootstrap 的摘要 |
| C07 | 只读诊断与交付包 | 新增 `agent:doctor`，只输出字段是否配置、开关、摘要检查和数据库聚合；Linux 部署文件及诊断构建纳入打包与源摘要 |

没有使用 Docker、WSL、容器、虚拟机或子代理，也未打开浏览器。AppArmor、ACL、UID 防火墙、系统账号和 systemd 均直接使用宿主 Linux 的原生能力。

## 内部地址与配置

| 配置 / 位置 | 当前约定 |
| --- | --- |
| 公开入口 | `http://192.168.31.20:38480` |
| `CODEX_GATEWAY_ORIGIN` | `http://127.0.0.1:38410`，直接连接本机 API，绕过反代和域名解析 |
| `CODEX_INFERENCE_PROXY` | 可留空自动取上述原点的 `/v1/internal/p01/agent-inference`；填写时必须完全匹配 |
| `CODEX_ISOLATION_LAUNCHER` | `./deploy/linux/bin/agent-launcher`，部署安装器生成完整依赖摘要绑定 |
| root broker 配置 | `/root/cfg/one-tap-assets/native-launcher.json`，root / 0600 |
| root broker 交接 | `/root/cfg/one-tap-assets/native-agent-handoff.json`，含真实启动器摘要及待配事项 |
| 原有凭据 | `/root/cfg/one-tap-assets/credentials.txt` 与 `app.env`；不进入 Git 和诊断输出 |
| 原生组件 | `/opt/one-tap-assets/native-agent/`，root 管理 |
| Unix socket | `/run/one-tap-assets-agent/launcher.sock`，root / ypcc，0660，无 TCP 监听 |
| 持久清理日志 | `/var/lib/one-tap-assets-agent/`，root 私有；文件不保存模型密钥或角色令牌 |
| 角色账号池 | UID/GID 62000–62999；仅在角色存活时创建，用完删除，不能交互登录 |
| 独立 OS 核验池 | UID/GID 63000–63999、独立 probe socket 与日志，不改业务数据库 |

旧 HTTPS 部署配置不启用。已有 API、Worker、回收器的低权限边界保留；Worker 不通过 sudo 提权，专用 broker 承担受限的角色创建与释放。

## 安装、更新和检查

管理员在目标服务器以 root 执行：

```sh
cd /opt/one-tap-assets/app
python3 -I -B scripts/ops/install-native-agent.py
python3 -I -B scripts/ops/install-codex-native.py
python3 -I -B scripts/ops/install-native-agent.py
systemd-run --quiet --wait --pipe --collect \
  --property=WorkingDirectory=/opt/one-tap-assets/app \
  --property=EnvironmentFile=/root/cfg/one-tap-assets/app.env \
  --uid=ypcc --gid=ypcc \
  /opt/one-tap-assets/tools/node/bin/node runtime/build/ops/agent-doctor.js
```

安装器只修改本项目组件，安装缺失的原生 ACL 工具，编译无特权 C 环境传递程序，更新 root 配置和两个内部配置项，备份至 `/root/cfg/one-tap-assets/config-snapshots/`。不会启用生成、支付、Codex、销售或修改 Skill 准入状态。重复安装应先部署本版的启动器模板、broker、C 源码和服务端构建；生成后的启动器与 Git 模板摘要不同，这是完整依赖锁定的预期结果。

诊断使用 systemd 在 Node 启动前加载与服务相同的环境，包括数据库证书信任配置；不要只用 Node 的 `--env-file` 代替该启动环境。诊断退出码 1 表示有设置缺失或服务关闭，不表示程序崩溃。诊断通过也不等于真实交付验收。实际 OS 核验由 `scripts/ops/probe-native-agent.py` 运行，使用专门的 C 合成执行程序，不调用模型、不购买素材、不写订单或准入记录。

Linux Codex 本轮安装版本为 **0.166.0**，仅使用官方 npm 包中的原生 ELF，校验包 SHA-512 后安装并记录实际 ELF SHA-256；不安装或调度包内的 bwrap。版本与来源记录保存在 `/root/cfg/one-tap-assets/codex-install.json`。CLI 官方安装来源见 [OpenAI Codex README](https://github.com/openai/codex/blob/main/README.md)，app-server 协议见 [OpenAI 官方说明](https://learn.chatgpt.com/docs/app-server)。版本升级须重做协议、隔离和实际模型准入，不能自动沿用旧摘要。

## 真实上线仍需的资料

| 编号 | 待完成 | 代码之外的依据 |
| --- | --- | --- |
| P01 | 服务模型、访问密钥、视觉 / 图像 / 视频模型、实际价格与预算 | 填入 root 私有配置，并登记真实模型版本；诊断不会显示密钥 |
| P02 | Codex 运行、Skill 及双复核真实准入 | 用实际模型和实际素材核对发现、产出、成本、工具授权、独立复核与最终释放，再封存证据和准入文件 |
| P03 | 小程序真实登录、支付与生产存储 | 支付宝 / 抖音主体、商户资料及存储服务等实际配置；按已实现的接口接入 |
| P04 | 用户负责的域名解析和反代 | 本轮内部 Agent 通道已独立于公开域名；收到正式外部信息后再更新公开基址、回调和跨域 |

## 已完成的专项核验

[Linux 实际隔离回执](../verification/native-agent-linux-2026-11-06.json)的 15 项检查全部通过，包括读写范围、禁止读取其他工作目录和 root 凭据、Shell 执行拒绝、只许本机 API、数据库直连拒绝、令牌不进入 unit 属性、子进程清理、重复释放、断线释放和 broker 重启回收。执行程序是专门的合成 C 程序，隔离由实际服务器内核验证。

[Codex 实际协议回执](../verification/codex-native-protocol-2026-11-06.json)确认官方 0.166.0 ELF 在受限身份中成功初始化、发现六份合成 Skill、创建自定义平台 provider 的只读临时上下文，并启动实际 Node MCP 进程。工具服务状态为 `connected`，成功经本机 HTTP 网关发现 `synthetic_probe_tool`，无工具发现错误；没有发送 `turn/start`。测试使用六份协议专用 Skill 和合成工具目录，未对那 14 个业务 Skill 组合做真实模型准入。复现入口为 `scripts/ops/probe-codex-protocol.py`。

这些回执分别证明宿主隔离与协议兼容，不能证明真实模型产出、语义复核或可销售性。早前只读报告保留原时点，不回写成“当时已可用”。

本次同时修正实际工具启动所需的 Linux `TMPDIR`、只读 Node 包元数据及 OpenSSL 公共配置读取范围；角色账号创建与释放串行处理系统账号锁。启动准备最多等待 45 秒，始终受原角色截止时间约束，不延长订单授权。外部 Shell、其他工作区、root 凭据及数据库访问继续拒绝。

| 编号 | 最终验证与回执 | 范围 |
| --- | --- | --- |
| V01 | [源码专项与摘要](../verification/native-agent-source-2026-11-06.json) | 类型检查、服务端构建和 6 文件 / 15 项专项通过；包括不确定购买仅恢复原意图、传输边界和交付目录选择 |
| V02 | [Linux 隔离回执](../verification/native-agent-linux-2026-11-06.json) | 15 项宿主检查通过，使用合成 ELF，不调用模型 |
| V03 | [Codex / MCP 协议](../verification/codex-native-protocol-2026-11-06.json) | 实际官方 Codex、六份合成 Skill 和实际 MCP 连接通过，不调用模型 |
| V04 | [部署复核](../verification/native-agent-deployment-2026-11-06.json) | 更新后的 HTTP 入口、8 路访问、7 个服务、运行配置与已安装摘要核对 |
| V05 | [脱敏配置诊断](../verification/agent-config-after-code-fixes-2026-11-06.json) | 展示仍缺少的模型、预算和准入配置，不输出密钥 |

未执行全面测试。历史媒体发布核验仍报告 `Stale disclosure capture source: src/worker/compiler/disclosure.ts`；该文件本轮未改动，与基线提交 `3e8aca5` 一致。本轮没有改写旧录制来源或将其标为通过，这项记录保留在 V01。

本轮另提供[服务端增量包索引](../delivery/native-agent-patch-2026-11-06.json)，以 `3e8aca5` 为基线，包含变更源码、文档、核验回执与 7 个服务端入口的构建 / source map。包内有逐文件摘要和安装说明，面向已完成基础部署的同版本环境；Node 依赖、数据库、真实凭据、Codex 原生二进制和小程序 / 网页既有产物不在此增量包内。完整源码以 Git 仓库为准，旧完整包不会被改标成本轮完整产品交付。

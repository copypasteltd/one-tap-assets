# Native LAN deployment / 原生内网部署

This directory captures the configuration actually deployed on `192.168.31.20` on **2026-10-31, Asia/Taipei**. It contains no passwords, application keys, management bearer tokens, TLS private keys or database dumps. [Deployment and operations](../../docs/deployment/内网部署与运维-2026-10-31.md) describes the live layout and remaining integrations.

本目录是实际服务器的配置快照，包含 nginx、7 份 systemd 配置、首页、数据库备份脚本和无密钥回执。原生 Node、PostgreSQL、FFmpeg 和常驻服务运行于 Linux；不依赖 Docker、WSL 或虚拟化。服务器私密配置单独保存在 `/root/cfg/one-tap-assets/`。

| Item / 内容 | Location / 入口 |
| --- | --- |
| HTTPS landing / 首页 | `https://192.168.31.20:38443/` |
| Plus | `https://192.168.31.20:38443/plus/` |
| Synthetic mini-program replay / 合成数据回放 | `https://192.168.31.20:38443/preview/` |
| Support, review, metrics / 管理页面 | `/ops/support`, `/ops/review`, `/ops/metrics` |
| HTTP redirect / 跳转端口 | `38480` → HTTPS `38443` |
| Private API and PostgreSQL / 本机端口 | `127.0.0.1:38410`, `127.0.0.1:35432` |

On the **already provisioned host**, reapply only this application's captured configuration with `sudo bash deploy/linux/install-config.sh`; run focused checks with `sudo bash deploy/linux/healthcheck.sh`. The installer first snapshots this application's previous configs under `/root/cfg/one-tap-assets/config-snapshots/`. It requires the existing private environment, certificates, native binaries and database. It is not a fresh-host bootstrap and must be adapted before use on another host.

在已部署服务器项目目录中可执行：

```bash
sudo bash deploy/linux/install-config.sh
sudo bash deploy/linux/healthcheck.sh
sudo systemctl status one-tap-assets-api one-tap-assets-worker one-tap-assets-db
sudo journalctl -u one-tap-assets-api -u one-tap-assets-worker -n 50 --no-pager
sudo systemctl start one-tap-assets-backup.service
```

Keep the privacy deletion journal separate from database restore operations. A database backup alone does not establish full business, financial or privacy recovery. No full suite, real provider order, payment transaction or native mini-program host acceptance is claimed. Sales and real generation remain disabled.

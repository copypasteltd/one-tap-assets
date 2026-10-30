# HTTP-only LAN deployment / 纯 HTTP 内网部署

**Current entry: `http://192.168.31.20:38480`.** Per the user's explicit requirement, this service has no HTTPS listener, certificate endpoint or HTTP-to-HTTPS redirect. Port `38443` is closed. The native API on `127.0.0.1:38410` also runs HTTP.

当前网页服务只使用 HTTP。本目录的 nginx、配置安装器和健康检查均已同步，不申请或安装网页证书，也不自动升级 HTTPS。后续提供正式域名时继续按用户指定的 HTTP 方案处理。实际环境、凭据和运维入口见 [HTTP 部署细则](../../docs/deployment/HTTP内网部署与运维-2026-10-31.md)。

| Item / 内容 | Entry / 入口 |
| --- | --- |
| Homepage / 首页 | `http://192.168.31.20:38480/` |
| Plus | `http://192.168.31.20:38480/plus/` |
| Synthetic replay / 合成数据回放 | `http://192.168.31.20:38480/preview/` |
| Management / 管理页面 | `/ops/support`, `/ops/review`, `/ops/metrics` |
| API / PostgreSQL | `127.0.0.1:38410`, `127.0.0.1:35432` |
| HTTPS | Disabled; no listener on `38443` |

On the already provisioned host, run `sudo bash deploy/linux/install-config.sh` to reapply this application's configuration, or `sudo bash deploy/linux/healthcheck.sh` for focused checks. The installer snapshots this application's previous configs under `/root/cfg/one-tap-assets/config-snapshots/` and preserves credentials, database state and deletion-journal state. It requires the installed native binaries and database; it is not a fresh-host bootstrap.

```bash
cd /opt/one-tap-assets/app
sudo bash deploy/linux/healthcheck.sh
sudo systemctl status one-tap-assets-api one-tap-assets-worker one-tap-assets-db
sudo journalctl -u one-tap-assets-api -u one-tap-assets-worker -n 50 --no-pager
sudo systemctl start one-tap-assets-backup.service
```

Current evidence: [HTTP server](../../docs/verification/http-lan-server.json), [Linux builds and five focused tests](../../docs/verification/http-lan-build.json), [workstation HTTP](../../docs/verification/http-lan-client.json), [ordinary HTTP browser](../../docs/verification/http-lan-browser.json). `receipts/http-deployment.json` is current; `receipts/lan-deployment.json` retains the superseded HTTPS deployment record.

本目录不包含实际密码、管理令牌、应用密钥、私钥或数据库。明文凭据仅在服务器 `/root/cfg/one-tap-assets/credentials.txt`（root/0600）。数据库现有私有 TLS 是数据库连接协议，不是网页 HTTPS；此次未改动数据库数据、密钥、备份或其他业务。真实身份、模型、商户和 Codex 隔离仍待配置，真实销售及生成关闭；不宣称完整产品、真实宿主或生产验收。

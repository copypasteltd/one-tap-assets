# 素材纠错操作录制 / Support repair recording

[实现与使用](../../实施/客服素材纠错工作台-v1.0.md) · [精确来源](../../verification/support-repair-ui-source.json) · [逐项摘要](capture-manifest.json)

实际Edge页面、原生HTTPS/API、PostgreSQL和私有媒体操作，包含原工单接手、档案/原图核对、三种编辑入口、已提交纠错回执丢失后的原键恢复、五阶段实际制作及新文案文件交付、重载查询、隐私撤回及退出清理。输入商品图、身份、角色语义与计量为合成夹具；不证明真实模型、付款、生产隔离、真机或上线。

Actual browser, native HTTP/stdio, database and file effects, including committed-ACK recovery and a genuine five-stage corrected delivery. Product inputs, semantic verdicts, identities and metering are synthetic. This is not live-service, production, payment or native-device certification. All owned browser tabs, context, processes and database pool are closed.

| 编号 / No. | 页面 / Screen | 文件 / File |
| --- | --- | --- |
| 01 | 原商品与素材 / Frozen profile and current pack | [PNG](01-source-profile-and-pack.png) |
| 02 | 实际私有图片 / Actual private image | [PNG](02-private-delivered-image.png) |
| 03 | 更正核对 / Correction review | [PNG](03-correction-review.png) |
| 04 | 新素材交付 / Completed corrected delivery | [PNG](04-completed-linked-delivery.png) |

![原工单素材纠错 / Original-ticket correction](walkthrough.gif)

[MP4](walkthrough.mp4) · [原始WebM / Original WebM](walkthrough.webm)。约14.68秒；脚本在提交后等待真实五阶段执行，视频保留实际页面等待过程。

复录 / Recapture: build current server/web with `delivery:build --skip-mini`, then run `runtime/tools/node/node.exe --env-file-if-exists=.env.local --import tsx scripts/record-support-repair.ts` with the project-local Playwright browser/cache paths configured. Requires native PostgreSQL/FFmpeg and installed Edge; no Docker/WSL/VM. It uses an isolated disposable database schema, not customer production data.

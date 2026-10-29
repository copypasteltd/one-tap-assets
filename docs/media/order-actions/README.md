# 原订单取消与退款 / Original-order cancellation and refund

共享小程序订单页的实际浏览器录像。订单、金额、退款及支付状态为明确的合成回放，官方方案仍禁售；不发起宿主付款、真实退款或模型调用。真实资金到账、宿主登录/相册及真机能力需独立验收。原C设计和50份既有媒体保留原字节。

Actual recording of the shared order page with synthetic order/refund states. Displayed amounts are fixtures, not product pricing. No native payment, real refund or provider call occurs.

![原订单取消与退款 / Original-order cancellation and refund](walkthrough.gif)

[MP4](walkthrough.mp4) · [原始WebM / Original WebM](walkthrough.webm) · [源码与媒体摘要 / Provenance](capture-manifest.json)

| 编号 / No. | 画面 / Screen | 截图 / Screenshot |
| --- | --- | --- |
| 01 | 原订单付款与取消 / Original payment and cancellation | [PNG](01-original-order.png) |
| 02 | 制作已取消，原交易继续核对 / Cancelled production, original trade reconciliation | [PNG](02-cancelled.png) |
| 03 | 退款申请已受理 / Refund requested, not received | [PNG](03-refund-requested.png) |
| 04 | 开始制作后进入售后 / Aftercare after production starts | [PNG](04-production-support.png) |

脚本覆盖放弃/确认取消、UNKNOWN不重复支付、已付款排队取消、失败退款及重复查询、制作中售后、到账确认和320px宽度。真实API/原生数据库证据另见 [本轮来源](../../verification/order-actions-source.json)，不由浏览器合成状态代替。

```powershell
.\scripts\run.ps1 exec tsx scripts/record-order-actions.ts
```

先构建当前preview再录制。脚本使用本次独立服务和Edge上下文，并在结束时关闭本次页面、浏览器与服务。

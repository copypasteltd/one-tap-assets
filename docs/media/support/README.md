# 订单反馈与记录 / Order feedback and records

真实共享小程序页面录制，说明和图片为合成演示；上传、提交回执丢失与处理状态是显式回放，不代表真实客服、退款、云存储或手机授权。原C设计与64份既有媒体保留原字节。

Actual shared-screen recording with synthetic evidence and support outcomes. Native API tests separately use actual generated PNG files and the local object store. This recording does not certify staff processing, cloud storage, payment or device permissions.

![订单反馈、原请求恢复与历史记录 / Feedback, original request recovery and history](walkthrough.gif)

[MP4](walkthrough.mp4) · [WebM](walkthrough.webm) · [媒体与源码摘要 / Provenance](capture-manifest.json)

| 编号 / No. | 画面 / Screen | 截图 / Screenshot |
| --- | --- | --- |
| 01 | 原订单反馈表单 / Owned order feedback | [PNG](01-feedback-form.png) |
| 02 | 回执丢失后保留原内容 / Original pending request | [PNG](02-original-request-pending.png) |
| 03 | 原请求恢复受理 / Original request accepted | [PNG](03-feedback-accepted.png) |
| 04 | 返回后读取本人历史 / Reopened owned history | [PNG](04-reopened-history.png) |

覆盖分类、证明选图/移除、原上传复用、回执丢失锁定、原键恢复、订单筛选、最新状态、无订单历史恢复、未触发交易/修改和320px布局。结果见[验证来源](../../verification/support-source.json)。

```powershell
.\scripts\run.ps1 exec tsx scripts/record-support.ts
```

先构建当前preview。结束后关闭本次浏览器、页面及预览服务；不操作用户已有标签。

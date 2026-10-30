# 客服工作台实际录制 / Actual support desk recording

本录制打开实际服务 `/ops/support`，连接独立测试PostgreSQL和真实本地API。客户、订单、上传图片、客服令牌及回执丢失为合成夹具；接单、回放原请求、发送回复、解决/关闭、对象上传与查看均为实际操作。用户回复由实际本人接口核对，没有将浏览器录制冒充小程序真机测试。

Ten recorded UI checks and four additional native API checks pass. The separate Vitest API attempt timed out without case results; this recording does not replace its status. No real payment, refund, repair, model generation, production identity or native-device acceptance is claimed.

| 编号 | 截图 / Screenshot | 内容 |
| --- | --- | --- |
| 01 | [独立登录](01-independent-login.png) | 未连接前不读取私有队列。 |
| 02 | [授权证明](02-authorized-proof.png) | 实际上传、登记、读取并解码的PNG。 |
| 03 | [原接单待确认](03-original-claim-pending.png) | 已提交回执丢失，保留原键/内容，只准继续确认。 |
| 04 | [客服回复与处理](04-reply-and-resolution.png) | 实际事务回复、版本和处理状态。 |

![客服工作台操作](walkthrough.gif)

[MP4](walkthrough.mp4) · [WebM](walkthrough.webm) · [录制清单/文件摘要](capture-manifest.json) · [需求与使用](../../实施/客服接单回复与处理工作台-v1.0.md) · [精确来源](../../verification/support-desk-source.json)。

本次浏览器、标签页、API和测试数据库连接已关闭；独立测试schema已回收。仅使用本机原生工具，没有Docker、WSL或虚拟机。录制中的访问令牌不会写入媒体清单或仓库。

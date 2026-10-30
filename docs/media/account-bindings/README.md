# 本人两端绑定与共享作品 / Account linking and shared projects

复用实际共享小程序与Plus界面，原生HTTP处理器和临时PostgreSQL数据库真实运行。支付宝/抖音身份、原已付款订单、QA结果和示例PNG为合成夹具，没有真实宿主登录、支付、模型调用或手机相册写入。录制结束关闭所属标签、浏览器、预览服务并删除临时数据库模式。

The actual shared mini-program UI and Plus call native HTTP handlers and a temporary PostgreSQL schema. Host identities, paid-order/QA metadata and the example PNG are synthetic fixtures. This is not device, actual host-login/payment, model or album-save acceptance. Owned tabs, browser, preview service and temporary database schema are closed afterward.

![另一端主动确认、共享作品、选择Plus来源及解除 / Confirm, share, choose source and revoke](walkthrough.gif)

[MP4](walkthrough.mp4) · [WebM](walkthrough.webm) · [SHA256与录制事实 / Hashes and provenance](manifest.json) · [完整方案 / Implementation](../../实施/双平台本人账号绑定与共享作品-v1.0.md)

| 编号 / No. | 截图 / Screenshot | 说明 / Meaning |
| --- | --- | --- |
| 01 | [发起邀请](01-origin-invite.png) | 五分钟有效 / Five-minute invite |
| 02 | [另一端证明](02-peer-proof.png) | 等待发起端最后核对 / Peer proof, no early project rights |
| 03 | [双向确认完成](03-mutual-confirmation.png) | 固定本人关系 / Mutually confirmed binding |
| 04 | [另一端作品](04-bound-projects.png) | 实际来源清单，保存仍需宿主回执 / Source deliverables, device saving needs host confirmation |
| 05 | [选择Plus来源](05-plus-source.png) | 原渠道义务明确 / Explicit source and original-channel responsibility |
| 06 | [Plus共享来源](06-plus-bound-workspace.png) | 电脑标明来源 / Source shown in the workspace |
| 07 | [解除关系](07-revoked.png) | 旧连接在下一操作被拒绝 / Existing connection rejected on its next operation |

复现前先生成匹配当前源码的网页构建，并设置项目内浏览器视频缓存。 / Build the matching preview and select the project-local browser video cache:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'runtime/playwright-browsers'
.\runtime\tools\node\node.exe --env-file=.env.local --import tsx scripts/record-account-bindings.ts
```

使用项目原生Node、PostgreSQL、Edge及FFmpeg，缓存需已有Playwright ffmpeg。首轮私有启动器漏设缓存路径，失败诊断保留；重录复用既有项目缓存，没有下载到用户全局目录。完整13项专项结果另见[精确记录](../../verification/account-binding-source.json)。 / Native tools only; the initial launch-path error is retained, and the retry reuses existing project-local cache.

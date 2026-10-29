# 分类保存与进度恢复 / Selective saving and recovery

实际共享小程序页面录制；商品、清单、权限失败、UNKNOWN与成功相册回调均为显式合成回放，没有写入真实手机相册。支付宝/抖音官方接口接入与真机准入分别记录。原C定型文件及57份既有媒体保留原字节。

Actual shared-screen browser recording with synthetic album outcomes. It does not prove native permissions, actual album files, production QC, real payment or provider operation.

![分类保存与原进度 / Selective album saving and original progress](walkthrough.gif)

[MP4](walkthrough.mp4) · [WebM](walkthrough.webm) · [媒体与源码摘要 / Provenance](capture-manifest.json)

| 编号 / No. | 画面 / Screen | 截图 / Screenshot |
| --- | --- | --- |
| 01 | 整套/图片/视频保存入口 / Save options | [PNG](01-save-options.png) |
| 02 | 图片部分成功与失败 / Partial image success | [PNG](02-partial-save.png) |
| 03 | 返回后恢复原保存进度 / Reopened original progress | [PNG](03-restored-progress.png) |
| 04 | 明确核对后完成本包 / Completion after explicit confirmation | [PNG](04-confirmed-completion.png) |

检查分类选择、只重试失败项、UNKNOWN跳过、页面返回恢复而不创建新会话、取消确认不调用相册、明确未保存后单项重试、文案分离/不重新付款和320px布局。原生数据库/API及宿主回调内核的单独定向结果见[验证来源](../../verification/album-save-source.json)。

```powershell
.\scripts\run.ps1 exec tsx scripts/record-album-save.ts
```

先构建当前preview。脚本结束时关闭本次浏览器、页面和独立预览服务；录屏不替代双端×iOS/Android真机检查。

# 草稿恢复与方案续选 / Draft recovery and exact-spec continuation

共享小程序页面的实际浏览器录像，使用合成商品、档案、清单及仍禁售的官方方案。它展示已有草稿/清单恢复和所选规格的呈现，不代表宿主真机、真实识别、付款或模型质量验收。原C设计和既有媒体保留原字节。

Actual browser recording of shared mini-program screens using synthetic metadata. Official presets remain unavailable for sale. This is UI evidence, not native-device, real recognition, payment or model-quality certification.

![草稿恢复与方案规格 / Draft recovery and selected specification](walkthrough.gif)

[MP4](walkthrough.mp4) · [原始WebM / Original WebM](walkthrough.webm) · [源码、检查及媒体摘要 / Provenance](capture-manifest.json)

| 编号 / No. | 画面 / Screen | 截图 / Screenshot |
| --- | --- | --- |
| 01 | 首页继续原草稿 / Resume from home | [PNG](01-resume-home.png) |
| 02 | 原商品与原清单 / Original matching plan | [PNG](02-original-plan.png) |
| 03 | 服务端商品草稿 / Server-owned drafts | [PNG](03-server-drafts.png) |
| 04 | 可见特征与原规格 / Observed features and exact specification | [PNG](04-selected-spec.png) |

脚本检查首页恢复、原清单匹配、草稿列表、草稿继续、观察特征、禁售规则、原规格导航及320px宽度。照片识别/已售费用与生产隔离不在浏览器回放的验证范围内；完整结果见 [本轮来源](../../verification/draft-resume-source.json)。

```powershell
.\scripts\run.ps1 exec tsx scripts/record-draft-resume.ts
```

脚本要求先完成当前preview构建，使用本次独立预览进程与Edge浏览器；结束时关闭本次页面、上下文、浏览器和预览进程。媒体来源清单核对实际文件字节及所引用的当前源码。

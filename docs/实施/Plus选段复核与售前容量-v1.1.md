# Plus 选段复核与售前容量 / Selected-range review

本补充对应 P01-F18/T18 的视频编辑子项，并遵守 F41/T41、F46/T46、F55/T55 的完整画面、原额度和独立复核约束。沿用方案 C 和现有 Plus 视频工作台、手机确认清单及素材领取页面；本轮没有新增设计单元、组件或交互入口。原需求共58项，完整产品验收范围保持。

## 触发场景与修正

用户从120秒原片中选择第3017帧至3077帧，期望制作60帧的短片。此前原片参考抽帧仍覆盖完整120秒，可能仅因选段之外的画面而超过独立复核图片或Token容量。当前在原视频上按已确认的开始帧（包含）和结束帧（不包含）裁定参考范围，先限定范围，再检测场景变化。

原片参考帧保留绝对帧号及绝对毫秒，成片画面和字幕沿用从0开始的相对时轴。例如原片第3017帧对应成片第0帧。选段首尾、从选段起点每30帧、字幕首/中/末帧及范围内真实场景变化均保留。没有抽取到的中间帧不能冒充已审画面，不因容量不足悄悄稀释采样。

正式成片仍执行原有的全时轴固定抽帧、分镜边界、字幕边界和场景变化补采样。完整商品照片、真实封面、成片文案、有声时的完整双WAV和独立听音继续进入原独立事实/风格复核。

## 收费前校验

在签发新报价前，服务端按冻结的商品照片数量、所选原片范围、字幕/分镜边界和输出图片数计算最低复核画面数，并核对原准入的图片数和Token上限。原片参考及输出画面的像素也须符合原准入上限。

| 条件 | 处理 |
| --- | --- |
| 最低图片数或最低图片Token已超限 | `PLUS_VIDEO_REVIEW_CAPACITY_EXCEEDED`，422；不建立报价或购买调用 |
| 原片或输出画面像素超限 | `PLUS_VIDEO_REVIEW_PIXELS_EXCEEDED`，422；不建立报价 |
| 原片或授权已变化 | 沿用原来源、权限及有效期检查，拒绝旧来源 |
| 实际场景变化、PNG字节或完整上下文在制作后超限 | 原运行时门禁继续阻断；不删帧、不提高原额度，按原失败/退款政策处理 |

售前计算是已知最低容量检查，不能证明任意复杂视频必然通过。它不会提高模型能力、Token、工具次数、费用或原截止；不能以此开启真实服务或销售。

## 封存与兼容

新生成的 `YPCC-PLUS-VIDEO-EVIDENCE-2` 报告写入范围、原片总帧数、采样策略、各参考帧的绝对帧号/毫秒/SHA256。封存、恢复与交付重验这些字段、实际PNG字节、原片来源摘要、字幕边界及必须存在的采样点。越界、遗漏、重复或时间码/来源变化均拒绝。

既有 `YPCC-PLUS-VIDEO-EVIDENCE-1` 报告保留原检查方式，不改写旧包或把历史全原片采样标成新选段证据。已售合同、迁移001–038、公开API和共享客户端契约不变。本轮只改动后端及相关专项，不需要新增迁移。

## 关键验证与交付

检查覆盖真实原生FFmpeg的非整秒起点/颜色切换/范围外场景、完整成片抽帧、售前图片/Token/像素拒绝、120秒原片选取短片后的制作及双复核交付、封存参考越界/缺失拒绝，以及原有有声和静音流程。准确执行结果和源码绑定见 [本轮证据](../verification/video-range-source.json)。

用户身份、付款、模型、语义和进程身份仍为合成控制；真实数据库、HTTPS、MCP和媒体字节不等于真实支付、模型质量、隔离或真机验收。没有界面变化，保留 [既有截图与录屏](../media/plus-video/README.md)，不将旧媒体改标为本轮录制。完整测试和真机不作为本轮快速打包前置条件。

## English

The source-reference sampler now limits sampling to the explicitly selected frame range before scene detection, preserving absolute source frame numbers and timestamps. Final output review still covers its complete timeline, required boundaries and actual scene changes. Original product photos, the actual cover, copy and independently reviewed preserved audio remain required.

Before issuing a quote, the API rejects a known minimum image or token footprint beyond the frozen admission, and rejects source/output dimensions beyond the admitted pixel limit. This is a lower-bound preflight: actual scene changes, PNG bytes and complete context remain subject to runtime checks and the original failure/refund policy.

New evidence version 2 binds the selected range, sampling policy and every source-reference frame hash. Version 1 remains readable without rewriting old deliveries. No public API, schema, database migration, design or client flow changes. Focused native checks do not certify real payment/model quality, production isolation, devices or full-product acceptance.

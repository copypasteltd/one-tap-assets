# 自愿使用反馈与运营明细 / Usage feedback and product insights

实际运行页面：方案C的共享小程序领取页，及 `/ops/metrics` 运营页。运营读真实原生HTTP/PostgreSQL，订单及人员数据是明确合成元数据；小程序反馈使用浏览器内存夹具。均不是双端真机、真实支付、真实识别质量或实际投放证明。

The screenshots and recordings show the actual rendered shared mini-program UI and operations console. Operations use native HTTP/PostgreSQL with explicit synthetic records; buyer feedback uses an in-memory browser fixture. Backend ownership, withdrawal and privacy behavior are verified separately with native API tests.

| 编号 / No. | 页面 / Screen | 文件 / File |
| --- | --- | --- |
| 01 | 全部流量 / All traffic | [PNG](01-all-traffic.png) |
| 02 | 内部测试 / Internal test cohort | [PNG](02-test-cohort.png) |
| 03 | 已标记外部空数据 / Empty marked external cohort | [PNG](03-external-empty.png) |
| 04 | 窄屏运营明细 / Narrow console | [PNG](04-narrow-insights.png) |
| 05 | 自愿选择已使用 / Voluntary usage selection | [PNG](05-feedback-selected.png) |
| 06 | 撤回后继续领取 / Withdraw and retain delivery access | [PNG](06-feedback-withdrawn.png) |

![实际操作 / Actual interaction](walkthrough.gif)

[MP4](walkthrough.mp4) · [WebM](walkthrough.webm) · [原始摘要、快照与清理 / Provenance, hashes and cleanup](capture-manifest.json) · [口径及使用 / Definitions and usage](../../实施/自愿使用反馈与分群运营统计-v1.0.md)。

复录：先构建当前网页与服务端；设置项目内 PLAYWRIGHT_BROWSERS_PATH，再执行 `node --import tsx scripts/record-usage-insights.ts`。该脚本只创建本轮所属Edge页面/临时API和隔离数据库schema，并在finally中关闭、释放；不调用Docker/WSL，不触碰其他用户标签或开发数据库。原始录制快照保留；最终仅生成器改变且应用/成功产物字节相同的关联证据见 [source proof](../../verification/feedback-insights-source.json)。

# 批量商品独立制作 / Independent product batches

实际访问本机 HTTPS、PostgreSQL、私有 PNG 和 MCP 制作链路。三件商品中一件发生草稿版本冲突，两件独立生成清单与订单；只为第一件提交合成付款并运行制作、后期、QC、事实与风格双复核，另一件保持未付款。手机确认、报价和订单通过原生服务接口操作，录像展示 Plus 工作台；不是小程序宿主真机录像。

Actual local services and media execution. Original paid/QA metadata, identity, payment events, inference, semantic verdicts and process identity are synthetic. This is neither real-service admission nor native-device acceptance.

| 编号 | 文件 / File | 内容 |
| --- | --- | --- |
| 01 | [选择三份商品草稿](01-select-three-products.png) | 真实原素材缩略图、冻结版本、逐件风格与价格 |
| 02 | [单件旧版本失败隔离](02-stale-item-isolated.png) | 另外两件继续整理 |
| 03 | [逐件手机确认](03-separate-native-confirmation.png) | 两份独立清单等待原渠道核对 |
| 04 | [一件交付，另一件未付款](04-first-delivered-second-unpaid.png) | 未付款与失败商品不影响已付款商品 |
| 05 | [独立新私有素材包](05-open-independent-private-pack.png) | 新PNG、文案及原有领取入口 |
| 06 | [实际批次商品PNG](06-actual-batch-product.png) | 实际生成文件，非页面截图 |

![批次实际输出 / Actual batch item output](06-actual-batch-product.png)

[MP4录像](walkthrough.mp4) · [WebM原录像](walkthrough.webm) · [GIF演示](walkthrough.gif) · [来源、9项检查和SHA清单](capture-manifest.json) · [实现与限制](../../实施/Plus批量商品独立制作与逐件交付-v1.0.md)。

所属页面、浏览器、临时API及数据库连接池全部关闭。历史171份媒体和方案C原件保留原字节。

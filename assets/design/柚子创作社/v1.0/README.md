# C「柚子创作社」· 设计基线资产 v1.0

产品：一品成片。用户于2026-10-27选择C方向。需求v3.0，设计语义版本1.0.0；尚未实现为小程序。

## 当前使用入口

- [设计定型文档](../../../../docs/设计/定型/C-柚子创作社-v1.0/README.md)
- [C专属参照画册](reference/index.html)
- [原始三页设计稿](reference/C-柚子创作社-原始设计稿.png)
- [首页参照](reference/C-拍照制作.png)、[社区参照](reference/C-方案社区.png)、[领取参照](reference/C-素材领取.png)
- [原始提示词](reference/C-原始提示词.txt)与[来源记录](reference/source-record.json)
- [设计tokens](design-tokens.json)与[CSS变量参照](design-tokens.css)
- [页面注册表](page-registry.json)、[组件注册表](component-registry.json)、[需求设计映射](requirements-design-map.json)
- [对比度计算](contrast-report.json)、[文件清单](baseline-manifest.json)、[核验结果](verification-report.json)
- [完整归档包](../archives/一品成片-C-设计定型-v1.0-20261027.zip)及[归档SHA-256](../archives/一品成片-C-设计定型-v1.0-20261027.zip.sha256)

## 留存约束

原始稿从五方向产物复制，保留原PNG字节，原始SHA-256应为`b919b0de25c4bbab45bafa033f2990a2a40511d5010935815e2c4391a58e4a41`。三张单页为原画裁图，用于查看，不代表独立重画。提示词/来源记录只保存设计信息，不包含网关凭证。

原始稿确定气质。正式实现遵循文档与tokens的修正：果橙配深绿墨按钮字、完整9:16预览、真实动态清单、原生导航与完整业务状态。图中的蓝色榨汁杯和社区例子是虚构设计素材，不自动成为正式商品、官方方案或资质。

基线清单覆盖文档、配置和稿件，排除清单自身与派生核验报告。ZIP包含这些基线内容、清单与当前入口指针；派生核验报告不进入ZIP，避免归档摘要循环依赖。ZIP旁保留摘要，报告单独核验ZIP条目与清单一致。

`design-tokens.css`是设计交付参照，不是已实现组件。小程序实现从JSON映射可用样式，分别保证字号/热区下限和宿主安全区，不把整张设计图当UI代码。

只读核验命令：在项目根目录运行 `python -X utf8 scripts/设计选型/定型C设计基线.py --verify`。不调用模型，不启动浏览器、Docker或WSL。新增视觉修订另建版本，不覆盖原始稿。

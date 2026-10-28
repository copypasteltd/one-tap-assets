# 素材、依赖与许可 / Assets, dependencies and licensing

## 本项目源码 / Project source

本项目API、Worker、客户端、浏览器回放、测试与脚本为独立编写的实现。仓库未选择适用于这些原创内容的统一开源许可证；公开源码或可克隆不自动授予MIT等许可证。该说明不改变下述第三方文件的原有许可。

The API, worker, clients, browser replay, tests and scripts are independently authored. No blanket open-source license has been selected for that original work. Repository visibility/clone access does not imply an MIT or other blanket grant. Third-party files retain their own notices and licenses below.

## one-tap-ads / ClipForge 研究导出

- 来源 / Source: [copypasteltd/one-tap-ads](https://github.com/copypasteltd/one-tap-ads), frozen commit `1aab133dd75f4db57c3f62e6da2fdd121c5d509b`.
- 上游署名 / Upstream attribution: ClipForge, formerly 带货剪手 / daihuo-jianshou; Copyright (C) 2026 xixihhhh.
- 许可 / License: GNU Affero General Public License v3.0; original [LICENSE](assets/research/one-tap-ads/LICENSE.upstream.txt) and [NOTICE](assets/research/one-tap-ads/NOTICE.upstream.txt).
- 范围 / Scope: exported original recipe/prompt text and related research records in [assets/research/one-tap-ads](assets/research/one-tap-ads/README.md). The repository retains 391 recipe records for research with their original provenance; no claim that they were re-run with live models or admitted for sale.

没有将上游生产实现复制进本项目运行源码。研究文本与派生方案的来源、许可和资源权利不能通过重命名项目消除；网络服务化或再分发采用上游内容时须保留对应许可边界。本仓库不为上游素材/人物/品牌权利作额外授权。

Upstream production implementation was not copied into this project’s runtime code. Original recipe/prompt exports retain their upstream licensing and provenance. This repository grants no additional rights to depicted people, brands or external media. See the original license for its terms rather than assuming the project name changes them.

## Noto Sans SC

字体 / Font: Noto Sans SC, bundled at [assets/resources/fonts/noto-sans-sc](assets/resources/fonts/noto-sans-sc/). License: **SIL Open Font License 1.1**; retain [OFL.txt](assets/resources/fonts/noto-sans-sc/OFL.txt). The upstream commit, source URLs and SHA-256 values are recorded in [source.json](assets/resources/fonts/noto-sans-sc/source.json), with upstream `METADATA.pb` retained.

字体用于受控媒体排版与浏览器回放，本地加载，不依赖Google Fonts外部请求。The font is loaded locally for media rendering and the browser replay; it does not require external Google Fonts requests.

## 设计与演示 / Design and demo

[C设计原稿/归档](assets/design/柚子创作社/v1.0/)是本项目经用户选定的设计参考；保留原提示、来源和基线摘要，不作为真实客户成片。公共演示商品[product.svg](docs/media/demo/product.svg)为本项目自绘；配套PNG/短片经Sharp/FFmpeg生成，UI截图/录屏由Playwright捕获。没有使用客户照片或下载第三方视频作为这次公共演示。

The user-selected C design remains a preserved project reference, with provenance and baseline hashes. It is not a customer output. The public demo product illustration is original; Sharp/FFmpeg produce its image/motion fixtures, and Playwright captures the running UI. No customer photographs or downloaded third-party videos were used for this public replay.

## 工具与依赖 / Tools and dependencies

Node、PostgreSQL、FFmpeg、Codex及npm依赖保留各自许可和商标；依赖精确版本见[package.json](package.json)与[pnpm-lock.yaml](pnpm-lock.yaml)。运行工具/数据库二进制不随仓库提交，使用者自行准备原生运行环境。与外部平台连接所需的账号、合同、配额和资源许可不包含在本仓库中。

Node, PostgreSQL, FFmpeg, Codex and npm packages retain their respective licenses and marks. Exact npm versions are recorded in the manifest and lockfile. Runtime binaries/databases are excluded from Git. External accounts, platform contracts, quotas and media rights are not supplied by this repository.

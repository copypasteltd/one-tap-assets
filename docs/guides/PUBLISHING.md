# 仓库发布与后续同步 / Repository publishing and synchronization

[中文 README](../../README.md) · [English README](../../README.en.md) · [协作约束 / Contributing](../../CONTRIBUTING.md) · [当前状态 / Status](STATUS.md)

本项目持续同步到[`copypasteltd/one-tap-assets`](https://github.com/copypasteltd/one-tap-assets)，Git远端为`git@github.com:copypasteltd/one-tap-assets.git`。用户已授权后续正常提交和推送。发布源码与部署云端、启售方案、发布小程序是不同动作，本指南只规定仓库同步。

The user has authorized ongoing normal commits and pushes to this repository. Publishing source does not deploy a cloud service, admit sales or release a mini-program. This guide covers repository synchronization.

## 1. 按变更同步哪些内容 / What to update

| 变更 / Change | 同步内容 / Update | 必要核验 / Validation |
| --- | --- | --- |
| 业务、Worker或恢复逻辑 / Runtime behavior | 源码、适用契约/迁移、调用方、双语README、实现范围与CHANGELOG / Source, affected contracts/callers/migrations, both READMEs, status and changelog | 适用回归及最新源码的完整实现检查；保存来源 / Relevant regressions and fresh implementation verification |
| 共享页面或宿主适配 / UI or host ports | 上述文档与适用截图/录屏/GIF、媒体清单 / Documentation and affected captures/manifests | 双端构建、实际页面断言与复录；真机另验 / Builds, actual page assertions/capture; separate device evidence |
| 媒体内核或示例 / Media pipeline or fixture | 对应实际文件、来源/许可、摘要和说明 / Actual affected files, rights, provenance and hashes | 实际文件检查及对应录制脚本 / Actual file checks and the relevant recording script |
| 需求、设计或Skill契约 / Requirements, design or skills | 权威生成源、产物、绑定与追踪；原C设计不覆盖 / Authoritative generators, artifacts, bindings and traceability; retain C originals | 契约/摘要检查及适用行为验证 / Contract/hash checks and relevant behavior validation |
| 仅说明文字或导航 / Documentation only | 中英说明、相关入口、状态与更新记录 / Both languages, affected navigation, status and changelog | 文档/链接/媒体/源码摘要与暂存检查；不冒称重跑应用 / Docs, links, media/source hashes and staged checks; no fabricated rerun |

所有变更在`E:\dev\sandbox\支付宝黑客松\一品成片`下完成。临时脚本、原始日志与处理文件放入忽略的`runtime/`；不提交`.env.local`、真实凭证、客户照片、数据库、原始支付/供应商报文或依赖缓存。

Keep work under the project root and temporary files under ignored `runtime/`. Never commit credentials, customer media, databases, raw financial/provider receipts or dependency caches.

## 2. 核验与演示命令 / Validation and capture commands

在已按[快速启动](QUICKSTART.md)配置的原生环境中，按变化执行必要检查：

Use the native environment from the [quick start](QUICKSTART.en.md), selecting checks appropriate to the change:

```powershell
# 源码变化 / Runtime-source changes
.\scripts\run.ps1 verify:implementation

# 文档、契约与发布候选 / Docs, contracts and publication candidates
.\scripts\run.ps1 verify:docs
.\scripts\run.ps1 verify:publication
```

`verify:implementation`核对类型、单元、原生集成、服务端与双小程序构建，并写实现索引。源码变化必须绑定最新快照；不能用旧报告、跳过失败测试或放宽预算/超时来宣称通过。文档独立更新时，原测试报告仍属于原执行时间；核对源码摘要一致后可引用，但须明确本轮没有重跑。

`verify:implementation` records types, units, native integration, server and both mini builds. Runtime changes require matching source provenance. Old reports, skipped failures and relaxed business limits cannot certify new source. For docs-only changes, unchanged source hashes allow citing the prior execution while explicitly retaining its original run time.

页面变化先在一个终端启动`dev:preview`，在另一个终端执行：

For changed pages, start `dev:preview` in one terminal and run:

```powershell
.\scripts\run.ps1 build:preview
.\scripts\run.ps1 docs:media
```

页面媒体为实际浏览器捕获的共享小程序页面和合成数据；`docs:media`检查页面及外部请求并关闭浏览器。它不能替代宿主真机、真实付款或模型效果。音频示例用`docs:audio`，可见标识示例用`docs:disclosure`；只更新受影响的媒体，保留未变化的来源。浏览器操作后关闭本次无用标签，完成录制后停止预览服务。

Page captures show shared mini-program screens with synthetic data. The script checks page/network errors and closes its browser; this is not native-device, real-payment or generation evidence. Use `docs:audio` and `docs:disclosure` for their respective fixtures. Retain unchanged media/provenance. Close unused tabs and stop the preview server afterwards.

## 3. 正常提交与推送 / Commit and push

先检查远端，若有未知提交，获取并审查后整合；不要强制覆盖。运行以下只读检查，并确认当前分支和远端：

Inspect remote changes and integrate unfamiliar commits before publishing. Do not force-push. Review the current branch, remote and local diff:

```powershell
git remote -v
git status --short --branch
git fetch origin
git log --oneline --left-right HEAD...origin/main
git diff --stat
git diff --check
```

按实际文件路径暂存，检查暂存内容、凭证排除和当前证据后再提交。多行提交说明写入项目`runtime/`下的UTF-8文本，避免Shell插值改变内容。下面的文件名仅为示例，须先写好实际说明：

Stage explicit reviewed paths and inspect the exact staged diff, exclusions and evidence. Write multiline messages to a UTF-8 file under project `runtime/` rather than interpolating them in the shell. Create the actual message file before using the example path below:

```powershell
git diff --cached --stat
git diff --cached --check
git commit --file runtime/tmp/release-message.txt
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
git status --short --branch
```

提交和推送使用已核对的实际工作分支；上述`main`为本仓库当前分支。`git ls-remote`返回的主分支SHA须等于本地HEAD，且工作树干净后，才能报告“已同步”。网络失败或远端拒绝时如实保留本地提交并报告状态，不宣称推送成功。

Use the verified working branch; `main` is the current repository branch. Report synchronization only after the remote SHA equals HEAD and the worktree is clean. If transport fails or the remote rejects the push, retain the local commit and report the actual state.

Git按原字节存储，不自动转换行尾。冻结C文件、字体许可原文、旧媒体和历史验证来源不得顺手重排；核验检查工作文件与暂存字节一致。

Git preserves exact bytes. Do not reformat frozen design files, upstream font notices, unchanged media or historical proof. Check staged bytes as well as the working files.

## 4. 每轮交付说明 / Round report

每轮至少包含两份带编号表格：已完成/验证结果，以及待完成/下一步。注明当前提交、推送核对和真实范围；源代码存在、合成回归、真实服务准入分别表述。截图/编译通过不等于完整交付，退款请求不等于资金到账。

Each round reports numbered completed/validation and pending/next-step tables, plus the actual commit, push verification and implementation boundary. Separate source implementation, synthetic tests and real admission. Screenshots/builds do not certify delivery, and requesting a refund does not prove financial completion.

文档核验结果见[公开摘要](../verification/publication.json)；原测试来源见[验证说明](../verification/README.md)。完整产品、生产与云端状态继续由实现索引约束，不能因Git推送成功改为通过。

See the [publication summary](../verification/publication.json) and [test provenance](../verification/README.md). A successful Git push never changes full-product, production or cloud-admission status.

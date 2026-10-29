# 一品成片 · 开发协作约束

声音QC更新约束 / Native-audio QC: [文件验收与封存](docs/实施/原生声音文件验收与审查封存-v1.0.md)区分实际PCM/混音/字幕文件检查和未来独立听音。新证据须绑定原ASR与完整双声道、原费用/许可/快照及私有写入；提交重验，保持最终听音/交付与公开声音订单门禁。Technical QC must not waive independent listening or final delivery admission.

当前为需求v3.1、C设计v1.0、开发设计v1.1；应用正在实现，实际源码/测试范围见[源码进度](docs/实施/源码实现进度-v3.1.md)。开发入口见[docs/开发](docs/开发/README.md)，范围优先级见[功能需求](docs/02-功能需求与用户流程.md)，安全见[SECURITY.md](SECURITY.md)。

## 工作区与工具

只在`E:\dev\sandbox\支付宝黑客松\一品成片`工作，命令显式设置该工作目录。代码/文档/缓存/临时媒体都留在此项目，运行产物在runtime；禁止调用本地Docker、WSL、虚拟机、Testcontainers及间接启动脚本。浏览器使用后关闭本次无用标签，不影响用户原有工作。

使用原生进程与受控测试依赖；初始化时才锁定包管理器/版本，一个lockfile。未建应用前不能声称构建/单测可运行，不运行未知上游安装脚本。只读研究克隆不修改，生产采用先记录许可。

## 每次变更

1. 写清用户触发场景、F/T编号、D/K设计单元、工作包和受影响契约。
2. 同步schema、OpenAPI/状态机、调用方、迁移与恢复规则；不可兼容变更保留旧已售快照。
3. 检查鉴权/租户隔离、幂等、未知副作用、原子预算/截止和整包QC，不把界面防连点当事务。
4. 跑与变化相关的必要检查，证据标注真实/mock/NOT_RUN；文档核验不冒称应用通过。
5. 保留设计C原稿/裁图/提示/归档不覆盖，视觉取tokens；只在新版本记录改动。

提交排除真实.env/密钥、个人照片/媒体、数据库、供应商/支付原报文和缓存；脱敏证据留索引。用户已于2026-10-28授权创建并持续同步`git@github.com:copypasteltd/one-tap-assets.git`，每轮完成后执行正常提交和推送，核对远端提交；无需重复确认。远端有新增工作时先获取并审查，禁止强制覆盖。该授权不包含向他人发送消息或发布其他外部服务。

## 文档与远端同步 / Documentation and remote synchronization

每轮功能变化同步中文`README.md`、英文`README.en.md`和双语`CHANGELOG.md`；启动、接口、配置或状态变化同步`docs/guides/`与契约。影响界面时，用`dev:preview`与`docs:media`更新实际截图/录屏/GIF及媒体清单，保留合成数据标识，录制后关闭浏览器。源码变化重新生成适用实现证据，执行`verify:publication`和`git diff --cached --check`后提交并正常推送，报告提交号、远端核对结果和未完成范围。不得把截图、编译或测试替身写成真实服务验收。

The user has authorized ongoing normal commits and pushes to the remote above. Keep both READMEs, the bilingual changelog, affected contracts and guides synchronized. Recapture actual shared-page media when the UI changes; label synthetic data and close browser contexts. Refresh applicable evidence, run publication checks, inspect the staged diff, commit, push and verify the remote commit. Never force-push over unfamiliar work, commit private runtime data, or imply that fixture tests certify production.

Git保留实际文件字节，不自动重写LF/CRLF；`.gitattributes`接受CRLF并检查其他空白。上游OFL原文有一处行尾空格，限定该文件例外，以保全已登记字体资源摘要；不得顺手重排第三方许可证或C定型资产。Git preserves exact bytes for evidence; the attributed upstream OFL notice has a narrowly scoped whitespace exception.

## 完成定义

功能、异常/恢复/权限分支、契约/迁移/文档、适用测试与证据齐备才可标VERIFIED。页面数、模型ACK、付款回调、下载成功分别不能代替完整产品、交付或入相册。58项保持追踪，52项P0全部通过才算完整v3；P1/P2单列。

现有可执行检查见[环境文档](docs/开发/12-配置环境与本地联调.md)。不得为低影响文案变更添加镜像实现的测试，也不反复运行无变化的付费基准。

## Codex契约与Skill变更

当前生成入口为`python scripts/生成Codex开发契约.py`，总核验为`python scripts/核验Codex方案.py`。修改Skill必须更新内容摘要、Bundle/绑定和行为评测版本；本地验证不能假称已真实加载。运行时恢复/回收和双复核证据纳入完成定义。

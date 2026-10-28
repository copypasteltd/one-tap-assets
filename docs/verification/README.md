# 验证与发布证据 / Verification and publication evidence

2026-10-29声音合同源码：**50单元 / 324原生集成**通过，33个集成文件，原始报告跨度约692.94秒。源码/测试/配置摘要316份，运行契约42份，资源4份。本轮声音合同源码先全新执行完整原生集成；构建超时后按全部源码/契约/资源未变的受限重试保留本轮原始通过报告，其余五项重新执行，未沿用上一轮301项。

This audio-contract source first executes the complete native integration suite freshly. After a build timeout, an explicit same-source/contracts/resources retry retains this original passing report and repeats the other five checks; the previous round's 301 cases are not reused. The manifest records 50 unit and 324 native integration cases and 316 source/test/config hashes. Mode: `MINI_BUILD_RETRY_WITH_RETAINED_NATIVE_INTEGRATION`.

| 编号 / No. | 检查 / Check | 结果 / Result | 可审查依据 / Evidence |
| --- | --- | --- | --- |
| 01 | 类型、单元、完整原生集成、服务端和双小程序 / Types, tests and builds | PASS | [实现清单](../../assets/implementation/current.json)，六项命令/原始日志和报告SHA |
| 02 | 声音合同 / Frozen audio contract | 23项专项PASS | 原生PG/实际AAC-PCM/私有文件；授权、ASR响应/用量/HTTPS和付款为合成，不是真实商业授权或语义听音 |
| 03 | ASR / Transcription | 17项专项PASS | 原始购买/回执/费用及实际音轨绑定；外部供应商未准入 |
| 04 | 文档/契约 / Documentation/contracts | 4580项PASS | [契约摘要](contracts.json)，不等于产品验收 |
| 05 | 页面媒体 / UI media | 20个文件原SHA | 10截图、概览、录屏、GIF及静态说明，[原始清单](../media/capture-manifest.json) |
| 06 | 声音媒体 / Audio media | 12个文件原SHA | 四MP4/PNG、源MP4/合成WAV/概览/GIF，[来源](../media/native-audio/capture-manifest.json) |
| 07 | 设计/暂存/发布 / Design and staged publication | 单独核验 | [发布摘要](publication.json) / [暂存审计](repository-audit.json) |

主证据为[实现索引](../../assets/implementation/current.json)，包括原始命令日志/测试JSON的SHA；原始文件位于忽略的`runtime/test-results/`。新声音合同源码全新执行完整集成，不能以此前301项转写或284项声音内核报告替代。类型/编译、合成外部响应与真实服务准入分别记录，完整产品与生产准入仍为false。

本轮首次全量发现已脱敏迟到付款读取已删除合同、旧支付夹具漏写原报价SHA，并在完整结果返回前触及900秒整套上限；失败日志保留本地。修正访问顺序并补齐夹具后，支付/脱敏/流量/声音合同39项专项通过，再全新执行上方完整回归。整套命令上限按实测调整为1200秒，单例120秒/hook60秒、断言、业务预算和截止不变。The incomplete first run is retained and is not counted as a pass; the final full suite is executed freshly after the payment correction.

后续一轮324项断言通过，但Vitest捕获受限修改夹具的未处理心跳拒绝，仍按失败保留。受限修改及媒体夹具均在提交前停止并等待在途续期，串行心跳且保留错误传播；媒体诊断仅附工具状态/错误码并保留原错误类型/码。最终上方结果再次全新执行，未关闭未处理错误检查。An all-assertion pass with an unhandled rejection is not accepted or reused as the final passing run.

再一次完整运行遇到媒体阶段Worker原生异常`0xC0000374`，313/324项报告留存为失败；随后单独复测媒体，再全新重跑上方完整验证，不拼接报告。该异常仍无根因结论，长期Windows原生稳定性和生产准入继续待验。The incomplete crash report and focused retry are not combined into a full pass; a later fresh complete run is required.

The original logs/reports remain in ignored runtime storage with hashes referenced publicly. This native contract suite freezes authorizations, captions/music, costs and complete-track ASR limits; it does not register an audible order tool or remove sales guards. Fixed prepaid-license allocation is internal accounting, not an external license purchase.

本轮没有修改前端、后期媒体内核或录制脚本，沿用已核验的Vite回放构建、10页断言和相同媒体SHA；没有打开浏览器。页面录像不是支付宝/抖音真机或Plus，声音录像仍为合成提示音/人工时间码，不改标为真实ASR或商业人物样片。C基线25份和冻结归档保持原字节。发布另核对全部文档本地链接、媒体/源码摘要、Git暂存字节、忽略项及有限凭证模式，不能替代真实物理隐私或完整密钥审计。

No browser was opened. The unchanged UI and audio media retain their original provenance. Publication checks inspect local links, registered media/source hashes, staged bytes, ignore rules and limited credential patterns.

## 历史验证来源 / Historical provenance

上一轮持久转写源码全新执行301项原生集成，首次支付宝构建启动180秒超时，再按全部源码/契约/资源不变的显式受限重试保留原始通过报告，其他五项重跑。更早声音内核轮为284项；这些报告均不替代本轮源码的完整回归。`--retry-mini-builds`只允许受限构建/核验器变化，拒绝应用/测试变动，核对源路径/摘要、契约/资源与原始报告/日志；默认六项全新执行。

参考整片未核验购买的[先红后绿摘要](../../assets/implementation/regressions/reference-video-gate.json)保留旧网关基线提交、旧源码SHA和原始失败/通过报告摘要；原报告保留本地。声音内核轮完整284项包含15项声音专项；此前无声整包/身份/MCP轮为269项。这些是历史记录，当前全量见上方。The red/green record preserves the old gateway baseline and report digests, while the full integration run verifies the current source. The previous publication round established the 720-second full-suite ceiling after an observed 480-second timeout; individual assertions and per-test limits remain unchanged.

文档契约核验使用`verify:docs`，发布前另核对C基线、归档和Git暂存字节与工作区证据一致。需要重现时按[快速启动](../guides/QUICKSTART.en.md)准备原生环境，再运行README中的命令。Reproduce through the native setup guide; contract/document checks are distinct from application acceptance.

上一轮生成式无声专项新增7项整包/故障/恢复用例；社区SAMPLE仍完整执行13项。首次全量回归定位并修正了共享合成驱动对订单/独立样例输入形式的兼容问题，失败日志保留本地。实测269项串行原生集成接近12分钟，当前整套命令上限900秒，单例断言/时限和业务费用/截止约束不变。Seven new silent generated-pack cases and all thirteen SAMPLE cases execute in the full suite. An initial fixture-input compatibility failure was preserved and corrected before a full rerun. The measured native suite approached twelve minutes; its command-level ceiling is now 900 seconds, with individual assertions/timeouts and business limits unchanged.

上一轮上一轮最终构建修复仅改动`mini-config.cjs`的压缩执行方式和核验器；支付宝CSS并行worker的180秒超时留存本地，改同进程压缩后完成。实现索引的`verification_mode`/`retained_integration`明确记录原269项完整集成、源摘要和日志/报告SHA；最终类型/50单元/服务端/双端构建重新执行。重试命令只允许这两个构建文件变化，核对全部源码路径/摘要与契约/资源，拒绝业务变化、缺失/改变的原日志/完整报告或运行中源码变化；新增业务文件的拒绝用例已实际执行。默认命令仍全量执行，不自动复用。

The previous round's build-only retry records the complete 269-case native run and its original digests explicitly. Only `scripts/mini-config.cjs` and the verifier may change; all application/test paths and hashes, contracts/resources and original passing reports/logs are checked. Type/unit/server/mini builds execute again. A real added-source rejection probe passed. Missing/changed evidence or application changes reject reuse; the default command remains a fresh full run. This build configuration executes the same CSS minification in-process after a worker-mode timeout; it does not disable compression or change product UI.

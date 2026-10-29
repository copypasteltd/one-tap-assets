# 验证与发布证据 / Verification and publication evidence

2026-10-29独立听音基础源码：**64单元 / 342原生集成**通过，34个集成文件，完整原生报告跨度约1957.89秒。源码/测试/配置摘要333份、运行契约42份、资源4份。本轮听音源码先全新通过342项完整原生集成；支付宝CSS压缩600秒超时后，仅修改小程序压缩配置为CSSO（保留压缩与规则顺序），逐字节确认应用、测试、验证脚本、运行契约及资源未变，保留本轮完整原生报告并重跑其余五项；最终类型、64项单元、服务端及双小程序构建通过。未复用上一轮336项或定向跳过报告。

This round freshly passes all 342 native cases. After Alipay CSS processing times out at 600s, only mini CSS minimization changes to installed CSSO with rule order preserved. Application, tests, verifier, contracts and resources match the native run byte-for-byte; its original report is retained while the other five checks repeat. Types, 64 units and all builds pass. No prior-round 336-case or focused skipped report is reused. Mode: `MINI_BUILD_RETRY_WITH_RETAINED_NATIVE_INTEGRATION`. Actual native PostgreSQL/FFmpeg/media and HTTPS/stdio/MCP execute locally. Model, semantic observations, authorization, usage, payment and isolation responses remain explicitly synthetic.

| 编号 / No. | 检查 / Check | 结果 / Result | 证明范围 / Scope |
| --- | --- | --- | --- |
| 01 | 类型/单元/完整原生集成/服务端/双小程序 | 六项PASS，原生保留本轮完整报告 | [实现索引](../../assets/implementation/current.json)，不是生产准入 |
| 02 | 独立听音基础 / Listening foundation | 6项单元与6项新增原生PASS | 双完整音轨/全部画面、原费用/请求/SSE、UNKNOWN不重买、保存响应恢复、缺证/缓存/撤权 |
| 03 | 有声制作/POST/文件QC | 原12项原生及4项封存单元PASS | 实际原整轨/ALAC/AAC、原ASR、混音重算、实际字幕帧和私有封存；与6项新增共同组成18项订单专项 |
| 04 | 原声音基础 | 23 / 17 / 15项原生及4项声道单元PASS | 合同/许可/原费用、持久ASR和独立后期内核，真实中文未验 |
| 05 | 文档与契约 | 4641项PASS | [报告摘要](contracts.json)，不代替功能执行 |
| 06 | 页面媒体 | 20文件原SHA | 10截图、概览、WebM/MP4/GIF和说明，[来源](../media/capture-manifest.json) |
| 07 | 声音媒体 | 12文件原SHA | 四样式MP4/PNG、源视频/合成WAV/概览/GIF，[来源](../media/native-audio/capture-manifest.json) |
| 08 | 发布与暂存 | 独立核验 | [发布摘要](publication.json)、[暂存审计](repository-audit.json) |

本轮测试的听音语义明确为INSUFFICIENT：合成提示音不能伪称中文口播。模型和用量响应为合成，实际请求中的完整双声道和画面字节由原封存SHA核对。新组件尚未被最终Codex阶段调用；材料/推理/工具证明/双报告和有声事务交付仍待接入。最终事实/风格报告及交付继续INDEPENDENT_AUDIO_REVIEW_REQUIRED，公开声音订单继续NATIVE_AUDIO_NOT_ADMITTED，全部禁售。

Synthetic tones explicitly yield insufficient listening observations. The private protocol/receipt/ledger foundation is not final semantic approval or an integrated audio-delivery chain. Cached usage without accurate allocation stays UNKNOWN; it is never treated as free or a replacement purchase.

本轮局部运行、完整运行和构建失败/重试的私有日志仅发布[来源摘要](listening-attempts.json)。定向探索运行8项通过/10项跳过，发生在最后应用源码修订之前，不作为最终版本验收。完整342项运行前的[333文件原始摘要](listening-native-source.json)与原失败实现记录一致；最后源码相较原生运行仅有 `scripts/mini-config.cjs` 的已核对CSSO设置变化，其余332文件、验证脚本及全部运行契约/资源完全未变。原生JSON与原日志逐字节保留，其他五项重新执行；没有增加600秒窗口、关闭CSS压缩或复用上一轮336项。

旧声音文件QC的失败、超时和受限构建重试保留在[历史来源](native-qc-attempts.json)及其Git历史说明。完整串行原生命令上限3600秒；单元整套360秒/单例30秒、通常原生单例120秒、完整往返/新增听音整链240秒、POST撤权180秒/hook60秒/RPC30秒/类型与服务端180秒、小程序整套600秒和业务预算/截止/配额保持约束。

无浏览器调用；前端页面/录制来源与声音内核未变，仅小程序CSS构建压缩器改变，宿主真机仍待验。原截图/录屏/GIF、声音媒体及C设计25文件/归档原字节保留。私有日志、数据库、密钥及媒体缓存保持忽略。

真实中文/口型/模型/账单缓存/授权、多人、最终音频双复核与事务交付、Codex受限运行/清理、支付与OSS、四组真机、完整社区/售后、全变体基准及Plus仍待完成。58需求/52P0、三路线、10风格/14变体继续保留；完整产品及生产准入为false。

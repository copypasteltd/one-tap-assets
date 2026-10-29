# AI可见标识与逐帧文件验收 v1.0

2026-10-29｜需求 v3.1 / 开发契约 v1.1 / C设计 v1.0。对应已有 P01-F40 声音与AI标识策略，不新增或缩减58项需求。此文区分实际文件检查、合成整包控制回归与真实模型/宿主准入。

## 实际缺口与范围

原生字幕内核原本已经在右上角绘制“AI 演绎”。本次补齐的是：统一的报价冻结策略、全部生成式交付图片及视频覆盖、完整帧像素验收、原清单恢复/事务重验与最终审查包绑定。它不替代宿主内容声明、平台审核或适用规则的实际准入。

官方 `portrait-social.ai-presenter-multi` 的中文名称是“AI连续多镜”，要求统一人物与跨镜商品稳定，**不是必须多个说话人**。早期实施文档中的“官方多人”不应成为该P0变体的新增完成条件；真正尚待验的是连续多镜、真实人物/声音授权、实际中文质量、完整输入容量和全规格基准。额外多人物/多声音扩展仍需独立设计与准入。

| 编号 | 原有变体 | 冻结完整时长 | 本次实际消费 |
| --- | --- | --- | --- |
| 01 | quiet-luxury.ai-detail | 450帧 / 15秒 | 图片和逐镜整包视频标识 |
| 02 | fresh-daily.ai-scene | 360帧 / 12秒 | 图片和逐镜整包视频标识 |
| 03 | portrait-social.ai-presenter-single | 450帧 / 15秒 | 图片及原生有声视频标识 |
| 04 | portrait-social.ai-presenter-multi | 450帧 / 15秒 | 图片及连续多镜原生有声视频标识 |

表格是冻结规格与源码支持范围，不能代替四变体真实模型整包验收。10风格/14变体、3路线、58需求/52P0及全部禁售保持不变。

## 报价、付款与旧订单

平台在 `createQuote` 中编译 `ai_disclosure_contract`，纳入已有私有订单合同SHA。它冻结 `YPCC-VISIBLE-AI-1`、固定“AI 生成”文字、左上位置、全图片/全视频帧覆盖、字体与许可、C墨绿/奶白颜色、几何、原计划SHA及源方案/清单SHA。社区作者只能声明需要标识，不能提供任意文字、字体路径、过滤器或关闭生成式标识。

原图路线不加生成式标识、不改变原合同字节或原图排版。生成式旧合同缺少完整策略时，在创建订单、生成预算门禁、执行上下文/快照、制作和恢复入口明确拒绝；不补写历史订单、不通过新renderer键绕开原检查点，也不为标识重新购买模型。新策略随正常新报价冻结；未决外部调用仍按原意图恢复，不借此增加额度/截止。

没有新增数据库迁移、公开DTO字段、客户表单或小程序交互。策略由既有私有合同摘要保护；素材和封存包仍绑定原执行快照。单次媒体完整检查上限为3600帧、全部灰度区域96MB；当前四官方变体均在该容量内，不能因此宣称模型完整上下文容量已准入。

## 实际制作与后期

标识在1080参考宽度下使用32像素边距、224×72像素底色和30像素字体，其他图片尺寸等比例计算。颜色固定为C定型值 `brand.ink=#263B32` / `brand.cream=#FFFAEE`，字体为原订单绑定的 Noto Sans SC/OFL。照片印样的生成式页脚明确写“AI 生成素材”，不再将生成图称为“商品实拍”；原图页脚不变。生成式叙事版的章节装饰为标识留出空间。

生成图片先按原方案排版，再覆盖平台固定标识。逐镜/整片视频在生产组装时按每帧叠加固定栅格，POST继续保留；不能依赖供应商自行返回水印。原生声音生产仍从原镜头解码PCM、单位增益组装无损ALAC，后期仍使用原整轨ASR、ASS、许可配乐和AAC。标识只进入视频滤镜，不改变音轨来源、费用、字幕脚本、PCM或混音验证规则。

原生ASS已有的右上“AI 演绎”保留，统一可验标识放左上，避免彼此覆盖；原字幕/音轨内核及既有演示媒体源码不修改。首次整包定向回归准确捕获了右上标识冲突，随后调整位置，未放宽像素检查阈值。

## 文件检查与可恢复证明

`inspectDisclosure`不消费模型自评，也不相信“已加水印”的布尔值：

1. 用冻结字体重新渲染实际平台标识。
2. PNG读取完整标识区域，要求与预期RGBA字节完全一致，包括不透明Alpha；缺字、空白底色或藏在透明像素中的相同RGB都无法通过。
3. 视频使用原生FFmpeg完整解码标识区域，读取恰好原时间轴全部帧；多帧/少帧均拒绝，不能只检首尾、每秒或镜头边界。
4. 逐帧灰度平均绝对差不超过12，预期亮字像素匹配比例至少94%；这是经过H264的固定图样检查，不是OCR/法律合规或完整可读性认证。
5. 记录实际完整像素SHA、标识栅格SHA、原策略SHA、实际文件SHA、区域、完整帧数和最差差异/匹配指标。

每个生成式制作/POST产物的 `ArtifactSpec.ai_disclosure` 保存平台实际证明。恢复会重读实际媒体、重新扫描全部标识区域，并逐项比较原证明；缺证明、替换策略/字形、单帧消失或换字节均阻断。视频多槽位相同字节可在一次检查中复用计算；不同文件仍分别检查。

原信号和绝对截止传到实际原生命令。扫描在项目 `runtime/` 内创建私有临时目录，成功/失败都回收；取消/过期在创建进程前检查。媒体事务提交重读实际字节并校验原策略/证明/文件SHA，不能靠准备后替换文件通过。

## QC、最终复核和交付

专项检查实际复现了旧RGB比较的缺口：保留字形RGB、把区域Alpha设为0，会错误接受不可见标识。修复改为完整RGBA比较；同一透明PNG由错误接受转为`AI_DISCLOSURE_PIXELS_MISSING`，并纳入已有图片原生用例。修复前第二次运行已通过350项原生及服务端构建，但双小程序构建因本修复主动中止，不能作为最终版本验收；修复后的339份源码另行冻结并完整重跑。

QC对生产和POST完整清单运行对应媒体验证器，并把冻结标识策略和每个真实产物证明写入既有私有CONTRACT证据。最终事实/风格角色读取原全包实际画面和封存文本；不可变报告绑定同一审查包。原生听音、推理/工具证明及双报告的原预算/UNKNOWN恢复与许可撤权规则保持有效。

交付再次读取实际文件并执行对应验证器；事务核对原订单/报告/文件，授权下载继续核对文件SHA。因此相册领取到的是带标识的文件，不能依赖网页层叠字。示例/售后中尚未接通的生成式能力仍按原门禁拒绝，不借标识功能提前开放。

## 运行与验证

```powershell
.\scripts\run.ps1 test tests/unit/disclosure.test.ts
.\scripts\run.ps1 test:integration tests/integration/disclosure.test.ts
.\scripts\run.ps1 docs:disclosure
.\scripts\run.ps1 verify:implementation
.\scripts\run.ps1 verify:docs
.\scripts\run.ps1 verify:publication
```

五项单元覆盖四官方原规格、作者关闭拒绝、历史缺合同阻断、策略/字体/清单变更和原图字节保留。三项原生专项使用真实PNG、固定字形和1080×1920/15秒/450帧视频，覆盖正确标识、缺字/空白、单独帧索引225（从0计）消失、取消/截止与目录回收。已有两条无声及两条有声整包用例进一步检查最终文件的策略SHA、文件SHA和完整帧数。

定向结果不能冒称完整套件通过；本轮最终计数、命令和源码摘要以[公开验证记录](../verification/README.md)及[实现索引](../../assets/implementation/current.json)为准。[可复录媒体](../media/ai-disclosure/README.md)是自绘商品和原生静帧视频，仅展示实际标识与像素验收；没有调用真实生成模型或证明官方广告质量。

完整运行曾在社区样例五角色证据校验处偶发失败，原样单例复查通过。独立的合成重复PID探针确认测试启动器只用PID会产生创建标识碰撞，因此仅将合成进程引用补绑原启动nonce，保留生产五角色门禁、断言及全部时间上限。修正后样例完整13项通过，再重新冻结339份源码跑完整六项。原失败的具体子条件及实际PID复用未被保存证实，不能把探针结果当作它的已证实根因；失败、定向与最终运行分别记录。

## English summary

The platform freezes a visible `AI 生成` raster policy inside the existing immutable private quote/order contract. Generated images and every video frame carry the mark; actual PNG pixels and all decoded video crops are checked against the pinned licensed glyph raster. Recovery, media commit, QC, sealed final-role inputs and publication bind the same policy and file hashes. Missing historical contracts are blocked without rewriting sold inputs or buying models again. Original-photo files and the native caption/audio kernel remain unchanged.

The official “multi” variant means continuous multi-shot production, not a mandatory multi-speaker feature. Real model/voice/rights/input-capacity/device acceptance remains outstanding. Pixel fixtures, synthetic semantic controls and compilation do not certify host/legal marking compliance, commercial admission or the complete product.

An intermittent sample-completion guard failure is retained separately from its passing unmodified focus. Synthetic repeated-PID control exposes a collision in the test launcher's PID-only reference; binding the original launch nonce fixes that control. The full 13-case sample file passes before the new complete run. Production five-role guards and deadlines remain intact. Actual PID reuse and the precise original failed subcondition are unproven; the control is not production isolation evidence.

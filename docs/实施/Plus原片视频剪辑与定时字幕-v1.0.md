# Plus 原片视频剪辑与定时字幕 / Source-video editing

2026-10-31新增：[Plus选段复核与售前容量](../实施/Plus选段复核与售前容量-v1.1.md)与[本轮证据](../verification/video-range-source.json)。原片按用户选段取参考且保留绝对时间，成片仍完整验收；报价前拒绝已知容量/像素超限，v2封存核对选段/字节/边界，兼容旧v1。3项新增专项通过，4项同应用原流程证据保留；类型/server/Plus通过，双端未重编、全套未运行，无新界面或录制。完整产品/真实服务/云端/真机继续未完成。


一品成片继续以支付宝、抖音小程序为核心：拍照、识别、预设选择、确认清单及费用、主动付款和领取素材都在手机完成。Plus 提供已交付视频的深入编辑，形成独立草稿和独立订单。它使用真实原视频，不将图片轮播标成原片剪辑。

## 用户流程

1. 在电脑 Plus 生成接续码，单独勾选「允许整理原片视频剪辑清单」，再回本人原小程序查看权限并主动批准。只有图片制作权限的旧连接不会自动增加视频权限。
2. 打开本人已交付素材包，选择视频，建立视频剪辑草稿。也可从「视频剪辑」重新打开已保存草稿。
3. 播放原片、移动时间游标，以30帧精度选取1至60秒；设置画面裁切、偶数像素尺寸、标题、可选品牌和补充事实。
4. 选择保留或关闭原声，添加按片段时间排序的台词字幕或画面文案。字幕时间从剪辑后成片的0秒开始，不能重叠或超出选段。保存产生独立不可变修订；相同保存重试返回同修订，旧修订写入被拒绝。
5. 选择已准入风格，整理当前已保存修订的制作清单。切换风格采用该风格的原 Skill、字体和版式；原片选段、字幕、声音选择及计价版本冻结。
6. 回手机「账户与隐私 → 接续到电脑 Plus → 电脑视频制作清单」，核对选段、裁切、全部字幕、声音和完整价格，主动建立独立订单并付款。
7. 内容梳理、实际制作、后期、文件预验收与独立事实/风格复核沿原阶段链路运行，最后交付MP4、从该MP4真实首帧提取的PNG封面、配套文案。手机继续使用原领取与相册保存能力，电脑可打开新素材包。各阶段实例在结束后释放。

电脑预览显示原片、裁切、选段和字幕位置；正式产物按所选风格排版，预览并不代表已编码或已通过复核。电脑不直接扣费，也不会覆盖原订单、原片和已售权益。

## 实现边界

| 项目 | 当前约束 |
| --- | --- |
| 原片 | 本人当前有效已交付MP4；封存H.264、yuv420p、30fps、30至3600帧、实际字节数及SHA256；如有音轨须为AAC；最大512MB |
| 选段 | 1至60秒；完整帧范围；开始包含、结束不包含；不改变速度 |
| 输出 | 宽高256至1920偶数像素，总像素不超过2,073,600；MP4 H.264/yuv420p/30fps；同尺寸PNG首帧封面 |
| 字幕 | 最多40条，每条最多200字；真实字体排版最多2行，超出拒绝；定时烧录到视频画面 |
| 台词与文案 | `SUBTITLE`必须与实际声音核对；`ON_SCREEN_COPY`按画面文案核对商品证据。用户文字始终是待核对补充，不等于自动转写或模型观察事实 |
| 声音 | `PRESERVE`保留实际原音轨选段；`MUTE`明确删除音轨。原片本身无音轨时不生成声音 |
| 有声时长 | 受冻结的独立听音能力限制；现有准入协议上限30秒，不能因剪辑支持60秒而提升服务协议。报价前拒绝超出听音能力的选段 |
| 免费受限修改 | 继承独立新订单的48小时、一次、单独预算协议；此路线仅支持配套文案修改，音视频与字幕保持原字节；重新剪辑或改变字幕须另立制作清单 |
| 当前未含 | 自动ASR成字、分轨混音、多轨拼接、转场时间轴、速度变化、作者高级工具、长期账号绑定 |

## 合同与持久化

迁移038为原Plus连接/会话增加独立的 `allow_video_render_plans`，默认为false；为原草稿和制作请求增加 `media_kind`。图片接口只读取image，视频接口只读取video，继续使用原隐私删除和过期清理链路，无需复制账户或支付体系。

`YPCC-PLUS-VIDEO-1`冻结原订单、商品、交付清单及修订、原视频文件及检测证明、原制作合同、AI来源属性、草稿修订和设置摘要、当前风格基础配置摘要、独立价格/版本/总预算、明确的听音模型版本。客户端不能提交对象路径或自由选择付费模型。商品输入变化、删除、原订单撤销、来源过期、新交付修订或权限关闭都会按现有所有者锁重新核验。

新订单执行子类型为 `creative_components.plus_video`。它复用 `PHOTO_LAYOUT` 的原片排版能力，但由专用 `PlusVideoMediaPipeline`执行视频解码、按帧裁切、排版、定时字幕、声音和封面处理；不会触发生图、生视频或新配音调用。它具有独立的 `YPCC-QC-PLUS-VIDEO-1`文件规则。原风格及Skill仍绑定原版本，不静默替换路线。

后期保留制作音轨，以流复制方式清理容器元信息，文案单独存储。若原片有AI来源标识，则正式视频所有帧及封面均重新保留可见标识和对应字节证明。

## 声音与复核

保留原声且原片有音轨时，在报价和建单前确认已准入听音模型、服务有效期、时长上限、明示价格以及独立总预算。总预算须覆盖原阶段Agent成本、免费受限修改和最多两次独立整包听音，不刷新原付费订单的预算和截止时间。

验收将实际原视频所选段及实际成片解码为完整48kHz、双声道、16bit PCM，封存两份完整WAV；对实际AAC解码结果与原选段PCM做相关性及信噪比比对。静音选段有明确的静音比对路径。该技术比对不等于听懂内容。

完整WAV、实际视频逐秒/场景切换/字幕边界帧、原片参考帧、商品照片、手填字幕脚本和检测报告进入同一封存包，交给独立听音服务。继续使用原请求、费用预留、UNKNOWN核对、真实回执用量结算和复核输入绑定。事实与风格两位复核者都必须消费同包已结算听音证据，缺失或不充分会阻止交付。此路线不产生或伪造 `TRANSCRIPT`证据。

静音交付仍须完成画面、字幕、商品事实、规格和双角色复核，但不会购买听音或生成配音。已交付有声订单的受限文案售后读取原已付听音及封存证据，不重新开启原已到期生产任务。

## 服务配置与接口

所有开关默认关闭。运营侧必须在独立准入后设置下面的环境项；不能将本地合成夹具的模型和费用用于线上。

| 配置 | 用途 |
| --- | --- |
| `PLUS_VIDEO_RENDER_ENABLED` | 视频独立制作是否开放 |
| `PLUS_VIDEO_RENDER_PRICE_FEN` | 此版本独立价格，人民币分 |
| `PLUS_VIDEO_RENDER_PRICING_VERSION` | 不可变计价版本 |
| `PLUS_VIDEO_RENDER_BUDGET_MICRO` | 新视频订单的完整费用上限，人民币微元 |
| `PLUS_VIDEO_LISTENING_MODEL_VERSION_ID` | 明确的已准入QC听音模型登记；保留实际音轨时必须存在 |

基础交易、Codex运行时与图像复核、原风格、Skill、字体、资源许可和隐私门禁继续有效。使用听音时还须启用已核验的听音服务及其原费率协议。

| 方法与相对路径 | 功能 |
| --- | --- |
| `POST /plus/video-drafts` | 从本人有效交付视频建立草稿 |
| `GET /plus/video-drafts` | 本人视频草稿分页 |
| `GET /plus/video-drafts/{draft_id}` | 校验来源并读取草稿 |
| `PUT /plus/video-drafts/{draft_id}` | 乐观修订保存 |
| `GET /plus/video-render-styles` | 已准入风格及独立价格 |
| `POST /plus/video-drafts/{draft_id}/render-plans` | 显式授权后冻结当前修订制作请求 |
| `GET /plus/video-render-plans` | 本人视频制作请求分页，手机也可读 |
| `GET /plus/video-render-plans/{request_id}` | 手机确认详情、规划及原渠道订单进度 |

这些接口统一位于原 `/v1/p01` 前缀；报价、订单、支付、退款、交付和相册保存继续使用原手机接口。完整生成契约见[接口目录](../../assets/development/v1.1/contracts/endpoint-catalog.md)。

## 验证与交付

本轮采取快速功能收口：围绕单个真实视频选段到新交付包的关键链路验证，再执行打包必需的类型和四类构建，不以全面测试绿灯作为交付条件。最终执行结果、确切源码摘要和媒体来源由[当前状态](../guides/STATUS.md)及[视频剪辑证据](../verification/plus-video-source.json)记录。

本地夹具实际运行原生PostgreSQL、HTTPS、MCP和FFmpeg媒体处理；账户、原交付元数据、付款事件、Agent/听音语义回复、进程隔离身份为合成。真实声音样本中仅有合成提示音，这些材料不能证明中文口播质量、真实支付、线上模型效果或生产隔离。真实服务、销售和云端部署必须独立完成准入。

## English

Plus edits an owned delivered video through a separately approved temporary connection. Save a frame-exact trim, crop, even-pixel canvas, title, optional brand/facts and up to40 non-overlapping timed cues. The original mini-program displays the complete frozen selection, audio mode, captions and separate fee before explicit payment. The existing stage/Skill workflow produces an actual edited MP4, a PNG extracted from its first frame and copy, followed by deterministic QC, independent factual/style review and private delivery.

Source footage must be sealed H.264/yuv420p/30fps MP4 with AAC when present. Silent edits support1–60 seconds; audio retention is bounded by the separately admitted listening contract, currently at most30 seconds. Full selected-source and final audio are sealed as48kHz stereo WAVs, technically compared and independently listened to using the original paid-request/settlement/UNKNOWN workflow. Both reviewers require the same settled listening evidence. Manual cues remain unverified input; this feature does not claim automatic ASR. Explicit mute removes the audio track without buying listening.

Migration038 adds a default-false video grant and image/video discriminators in the existing Plus tables. Versioned bindings freeze source provenance, settings, price, budget and listening model. All switches default to off. Copy-only limited aftercare preserves all delivered audio/video/subtitle bytes and reuses the original paid listening evidence. Advanced multi-track editing, automatic transcription, permanent identity linking and cloud production admission remain pending.

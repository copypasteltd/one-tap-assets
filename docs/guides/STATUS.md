# 当前交付与功能状态 / Delivery and functional status

2026-10-30新增[原订单取消与退款](../实施/订单取消与原支付动作-v1.0.md)：订单页支持付款前取消、已付款排队取消及原路退款进度，制作开始后转售后。旧支付动作每次重验原单，UNKNOWN只查单；取消后迟到付款只记一次并申请一次退款。17单元/6原生API和9项浏览器操作通过，真实交易与真机仍待验收。

2026-10-30新增[草稿恢复与方案规格续选](../实施/草稿恢复与方案规格续选-v1.0.md)：首页恢复本人有效草稿，素材页列出服务端草稿；已有档案无需本地分析编号。先选方案后拍照保留方案/规格的四版本引用，可继续原清单或原规格，禁售/失效不换版；17项单元和3项原生API检查、8项浏览器操作通过。真实登录/模型与真机仍待验收。

2026-10-30更新[逐张拍照与原上传批次](../实施/逐张拍照与原上传批次-v1.0.md)：支持逐张拍摄、相册补图、单张重拍和移除，保留取消前照片；凑齐3–5张后开始识别。同批次换图禁止覆盖原上传，新照片组清除过期的本地跳转引用。10项定向检查、6项共享页面操作检查通过；真机授权仍待验收。

2026-10-30新增[生成式受限修复与原素材复用](../实施/生成式受限修复与原素材复用-v1.0.md)：两条无声生成路线已连接选择性重制、已结算原素材复用、新参考身份核验、新文件与双新复核交付。2项定向用例通过，7项旧用例本轮未选；外部模型与计量为合成响应。原订单限制保持冻结，原生口播修复、真实服务与真机验收仍待完成。

上一轮原图专项（保留原验证来源）：[原图候选修复与重新验收](../实施/原图候选修复与重新验收-v1.0.md)：失败证据定位、CONTENT受限改稿、实际新文件、新封存包、双新复核及交付已接通，2项定向原生集成用例通过。原订单预算/截止/调用上限保持冻结；原生口播修复、真实服务和真机仍待完成。

2026-10-30：按用户要求加速主要功能收口，采用有界构建、核心冒烟和交付包核验，不等待全面测试绿灯。58项需求/52项P0、三路线、10风格/最少14变体和C设计继续保留。当前为源码与实际成功构建候选交付，原生口播修复、真实服务、真机及云端仍有缺口。

The user requested focused delivery without a full green suite. Functional scope and the frozen design remain; this source/build candidate does not certify the complete product or production.

## 本轮交付 / This delivery

| 编号 / No. | 实现 / Implementation | 结果 / Result |
| --- | --- | --- |
| 01 | 原生初始化、自检 / Native setup and doctor | `setup-local.ps1` / `doctor` |
| 02 | API、Worker、回收器和媒体维护 / Owned four-service startup | `local:start`, readiness and owned shutdown |
| 03 | 共享小程序页面回放 / Shared-screen replay | `preview:serve`, loopback static server |
| 04 | 独立构建和逐项日志 / Isolated builds and exact logs | `delivery:build --smoke`, bounded per command |
| 05 | 源码、文档、媒体及成功产物ZIP / Source and available outputs | `delivery:package`, per-file SHA-256 |

当前绑定 / Current binding: 383 source files / 42 contracts / 4 resources; aed288b2。

| 编号 / No. | 检查 / Check | 实际结果 / Actual |
| --- | --- | --- |
| 01 | 类型 / Typecheck | PASS |
| 02 | 原订单动作/原生API / Focused unit and API | 17 unit + 6 API PASS / 0 FAIL |
| 03 | 共享订单页面 / Browser order flow | 9 PASS; 4 PNG + MP4/WebM/GIF; native device unverified |
| 04 | 自检/后端/页面服务 / Doctor/backend/replay | PASS / PASS / PASS |
| 05 | server build | PASS |
| 06 | preview build | PASS |
| 07 | alipay build | PASS |
| 08 | douyin build | PASS |
| 09 | 全面测试/真机/真实服务 / Comprehensive/device/live | NOT_RUN / NOT_ADMITTED |

只有本轮成功目标纳入构建交付目录，超时/失败目标保留源码及重建命令；不使用旧产物补位。完整测试及原发布检查本轮未执行，历史失败仍见[原费用来源](../verification/repair-cost-native-source.json)。本轮补录原订单取消与退款页面4张截图和MP4/WebM/GIF，新增7份媒体；50份既有媒体及C定型稿按原摘要保留，共核对57份媒体。

Only successful current builds enter the package; failed/timed-out targets retain source and rebuild instructions. The original full checker was not run this round. Historical failures remain unchanged, and the existing demonstration media is retained with its original synthetic-data scope.

入口：[交付/启动指南](../delivery/README.md)、[构建记录](../delivery/current.json)、[精确来源](../verification/delivery-focused-source.json)、[实现索引](../../assets/implementation/current.json)。包生成后的路径/摘要另见仓库中的`docs/delivery/package.json`；它作为外部索引不打入自身所指的ZIP，以避免自引用。

## 当前实现边界 / Implementation boundary

| 编号 / No. | 内容 / Capability | 当前情况 / Current state |
| --- | --- | --- |
| 01 | 双小程序与API / Clients and API | 17共享页面；77业务/26管理接口契约与原生路由，账户恢复/相册journal；真机未验 / Shared source and builds, no native device certification |
| 02 | 商品档案与内容 / Recognition and plan | 冻结照片、证据/unknown、商品锁、Skill预载/受控内容工具；真实模型未验 / Implemented contracts and fixtures, real model unverified |
| 03 | 原图无声 / Silent photo layout | 实际PNG/MP4、后期/QC、封存双复核/事务交付、本人预览与有限修改；角色/计量/隔离为合成 / Actual native media, synthetic agent evidence |
| 04 | 生成基础 / Generation foundation | 图片/异步视频、原任务恢复、预算/截止/实际媒体；35项网关和6项受控MCP专项 / Native provider-boundary and scoped-protocol fixtures |
| 05 | 生成式无声整包 / Silent generated pack | 两路线参考核验→唯一制作角色→实际PNG/MP4整包→后期/QC/最终双复核/交付；原角色接管及原费用/额度，7项新专项；模型/隔离合成，官方变体未验 / Both complete silent fixture chains, original-role recovery and atomic publication; official variants unverified |
| 06 | 社区 / Community | 收藏/草稿/授权/发布状态/治理，独立原图无声SAMPLE，审核后独立公开副本与撤回；完整商业发布未验 / Native lifecycle coverage, incomplete commercial admission |
| 07 | 恢复与隐私 / Recovery and privacy | 租约、预算、原回执、登记对象回收、主库逻辑脱敏、外部签名删除日志与原生备份重放；真实物理/外部边界未验 / Controlled recovery coverage, incomplete production erasure |
| 08 | 设计与文档 / Design and docs | C基线保留、双语README/操作指南、真实浏览器媒体、源码证据 / Frozen baseline, bilingual operational docs and actual replay media |
| 09 | 原生声音内核 / Native audio kernel | 实际PCM/四字幕/许可配乐与压低/编码后检查，15项专项；内部订单POST现已包装接入，独立听音未验 / Actual kernel and private POST wrapper, no listening admission |
| 10 | 持久转写 / Durable ASR | 17项专项，原任务/费用/私有WAV和实际字级时间码；POST受控工具、显式均值副本与相消检查已接入，真实服务未验 / Scoped private POST service; real provider unverified |
| 11 | 声音合同与费用 / Audio contract and costs | 23项专项，人物/声音/许可/预算/一次整轨ASR/撤权退款；内部制作/ASR/POST/QC/听音/最终双复核/事务交付已消费，公开有声订单和真实服务仍关闭 / Private pipeline connected; public and real-provider admission closed |
| 12 | 有声制作与后期 / Native production and POST | 当前23项订单专项含原12项文件链路、6项听音基础和5项最终复核；两路线完整原声/ALAC、一次ASR、字幕/许可配乐、原清单恢复与事务撤权核验 / Actual private pipeline; synthetic model, usage and authorization responses |
| 13 | 最终声音双复核与交付 / Final native-audio review and publication | 同一原听音完整输入/推理/工具/不可变报告绑定，有声事务交付/下载与释放关联；新增5项控制回归包含于上述23项，正向中文语义刻意构造 / Private integration with fabricated semantic controls, no real-listening or production certification |
| 14 | 自动修复 / Automatic repair | 原图及两无声生成路线已接通；支持选择性重制、原素材复用和新包双复核；原生口播待完成 / Photo and silent-generated repair connected; audio pending |
| 15 | Worker内部故障与日志 / Private worker diagnostics | 固定分类/允许原生码/执行位置、公开错误不变，隔离同步/异步日志故障；尽力输出，生产日志链路未验 / Fixed private fields and non-authoritative sinks; durable production logging unverified |
| 16 | MCP原任务查询 / Original MCP observations | 已确认编号的暂时性读故障有界恢复，第三次连续失败停止；原20秒HTTP/角色截止、授权/限流/TLS保留，输入关闭只停本桥I/O / Bounded original reads and owned shutdown; not complete media repair |

首轮费用保护与内部修复费用授权已实现；首轮不能占用修复保留额，只有原失败证据及新阶段绑定通过后，内部费用端口才允许使用修复域。原图候选修复已接通，原生口播仍待完成。Photo repair uses these original limits; native-audio repair is unfinished.

## 待完成优先顺序 / Remaining priorities

完整原听音、最终双角色/推理/工具/报告与有声事务交付已有内部接入。需要真实中文听感、缓存账单、授权、跨镜人物/商品一致性及完整输入容量准入；控制测试不替代这些证据。Private integration exists; real listening, billing, rights, multi-shot and full-input capacity still require admission.

| 顺序 / Priority | 待办 / Work | 完成条件 / Completion evidence |
| --- | --- | --- |
| 00 | 原任务恢复及运行稳定性 / Original-operation recovery and stability | 按当前交付结果处理启动与核心构建缺项；全面回归移至交付后，不作为本轮源码打包前置条件；历史故障继续留存 / Resolve current startup/build gaps first; defer comprehensive regression until after source delivery and preserve historical failures |
| 01 | 生成式官方变体与真实服务验收 / Official generated variants and real-service acceptance | 在已有两条无声内部链路上验证真实模型、商品身份/风格质量、完整规格和原费用/恢复；不能用2秒夹具替代 / Real model/quality/specification evidence beyond short silent fixtures |
| 02 | 原生有声与资源规格 / Native audio and resources | 在已有内部制作/ASR/POST/文件QC上验证真实授权/识别/OSS/费用，验证连续多镜人物/商品/声音绑定、完整输入容量及真实最终听音/双复核/交付质量 / Real rights/ASR/storage, multi-shot/full-input capacity and final listening/review/delivery quality |
| 03 | 真实Codex与受限身份/释放 / Real Codex, restricted identity and cleanup | 服务凭证、真实推理计量、原生启动器、隔离/进程树/孤儿回收与G0证据 / Native verified operation |
| 04 | 支付/模型/对象存储与四组真机 / Live integrations and four device groups | 宿主登录/照片/付款/退款/下载/相册，真实费用及OSS/隐私边界 / Live platform and device evidence |
| 05 | 自动修复、完整社区与售后 / Automatic repair, community and aftercare | F09/F46/F55最多一轮原预算/原截止修复、新候选/新包/双新复核；生成式/有声/资源样例、发布准入、许可撤销、完整修改与平台纠错 / Bounded repair with fresh candidates/reviews, plus eligible community and aftercare |
| 06 | 全量P0验收与稳定性 / Full P0 acceptance and stability | 10风格/14变体各30次整包，52项P0及长期运行；历史原生heap异常需复验 / Benchmarks and native soak |
| 07 | Plus与管理Web / Plus and management web | 复杂编辑/深化、运营界面，按P1单列 / Separate advanced interfaces |

全部58项需求持续保留，不能以局部通过缩成仅原图MVP。所有官方方案维持`sale_enabled=false`；完整准入前不启售。Keep all 58 requirements; partial coverage does not reduce the scope to a photo-only MVP. All official variants remain unavailable for sale.

当前原图修复：两份原失败意见、唯一核算授权、CONTENT准备加六新阶段和新文件/双新复核；原生口播仍待完成。See [implementation and limits](../实施/修复费用授权与原订单额度-v1.0.md).

## 更新与交付 / Updates

每轮用编号表格报告实际完成、验证和待办，双语README/CHANGELOG/适用媒体与实现证据同步，提交推送并核对远端。历史文档的数量以最新实现索引补充；不得把合成运行、编译、截图或单个模型ACK升级为生产交付证明。Every round reports completed and pending work in numbered tables, refreshes relevant documentation/media/evidence, pushes normally and checks the remote. Fixtures, builds, screenshots and individual provider acknowledgments do not certify production.

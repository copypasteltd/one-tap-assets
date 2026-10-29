# 当前状态与后续顺序 / Status and next priorities

最新[可见AI标识与逐帧验收](../实施/AI可见标识与逐帧文件验收-v1.0.md)增加原报价冻结、全图片/全部视频帧实际标识、恢复/QC/交付绑定。原生字幕已有的右上文字保留，统一可验标识放左上；真实宿主/法律标识准入未验。Baked disclosure is checked over actual images and every video frame; host/legal admission remains unverified.

最新[原生声音最终双复核与事务交付](../实施/原生声音最终双复核与事务交付-v1.0.md)已连接内部两路线原听音、两个最终角色、完整推理/工具/报告绑定和事务交付。正向中文/语义为刻意构造的控制响应，不是实际提示音的识别结果。Private final audio review/publication is connected with synthetic semantic control responses, not real listening or production certification.

2026-10-29｜需求v3.1 / 开发契约v1.1 / C设计v1.0。整体 **IN_PROGRESS**，完整产品、生产准入与云端部署均未完成。The complete product, production admission and cloud deployment are not verified.

## 已执行验证 / Executed validation

| 编号 / No. | 检查 / Check | 结果 / Result | 证明范围 / Scope |
| --- | --- | --- | --- |
| 01 | TypeScript | PASS | 当前类型检查 / Current type checking |
| 02 | 单元 / Unit | 70 / 70 PASS | 领域、客户端、策略与适配器逻辑 / Domain, client and adapter logic |
| 03 | 原生集成 / Native integration | 350 / 350 PASS | 原生PG/实际媒体/HTTPS/MCP及显式合成角色、供应商、支付、宿主 / Actual database/media with synthetic external responses |
| 04 | 服务端 / Server | PASS | 编译API、Worker、回收、媒体维护和删除日志入口 / Compiled native entries |
| 05 | 双小程序 / Both mini-programs | PASS | Taro支付宝/抖音构建，不是宿主真机验收 / Compilation, not device certification |
| 06 | 浏览器回放 / Browser replay | PASS | Vite构建、10页断言/截图、实际WebM/MP4/GIF；无外部请求，浏览器已关闭 / Actual local capture |

机器可读结果：[实现索引](../../assets/implementation/current.json)、[发布核验摘要](../verification/publication.json)、[媒体清单](../media/capture-manifest.json)。完整执行日志/测试JSON位于未提交的`runtime/test-results/`；公开摘要保留计数、命令结果与摘要引用，但不包含本地凭证或运行数据库。Source hashes and original local log hashes are recorded; private runtime files are excluded from Git. Static documentation checks validate contracts/links, not product execution.

最近一次源码全套执行六项检查：类型、70项单元、350项完整原生集成、服务端及支付宝/抖音构建全部通过。完整运行前后的339份源码/测试/配置、42份运行契约和4份资源摘要一致，没有保留旧原生报告。AI标识检查使用实际RGBA字形、不透明Alpha与全部视频帧；声音正向语义仍为刻意构造的控制响应，不代表真实生成质量、中文听感、计费或商业准入。 This source snapshot freshly passes all six checks: types, 70 unit tests, 350 complete native integration tests, server and both mini builds. All 339 source/test/config, 42 runtime-contract and four resource hashes match the complete run; no old integration report is retained. Disclosure checks use actual RGBA glyphs, opaque alpha and every video frame. Positive listening semantics remain fabricated controls, not real generation quality, Chinese hearing, billing or commercial admission. [验证来源](../verification/README.md)。

最新[恢复指南](RECOVERY.md)与[发布同步指南](PUBLISHING.md)为文档整理：重新核对源码/契约/资源与媒体摘要，保留上次应用测试的真实时间和来源，本次不重跑应用测试或录制媒体。The latest recovery/publishing additions are documentation-only and retain the prior application's actual test provenance; hash/link checks are rerun without claiming new application execution or capture.

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
| 14 | 自动修复 / Automatic repair | F09/F46/F55完整新候选→新包→双新复核链路未接通；字段/租约恢复不是修复功能 / Complete new-candidate/reseal/fresh-review chain remains unimplemented |

## 待完成优先顺序 / Remaining priorities

完整原听音、最终双角色/推理/工具/报告与有声事务交付已有内部接入。需要真实中文听感、缓存账单、授权、跨镜人物/商品一致性及完整输入容量准入；控制测试不替代这些证据。Private integration exists; real listening, billing, rights, multi-shot and full-input capacity still require admission.

| 顺序 / Priority | 待办 / Work | 完成条件 / Completion evidence |
| --- | --- | --- |
| 01 | 生成式官方变体与真实服务验收 / Official generated variants and real-service acceptance | 在已有两条无声内部链路上验证真实模型、商品身份/风格质量、完整规格和原费用/恢复；不能用2秒夹具替代 / Real model/quality/specification evidence beyond short silent fixtures |
| 02 | 原生有声与资源规格 / Native audio and resources | 在已有内部制作/ASR/POST/文件QC上验证真实授权/识别/OSS/费用，验证连续多镜人物/商品/声音绑定、完整输入容量及真实最终听音/双复核/交付质量 / Real rights/ASR/storage, multi-shot/full-input capacity and final listening/review/delivery quality |
| 03 | 真实Codex与受限身份/释放 / Real Codex, restricted identity and cleanup | 服务凭证、真实推理计量、原生启动器、隔离/进程树/孤儿回收与G0证据 / Native verified operation |
| 04 | 支付/模型/对象存储与四组真机 / Live integrations and four device groups | 宿主登录/照片/付款/退款/下载/相册，真实费用及OSS/隐私边界 / Live platform and device evidence |
| 05 | 自动修复、完整社区与售后 / Automatic repair, community and aftercare | F09/F46/F55最多一轮原预算/原截止修复、新候选/新包/双新复核；生成式/有声/资源样例、发布准入、许可撤销、完整修改与平台纠错 / Bounded repair with fresh candidates/reviews, plus eligible community and aftercare |
| 06 | 全量P0验收与稳定性 / Full P0 acceptance and stability | 10风格/14变体各30次整包，52项P0及长期运行；历史原生heap异常需复验 / Benchmarks and native soak |
| 07 | Plus与管理Web / Plus and management web | 复杂编辑/深化、运营界面，按P1单列 / Separate advanced interfaces |

全部58项需求持续保留，不能以局部通过缩成仅原图MVP。所有官方方案维持`sale_enabled=false`；完整准入前不启售。Keep all 58 requirements; partial coverage does not reduce the scope to a photo-only MVP. All official variants remain unavailable for sale.

## 更新与交付 / Updates

每轮用编号表格报告实际完成、验证和待办，双语README/CHANGELOG/适用媒体与实现证据同步，提交推送并核对远端。历史文档的数量以最新实现索引补充；不得把合成运行、编译、截图或单个模型ACK升级为生产交付证明。Every round reports completed and pending work in numbered tables, refreshes relevant documentation/media/evidence, pushes normally and checks the remote. Fixtures, builds, screenshots and individual provider acknowledgments do not certify production.

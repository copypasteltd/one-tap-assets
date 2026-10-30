export interface paths {
    "/sessions/platform": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 宿主临时凭证换产品会话
         * @description 宿主临时凭证换产品会话
         */
        post: operations["createPlatformSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询本人商品草稿
         * @description 查询本人商品草稿
         */
        get: operations["listProducts"];
        put?: never;
        /**
         * 创建无商品表单草稿
         * @description 创建无商品表单草稿
         */
        post: operations["createProduct"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/products/{product_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 恢复本人草稿版本
         * @description 恢复本人草稿版本
         */
        get: operations["getProduct"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/assets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 申请私有照片上传授权
         * @description 申请私有照片上传授权
         */
        post: operations["createUploadGrant"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/assets/{asset_id}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 后端验证上传并确认READY
         * @description 后端验证上传并确认READY
         */
        post: operations["completeAssetUpload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/products/{product_id}/photos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 绑定3至5张已验证照片
         * @description 绑定3至5张已验证照片
         */
        put: operations["bindProductPhotos"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/products/{product_id}/analyses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 受理真实多模态分析
         * @description 受理真实多模态分析
         */
        post: operations["createAnalysis"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/analyses/{analysis_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询分析状态
         * @description 查询分析状态
         */
        get: operations["getAnalysis"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/products/{product_id}/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 读取本人有证据档案
         * @description 读取本人有证据档案
         */
        get: operations["getProductProfile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/products/{product_id}/corrections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 可选纠错生成新档案锁版本
         * @description 可选纠错生成新档案锁版本
         */
        post: operations["correctProfile"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/presets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 发现官方与社区方案
         * @description 发现官方与社区方案
         */
        get: operations["listPresets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/presets/{preset_id}/versions/{version}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查看不可变预设及授权样例信息
         * @description 查看不可变预设及授权样例信息
         */
        get: operations["getPresetVersion"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/presets/{preset_id}/versions/{version}/variants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询效果变体与禁售原因
         * @description 查询效果变体与禁售原因
         */
        get: operations["listPresetVariants"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/products/{product_id}/preset-recommendations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 基于本人档案推荐方案
         * @description 基于本人档案推荐方案
         */
        get: operations["recommendPresets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/input-check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 收费前核变体输入充分性
         * @description 收费前核变体输入充分性
         */
        post: operations["checkVariantInput"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/plans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 受理有证据脚本与帧计划
         * @description 受理有证据脚本与帧计划
         */
        post: operations["createPlan"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/plans/{plan_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询计划摘要与哈希
         * @description 查询计划摘要与哈希
         */
        get: operations["getPlan"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/products/{product_id}/previews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 按同版计划受理可选本人预览
         * @description 每日5个新本人预览的原子额度；已有预览查询/已购执行和领取不受额度限制，不偷偷提交收费视频。
         */
        post: operations["createOptionalPreview"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/previews/{preview_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询本人预览状态
         * @description 查询本人预览状态
         */
        get: operations["getOptionalPreview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/previews/{preview_id}/download-link": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 授权访问本人预览
         * @description 仅READY且未过期的本人预览；与正式整包交付权益分开。
         */
        post: operations["createPreviewLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/quotes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 服务端定价与冻结整包合同
         * @description 服务端定价与冻结整包合同
         */
        post: operations["createQuote"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询本人作品与订单
         * @description 查询本人作品与订单
         */
        get: operations["listOrders"];
        put?: never;
        /**
         * 消费报价建立原渠道订单
         * @description 消费报价建立原渠道订单
         */
        post: operations["createOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{order_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询验付履约与退款引用
         * @description 查询验付履约与退款引用
         */
        get: operations["getOrder"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{order_id}/payment-attempts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 沿原单创建或恢复获准支付动作
         * @description 核当前宿主/app/商户/用户与原单；UNKNOWN先查原attempt。action由本端适配器生成，不视为最终官方SDK报文。
         */
        post: operations["getOrCreatePaymentAction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payment-events/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 接收原通道支付事件并后端核验
         * @description 接收原通道支付事件并后端核验
         */
        post: operations["receivePaymentEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 读取云端任务真实状态
         * @description 读取云端任务真实状态
         */
        get: operations["getJob"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs/{job_id}/stages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询脱敏阶段状态
         * @description 查询脱敏阶段状态
         */
        get: operations["listJobStages"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{order_id}/deliverables": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 完整QC交付后读取素材清单
         * @description 完整QC交付后读取素材清单
         */
        get: operations["getDeliverables"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deliverables/{deliverable_id}/download-link": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 校验领取权益后签发5分钟短链
         * @description 校验领取权益后签发5分钟短链
         */
        post: operations["createDownloadLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/save-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 记录本安装保存队列
         * @description 记录本安装保存队列
         */
        post: operations["createSaveSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/save-receipts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 幂等记录逐文件相册回执
         * @description 幂等记录逐文件相册回执
         */
        post: operations["recordSaveReceipt"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{order_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 按原单合同取消并处理在途竞态
         * @description 按原单合同取消并处理在途竞态
         */
        post: operations["cancelOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{order_id}/refund-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 提交原渠道退款请求
         * @description 提交原渠道退款请求
         */
        post: operations["requestRefund"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/refunds/{refund_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询原退款真实状态
         * @description 查询原退款真实状态
         */
        get: operations["getRefund"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{order_id}/revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 恢复本人订单的修改记录
         * @description 按原订单恢复受限修改，分页游标绑定账户和订单
         */
        get: operations["listRevisions"];
        put?: never;
        /**
         * 48小时一次受限小修改
         * @description 48小时一次受限小修改
         */
        post: operations["requestLimitedRevision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/revisions/{revision_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询关联修改版本
         * @description 查询关联修改版本
         */
        get: operations["getRevision"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{order_id}/tickets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 提交原单帮助或平台纠错
         * @description 提交原单帮助或平台纠错
         */
        post: operations["createSupportTicket"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tickets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询本人售后工单
         * @description 查询本人售后工单
         */
        get: operations["listSupportTickets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tickets/{ticket_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询本人售后处理
         * @description 查询本人售后处理
         */
        get: operations["getSupportTicket"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/help-articles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 自助帮助
         * @description 自助帮助
         */
        get: operations["listHelpArticles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/privacy-deletions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 请求清理本人商品或账户媒体
         * @description 请求清理本人商品或账户媒体
         */
        post: operations["requestPrivacyDeletion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/privacy-deletions/{deletion_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询清理回执与保留边界
         * @description 查询清理回执与保留边界
         */
        get: operations["getPrivacyDeletion"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/community-components": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 作者查询平台受控组件目录
         * @description 作者查询平台受控组件目录
         */
        get: operations["listCommunityComponents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/variant-blueprints": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 作者查询允许组合的执行蓝本
         * @description 作者查询允许组合的执行蓝本
         */
        get: operations["listVariantBlueprints"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/community-resource-versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 作者查询获准字体音乐人物声音资源
         * @description 作者查询获准字体音乐人物声音资源
         */
        get: operations["listCommunityResources"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rights-records": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询本人授权资料
         * @description 查询本人授权资料
         */
        get: operations["listRightsRecords"];
        put?: never;
        /**
         * 作者提交私有授权证据
         * @description 作者提交私有授权证据
         */
        post: operations["submitRightsRecord"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rights-records/{rights_record_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询本人权利证据审核
         * @description 查询本人权利证据审核
         */
        get: operations["getRightsRecord"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/preset-drafts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 列出作者本人草稿
         * @description 列出作者本人草稿
         */
        get: operations["listPresetDrafts"];
        put?: never;
        /**
         * 创建受控社区方案草稿
         * @description 创建受控社区方案草稿
         */
        post: operations["createPresetDraft"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/preset-drafts/{draft_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 恢复作者草稿与版本
         * @description 恢复作者草稿与版本
         */
        get: operations["getPresetDraft"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * 乐观并发更新受控配置
         * @description 乐观并发更新受控配置
         */
        patch: operations["updatePresetDraft"];
        trace?: never;
    };
    "/preset-drafts/{draft_id}/samples": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 恢复本人草稿的样例记录
         * @description 恢复本人草稿的样例记录
         */
        get: operations["listPresetSamples"];
        put?: never;
        /**
         * 受理授权私有样例生成
         * @description 受理授权私有样例生成
         */
        post: operations["createPresetSample"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/preset-samples/{sample_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询作者样例状态
         * @description 查询作者样例状态
         */
        get: operations["getPresetSample"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/preset-samples/{sample_id}/media-links": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 授权作者查看本人私有样例
         * @description 授权作者查看本人私有样例
         */
        post: operations["createPrivateSampleMediaLinks"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public-samples/{sample_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查看独立授权且审核公开的样例
         * @description 仅AUTHORIZED_PUBLIC独立对象；禁用/撤回不再签发，私有样例不能凭ID匿名访问。
         */
        get: operations["getPublicSampleMedia"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/appeals/{appeal_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询本人或有权当事人的申诉
         * @description 查询本人或有权当事人的申诉
         */
        get: operations["getAppeal"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/preset-drafts/{draft_id}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 提交审核与准入材料
         * @description 提交审核与准入材料
         */
        post: operations["submitPresetPublication"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/preset-publications/{publication_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询审核准入与停售状态
         * @description 查询审核准入与停售状态
         */
        get: operations["getPresetPublication"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/presets/{preset_id}/favorite": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 收藏方案
         * @description 收藏方案
         */
        put: operations["setFavorite"];
        post?: never;
        /**
         * 取消收藏
         * @description 取消收藏
         */
        delete: operations["deleteFavorite"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/favorites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询本人收藏
         * @description 查询本人收藏
         */
        get: operations["listFavorites"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/presets/{preset_id}/forks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 依父版本许可派生草稿
         * @description 依父版本许可派生草稿
         */
        post: operations["forkPreset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/presets/{preset_id}/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 举报版本与提交私有证据
         * @description 举报版本与提交私有证据
         */
        post: operations["reportPreset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询本人举报
         * @description 查询本人举报
         */
        get: operations["listReports"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/{report_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询有权读取的举报决定
         * @description 查询有权读取的举报决定
         */
        get: operations["getReport"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/{report_id}/appeals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 对有权申诉的治理决定申诉
         * @description 对有权申诉的治理决定申诉
         */
        post: operations["appealReportDecision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/preset-publications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询本人方案发布记录
         * @description 查询本人方案发布记录
         */
        get: operations["listPresetPublications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/appeals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询本人申诉记录
         * @description 查询本人申诉记录
         */
        get: operations["listAppeals"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/creator/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询涉及本人方案的治理状态
         * @description 查询涉及本人方案的治理状态
         */
        get: operations["listAuthorReports"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/preset-publications/{publication_id}/sample-withdrawals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 撤回本次发布的全部公开样例
         * @description 立即停止公开分发并停售；私有源样例保持独立。
         */
        post: operations["withdrawPublicSamples"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/preset-licenses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询社区方案许可版本
         * @description 查询社区方案许可版本
         */
        get: operations["listPresetLicenses"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/preset-licenses/{license_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 读取指定版本的完整许可
         * @description 读取指定版本的完整许可
         */
        get: operations["getPresetLicense"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{order_id}/usage-feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 读取本人订单的自愿使用反馈
         * @description 读取本人订单的自愿使用反馈
         */
        get: operations["getUsageFeedback"];
        /**
         * 按原修订号更新或撤回自愿反馈；不影响保存和交付
         * @description 按原修订号更新或撤回自愿反馈；不影响保存和交付
         */
        put: operations["setUsageFeedback"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/products/{product_id}/recommendation-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 记录本人当前推荐的可见停留或点击；自然键去重，不影响制作
         * @description 记录本人当前推荐的可见停留或点击；自然键去重，不影响制作
         */
        post: operations["recordRecommendationEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/plus/links": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 创建短期电脑接续码
         * @description 创建短期电脑接续码
         */
        post: operations["createPlusLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/plus/links/inspect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 小程序查看本人准备确认的电脑接续
         * @description 小程序查看本人准备确认的电脑接续
         */
        post: operations["inspectPlusLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/plus/links/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 小程序主动允许或拒绝电脑接续
         * @description 小程序主动允许或拒绝电脑接续
         */
        post: operations["decidePlusLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/plus/links/{link_id}/poll": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 电脑持独立秘密等待确认；原确认不续期
         * @description 电脑持独立秘密等待确认；原确认不续期
         */
        post: operations["pollPlusLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/plus/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 读取当前电脑连接
         * @description 读取当前电脑连接
         */
        get: operations["getPlusSession"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/plus/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 小程序读取本人有效电脑连接
         * @description 小程序读取本人有效电脑连接
         */
        get: operations["listPlusSessions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/plus/sessions/{plus_session_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * 撤销本人电脑连接及其短期下载权限
         * @description 撤销本人电脑连接及其短期下载权限
         */
        delete: operations["revokePlusSession"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/plus/edit-drafts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 按本人范围分页读取有效编辑草稿
         * @description 按本人范围分页读取有效编辑草稿
         */
        get: operations["listPlusEditDrafts"];
        put?: never;
        /**
         * 为本人已交付图片建立独立编辑草稿
         * @description 为本人已交付图片建立独立编辑草稿
         */
        post: operations["createPlusEditDraft"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/plus/edit-drafts/{draft_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 读取本人当前有效来源的编辑草稿
         * @description 读取本人当前有效来源的编辑草稿
         */
        get: operations["getPlusEditDraft"];
        /**
         * 按修订号保存裁切、规格和待核对文字
         * @description 按修订号保存裁切、规格和待核对文字
         */
        put: operations["savePlusEditDraft"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @enum {string} */
        AnalysisState: "QUEUED" | "ANALYZING" | "VALIDATING" | "FAILED" | "READY" | "BLOCKED";
        /** @enum {string} */
        PlanState: "PLANNING" | "VALIDATING" | "FAILED" | "READY" | "BLOCKED";
        /** @enum {string} */
        AssetState: "UPLOADING" | "VERIFYING" | "READY" | "EXPIRED" | "DELETED" | "REJECTED";
        /** @enum {string} */
        QuoteState: "OPEN" | "CONSUMED" | "EXPIRED" | "INVALIDATED";
        /** @enum {string} */
        PaymentState: "CREATED" | "PENDING" | "UNKNOWN" | "FAILED" | "CANCELLED" | "CONFIRMED";
        /** @enum {string} */
        FulfillmentState: "NOT_STARTED" | "QUEUED" | "IN_PROGRESS" | "FAILED" | "CANCELLED" | "DELIVERED";
        /** @enum {string} */
        RefundState: "REQUESTED" | "PROCESSING" | "UNKNOWN" | "FAILED" | "REJECTED" | "REFUNDED";
        /** @enum {string} */
        RenderJobState: "QUEUED" | "PREPARING" | "GENERATING" | "POST_PROCESSING" | "QC" | "REPAIRING" | "FAILED" | "CANCELLED" | "DELIVERED";
        /** @enum {string} */
        StageRunState: "READY" | "CLAIMED" | "RUNNING" | "UNKNOWN" | "CANCELLED" | "FAILED" | "SUCCEEDED";
        /** @enum {string} */
        ProviderSubmissionState: "INTENT" | "SUBMITTING" | "ACKNOWLEDGED" | "RUNNING" | "UNKNOWN" | "FAILED" | "SUCCEEDED";
        /** @enum {string} */
        AlbumSaveItemState: "PENDING" | "DOWNLOADING" | "SAVING" | "FAILED" | "UNKNOWN" | "SAVED";
        /** @enum {string} */
        PublicationState: "DRAFT" | "VALIDATING" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "PUBLISHED" | "SUSPENDED" | "REJECTED";
        /** @enum {string} */
        AdmissionState: "NOT_EVALUATED" | "EVALUATING" | "ADMITTED" | "REJECTED" | "SUSPENDED";
        /** @enum {string} */
        PrivacyDeletionState: "REQUESTED" | "PROCESSING" | "PARTIAL_BLOCKED" | "COMPLETED";
        ResourceId: string;
        Sha256: string;
        /** Format: date-time */
        Timestamp: string;
        /** @enum {string} */
        Platform: "alipay" | "douyin";
        /** @enum {string} */
        Engine: "PHOTO_LAYOUT" | "PER_SHOT_AI" | "REFERENCE_FILM";
        Error: {
            code: string;
            message: string;
            retryable: boolean;
            trace_id: string;
            details: {
                field: string;
                reason: string;
            }[];
        };
        SessionRequest: {
            platform: components["schemas"]["Platform"];
            code: string;
        };
        Session: {
            access_token: string;
            /** @constant */
            token_type: "Bearer";
            /** Format: date-time */
            expires_at: string;
            user_id: string;
        };
        ProductRequest: Record<string, never>;
        Product: {
            product_id: string;
            revision: number;
            photo_version: number | null;
            profile_id: string | null;
            /** Format: date-time */
            created_at: string;
        };
        AssetRequest: {
            product_id?: string;
            /** @enum {string} */
            purpose: "PRODUCT_PHOTO" | "RIGHTS_EVIDENCE" | "SUPPORT_EVIDENCE" | "REPORT_EVIDENCE";
            file_name: string;
            /** @enum {string} */
            mime_type: "image/jpeg" | "image/png";
            size_bytes: number;
            sha256?: string | null;
        } & unknown;
        StringMap: {
            [key: string]: string;
        };
        UploadGrant: {
            asset_id: string;
            /** @enum {string} */
            method: "PUT" | "POST";
            /** Format: uri */
            upload_url: string;
            headers: components["schemas"]["StringMap"];
            form_fields: components["schemas"]["StringMap"];
            /** Format: date-time */
            expires_at: string;
        };
        AssetCompleteRequest: {
            sha256: string;
        };
        Asset: {
            asset_id: string;
            product_id: string | null;
            state: components["schemas"]["AssetState"];
            mime_type: string;
            size_bytes: number;
            width: number;
            height: number;
            sha256: string;
        };
        PhotoBindingRequest: {
            asset_ids: string[];
            expected_revision: number;
        };
        AnalysisRequest: {
            photo_version: number;
        };
        Analysis: {
            analysis_id: string;
            product_id: string;
            photo_version: number;
            state: components["schemas"]["AnalysisState"];
            profile_id: string | null;
            reason_codes: string[];
            /** Format: date-time */
            updated_at: string;
        };
        Evidence: {
            evidence_id: string;
            asset_id: string;
            /** @enum {string} */
            kind: "OBSERVATION" | "OCR" | "USER_CORRECTION";
            text: string;
            region: number[] | null;
        };
        Observation: {
            feature: string;
            value: string;
            /** @enum {string} */
            status: "OBSERVED" | "OCR" | "USER_CORRECTED" | "CONFLICTED";
            source_asset_ids: string[];
            evidence_ids: string[];
            note: string;
            model_reported_confidence: number | null;
        };
        Hypothesis: {
            text: string;
            evidence_ids: string[];
            /** @constant */
            uncertain: true;
        };
        /** @description 商品档案1.1的买家可见投影；供应商回执/模型提示版本/内部质量记录保存在私有内部模型，不返回完整调试字段。 */
        Profile: {
            /** @constant */
            schema_version: "1.1";
            profile_id: string;
            product_id: string;
            photo_version: number;
            identity_lock_id: string;
            summary: string;
            category: string | null;
            name: string | null;
            observations: components["schemas"]["Observation"][];
            label_texts: components["schemas"]["Observation"][];
            hypotheses: components["schemas"]["Hypothesis"][];
            unknowns: string[];
            conflicts: string[];
            photo_roles: {
                asset_id: string;
                /** @enum {string} */
                role: "WHOLE" | "SIDE" | "DETAIL" | "LABEL" | "OTHER";
            }[];
            evidence: components["schemas"]["Evidence"][];
            profile_hash: string;
            revision: number;
        };
        CorrectionRequest: {
            expected_revision: number;
            profile_id: string;
            /** @enum {string} */
            field: "category" | "name" | "observation" | "label_text" | "photo_role";
            value: string;
            evidence_asset_ids?: string[];
        };
        OutputSlot: {
            slot_id: string;
            /** @enum {string} */
            kind: "image" | "video" | "copy";
            count: number;
            width: number | null;
            height: number | null;
            fps: number | null;
            duration_frames: number | null;
        };
        Variant: {
            variant_id: string;
            version: string;
            name: string;
            engine: components["schemas"]["Engine"];
            sale_enabled: boolean;
            admission_state: components["schemas"]["AdmissionState"];
            reason_codes: string[];
            price_fen: number | null;
            output_slots: components["schemas"]["OutputSlot"][];
            /** @enum {string} */
            speech_mode: "NONE" | "NATIVE_ZH";
            input_guidance: string[];
        } & unknown;
        PresetSummary: {
            preset_id: string;
            version: string;
            name: string;
            author_name: string;
            /** @enum {string} */
            source: "OFFICIAL" | "COMMUNITY";
            style_tags: string[];
            sample_id: string | null;
            /** @constant */
            sample_label: "AUTHORIZED_SAMPLE_NOT_YOUR_RESULT";
            sale_enabled: boolean;
        };
        PresetDetail: {
            preset: components["schemas"]["PresetSummary"];
            description: string;
            variants: components["schemas"]["Variant"][];
            license_summary: string;
            fork_allowed: boolean;
            parent_version: string | null;
        };
        Recommendation: {
            preset: components["schemas"]["PresetSummary"];
            variant_ids: string[];
            reason: string;
            missing_inputs: string[];
            measurement?: components["schemas"]["RecommendationMeasurement"];
        };
        InputCheckRequest: {
            product_id: string;
            profile_id: string;
            variant_id: string;
            variant_version: string;
        };
        InputCheck: {
            eligible: boolean;
            reason_codes: string[];
            capture_guidance: string[];
        };
        PlanRequest: {
            product_id: string;
            photo_version: number;
            profile_id: string;
            identity_lock_id: string;
            preset_id: string;
            preset_version: string;
            variant_id: string;
            variant_version: string;
        };
        Plan: {
            plan_id: string;
            state: components["schemas"]["PlanState"];
            plan_hash: string | null;
            product_id: string;
            profile_id: string;
            variant_id: string;
            engine: components["schemas"]["Engine"];
            summary: string;
            output_slots: components["schemas"]["OutputSlot"][];
            reason_codes: string[];
            estimated_seconds_min: number | null;
            estimated_seconds_max: number | null;
        };
        PreviewRequest: {
            plan_id: string;
            plan_hash: string;
        };
        Preview: {
            preview_id: string;
            product_id: string;
            plan_id: string;
            plan_hash: string;
            /** @enum {string} */
            state: "QUEUED" | "GENERATING" | "READY" | "FAILED";
            /** @constant */
            label: "YOUR_OPTIONAL_PREVIEW_NOT_FINAL_PACK";
            /** Format: date-time */
            expires_at: string;
        };
        QuoteRequest: {
            plan_id: string;
            plan_hash: string;
        };
        Quote: {
            quote_id: string;
            plan_id: string;
            plan_hash: string;
            state: components["schemas"]["QuoteState"];
            /** @constant */
            currency: "CNY";
            amount_fen: number;
            /** Format: date-time */
            expires_at: string;
            output_slots: components["schemas"]["OutputSlot"][];
            terms_version: string;
            hard_deadline_seconds: number;
        };
        OrderRequest: {
            quote_id: string;
            channel: components["schemas"]["Platform"];
        };
        Order: {
            order_id: string;
            quote_id: string;
            channel: components["schemas"]["Platform"];
            /** @constant */
            currency: "CNY";
            amount_fen: number;
            payment_state: components["schemas"]["PaymentState"];
            fulfillment_state: components["schemas"]["FulfillmentState"];
            refund_id: string | null;
            job_id: string | null;
            /** Format: date-time */
            payable_until: string;
            delivery_expires_at: string | null;
            /** Format: date-time */
            created_at: string;
        };
        /** @description 产品适配器封套。原生payload schema在G0获准通道协议后分别冻结；仅允许对应适配器解析/校验，不eval、不当成统一官方报文。 */
        PaymentAction: {
            payment_id: string;
            order_id: string;
            state: components["schemas"]["PaymentState"];
            channel: components["schemas"]["Platform"];
            /** Format: date-time */
            expires_at: string;
            action: {
                /** @constant */
                kind: "INVOKE_PLATFORM_PAYMENT";
                adapter_contract_version: string;
                serialized_platform_payload: string;
            } | {
                /** @constant */
                kind: "QUERY_ORIGINAL_ORDER";
            };
        };
        Job: {
            job_id: string;
            order_id: string;
            state: components["schemas"]["RenderJobState"];
            current_stage: string | null;
            completed_stage_count: number;
            total_stage_count: number;
            repair_rounds: number;
            /** Format: date-time */
            deadline_at: string;
            /** Format: date-time */
            updated_at: string;
        };
        Stage: {
            stage_id: string;
            name: string;
            state: components["schemas"]["StageRunState"];
            attempt: number;
            /** Format: date-time */
            updated_at: string;
            reason_code: string | null;
        };
        Deliverable: {
            deliverable_id: string;
            slot_id: string;
            /** @enum {string} */
            kind: "image" | "video" | "copy";
            file_name: string | null;
            mime_type: string | null;
            size_bytes: number | null;
            width: number | null;
            height: number | null;
            fps: number | null;
            duration_frames: number | null;
            text: string | null;
            sha256: string;
        };
        Deliverables: {
            order_id: string;
            manifest_id: string;
            manifest_revision: number;
            /** Format: date-time */
            expires_at: string;
            items: components["schemas"]["Deliverable"][];
            parent_manifest_id?: string;
            revision_id?: string;
            cover_deliverable_id?: string;
            revision_capabilities?: ("COVER" | "ALLOWED_ORDER" | "DISPLAY_TEXT" | "IMAGE_TEXT")[];
        };
        DownloadLink: {
            deliverable_id: string;
            /** Format: uri */
            url: string;
            /** Format: date-time */
            expires_at: string;
            /** @constant */
            ttl_seconds: 300;
        };
        PreviewLink: {
            preview_id: string;
            /** Format: uri */
            url: string;
            /** Format: date-time */
            expires_at: string;
            /** @constant */
            ttl_seconds: 300;
        };
        SaveSessionRequest: {
            order_id: string;
            installation_id: string;
            deliverable_ids: string[];
        };
        SaveSession: {
            save_session_id: string;
            order_id: string;
            installation_id: string;
            deliverable_ids: string[];
            /** Format: date-time */
            created_at: string;
        };
        SaveReceiptRequest: {
            save_session_id: string;
            deliverable_id: string;
            attempt: number;
            state: components["schemas"]["AlbumSaveItemState"];
            error_code: string | null;
            /** Format: date-time */
            occurred_at: string;
        };
        Receipt: {
            receipt_id: string;
            accepted: boolean;
        };
        ReasonRequest: {
            reason_code: string;
            message?: string;
        };
        Refund: {
            refund_id: string;
            order_id: string;
            state: components["schemas"]["RefundState"];
            amount_fen: number;
            /** Format: date-time */
            updated_at: string;
        };
        RevisionRequest: {
            manifest_revision: number;
            /** @enum {string} */
            kind: "COVER" | "ALLOWED_ORDER" | "DISPLAY_TEXT" | "IMAGE_TEXT";
            cover_deliverable_id?: string;
            ordered_deliverable_ids?: string[];
            display_text?: string;
            image_text?: {
                deliverable_id: string;
                text: string;
            };
        } & (unknown & unknown & unknown & unknown);
        Revision: {
            revision_id: string;
            order_id: string;
            /** @enum {string} */
            state: "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED";
            result_manifest_revision: number | null;
            consumes_user_allowance: boolean;
        };
        TicketRequest: {
            /** @enum {string} */
            category: "PAYMENT" | "GENERATION" | "PRODUCT_ERROR" | "SAVE" | "REFUND" | "OTHER";
            message: string;
            attachment_asset_ids?: string[];
        };
        Ticket: {
            ticket_id: string;
            order_id: string;
            /** @enum {string} */
            state: "OPEN" | "PROCESSING" | "RESOLVED" | "CLOSED";
            category: string;
            /** Format: date-time */
            updated_at: string;
            revision?: number;
            response?: components["schemas"]["SupportReply"];
        };
        PresetConfig: {
            name: string;
            description: string;
            style_tags: string[];
            parent_preset_version: string | null;
            component_versions: string[];
            variant_blueprint_ids: string[];
            resource_version_ids: string[];
            fork_allowed: boolean;
        };
        ComponentOption: {
            component_version_id: string;
            type: string;
            name: string;
            description: string;
            supported_engines: components["schemas"]["Engine"][];
        };
        VariantBlueprint: {
            blueprint_id: string;
            name: string;
            engine: components["schemas"]["Engine"];
            allowed_component_version_ids: string[];
            /** @constant */
            admission_required: true;
        };
        ResourceOption: {
            resource_version_id: string;
            /** @enum {string} */
            kind: "FONT" | "MUSIC" | "CHARACTER" | "VOICE" | "LAYOUT";
            name: string;
            license_summary: string;
            usable: boolean;
        };
        RightsRecordRequest: {
            /** @enum {string} */
            scope: "OWNED_PRODUCT" | "SAMPLE_PUBLICATION" | "THIRD_PARTY_RESOURCE";
            statement: string;
            evidence_asset_ids: string[];
            resource_version_ids?: string[];
            license_reference?: string;
            product_id?: string;
        };
        RightsRecord: {
            rights_record_id: string;
            /** @enum {string} */
            state: "SUBMITTED" | "VERIFIED" | "REJECTED" | "REVOKED";
            scope: string;
            /** Format: date-time */
            updated_at: string;
            product_id?: string | null;
            photo_version?: number | null;
            resource_version_ids?: string[];
        };
        PresetDraftRequest: {
            config: components["schemas"]["PresetConfig"];
        };
        PresetDraftPatch: {
            expected_revision: number;
            config: components["schemas"]["PresetConfig"];
        };
        PresetDraft: {
            draft_id: string;
            revision: number;
            config: components["schemas"]["PresetConfig"];
            publication_id: string | null;
            /** Format: date-time */
            updated_at: string;
        };
        SampleRequest: {
            draft_revision: number;
            product_id: string;
            profile_id: string;
            variant_blueprint_id: string;
            rights_record_ids: string[];
        };
        Sample: {
            sample_id: string;
            draft_id: string;
            /** @enum {string} */
            state: "QUEUED" | "GENERATING" | "READY" | "FAILED";
            /** @enum {string} */
            visibility: "PRIVATE" | "AUTHORIZED_PUBLIC";
            rights_verified: boolean;
            product_id?: string;
            variant_blueprint_id?: string;
            draft_revision?: number;
        };
        SampleMedia: {
            sample_id: string;
            /** @enum {string} */
            label: "PRIVATE_CREATOR_SAMPLE" | "AUTHORIZED_SAMPLE_NOT_YOUR_RESULT";
            items: {
                /** @enum {string} */
                kind: "image" | "video";
                /** Format: uri */
                url: string;
                /** Format: date-time */
                expires_at: string;
            }[];
        };
        PublicSampleMedia: components["schemas"]["SampleMedia"] & {
            /** @constant */
            label?: "AUTHORIZED_SAMPLE_NOT_YOUR_RESULT";
        };
        PublicationRequest: {
            expected_revision: number;
            sample_ids: string[];
            rights_record_ids: string[];
            license_version: string;
            license_content_hash: string;
            /** @constant */
            accept_license: true;
            /** @constant */
            accept_sample_publication: true;
            /** @constant */
            public_sample_retention_days: 30;
        };
        Publication: {
            publication_id: string;
            draft_id: string;
            revision: number;
            state: components["schemas"]["PublicationState"];
            admission_state: components["schemas"]["AdmissionState"];
            sale_enabled: boolean;
            reason_codes: string[];
            preset_id: string | null;
            published_version: string | null;
            review_message?: string | null;
            /** @enum {string} */
            public_sample_state?: "NONE" | "PREPARING" | "READY" | "PUBLISHED" | "WITHDRAWN" | "EXPIRED" | "FAILED";
            public_sample_expires_at?: string | null;
            public_sample_ids?: string[];
        } & unknown;
        Favorite: {
            preset_id: string;
            favorited: boolean;
        };
        ForkRequest: {
            parent_version: string;
            name: string;
        };
        ReportRequest: {
            preset_version: string;
            /** @enum {string} */
            reason: "RIGHTS" | "MISLEADING" | "UNSAFE" | "PRODUCT_DISTORTION" | "OTHER";
            message: string;
            evidence_asset_ids?: string[];
        };
        Report: {
            report_id: string;
            preset_id: string;
            revision: number;
            /** @enum {string} */
            state: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED" | "APPEALED";
            /** Format: date-time */
            updated_at: string;
        };
        AppealRequest: {
            message: string;
            evidence_asset_ids?: string[];
        };
        Appeal: {
            appeal_id: string;
            report_id: string;
            /** @enum {string} */
            state: "OPEN" | "REVIEWING" | "RESOLVED" | "REJECTED";
        };
        PrivacyDeletionRequest: {
            /** @enum {string} */
            scope: "PRODUCT" | "ACCOUNT_MEDIA";
            product_id?: string;
            acknowledge_inflight_contract: boolean;
        } & unknown;
        PrivacyDeletion: {
            deletion_id: string;
            state: components["schemas"]["PrivacyDeletionState"];
            /** Format: date-time */
            created_at: string;
            retained_categories: string[];
            limitations: string[];
        };
        HelpArticle: {
            article_id: string;
            title: string;
            body: string;
        };
        ReviewDecisionRequest: {
            expected_revision: number;
            /** @enum {string} */
            decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT";
            reason: string;
            evidence_record_ids: string[];
        };
        VersionActionRequest: {
            expected_revision: number;
            /** @enum {string} */
            action: "ADMIT" | "REJECT" | "SUSPEND" | "RESUME";
            reason: string;
            evidence_set_id: string;
        };
        AdmissionDecisionRequest: components["schemas"]["VersionActionRequest"] & {
            /** @enum {string} */
            action?: "ADMIT" | "REJECT";
        };
        AvailabilityRequest: components["schemas"]["VersionActionRequest"] & {
            /** @enum {string} */
            action?: "SUSPEND" | "RESUME";
        };
        ManagementActionRequest: {
            reason: string;
            evidence_record_ids: string[];
        };
        GovernanceDecisionRequest: {
            expected_revision: number;
            /** @enum {string} */
            decision: "RESOLVE" | "DISMISS" | "SUSPEND_CONTENT";
            reason: string;
            evidence_record_ids: string[];
        };
        CompensationRequest: {
            /** @enum {string} */
            action: "REQUEST_ORIGINAL_REFUND" | "REPLAY_ORIGINAL_OUTBOX";
            reason: string;
            evidence_record_ids: string[];
        };
        ManagementResult: {
            action_id: string;
            resource_id: string;
            /** @enum {string} */
            state: "ACCEPTED" | "COMPLETED" | "BLOCKED";
            reason_codes: string[];
            /** Format: date-time */
            updated_at: string;
        };
        ManagedVersion: {
            resource_id: string;
            /** @enum {string} */
            kind: "MODEL" | "VARIANT";
            revision: number;
            version: string;
            admission_state: components["schemas"]["AdmissionState"];
            sale_enabled: boolean;
            price_fen: number | null;
            actual_model: string | null;
            model_version_ids: string[];
            evidence_set_id: string | null;
            reason_codes: string[];
        };
        OrderTrace: {
            order_id: string;
            events: {
                event_id: string;
                kind: string;
                trace_id: string;
                /** Format: date-time */
                occurred_at: string;
            }[];
            next_cursor: string | null;
        };
        MetricsSummary: {
            /** Format: date-time */
            window_start: string;
            /** Format: date-time */
            window_end: string;
            paid_orders: number;
            delivered_orders: number;
            unknown_submissions: number;
            refunds_pending: number;
            hard_deadline_failures: number;
            /** @constant */
            cost_currency: "CNY";
            cost_micro_total: number;
            automatic_pack_success_ratio: number | null;
            route_p95_seconds: {
                PHOTO_LAYOUT: number | null;
                PER_SHOT_AI: number | null;
                REFERENCE_FILM: number | null;
            };
        };
        ResourceIdResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["ResourceId"];
            trace_id: string;
        };
        Sha256Response: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Sha256"];
            trace_id: string;
        };
        TimestampResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Timestamp"];
            trace_id: string;
        };
        PlatformResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Platform"];
            trace_id: string;
        };
        EngineResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Engine"];
            trace_id: string;
        };
        SessionResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Session"];
            trace_id: string;
        };
        ProductResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Product"];
            trace_id: string;
        };
        UploadGrantResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["UploadGrant"];
            trace_id: string;
        };
        AssetResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Asset"];
            trace_id: string;
        };
        AnalysisResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Analysis"];
            trace_id: string;
        };
        EvidenceResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Evidence"];
            trace_id: string;
        };
        ObservationResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Observation"];
            trace_id: string;
        };
        HypothesisResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Hypothesis"];
            trace_id: string;
        };
        ProfileResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Profile"];
            trace_id: string;
        };
        OutputSlotResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["OutputSlot"];
            trace_id: string;
        };
        VariantResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Variant"];
            trace_id: string;
        };
        PresetSummaryResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["PresetSummary"];
            trace_id: string;
        };
        PresetDetailResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["PresetDetail"];
            trace_id: string;
        };
        RecommendationResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Recommendation"];
            trace_id: string;
        };
        InputCheckResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["InputCheck"];
            trace_id: string;
        };
        PlanResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Plan"];
            trace_id: string;
        };
        PreviewResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Preview"];
            trace_id: string;
        };
        QuoteResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Quote"];
            trace_id: string;
        };
        OrderResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Order"];
            trace_id: string;
        };
        PaymentActionResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["PaymentAction"];
            trace_id: string;
        };
        JobResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Job"];
            trace_id: string;
        };
        StageResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Stage"];
            trace_id: string;
        };
        DeliverableResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Deliverable"];
            trace_id: string;
        };
        DeliverablesResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Deliverables"];
            trace_id: string;
        };
        DownloadLinkResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["DownloadLink"];
            trace_id: string;
        };
        PreviewLinkResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["PreviewLink"];
            trace_id: string;
        };
        SaveSessionResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["SaveSession"];
            trace_id: string;
        };
        ReceiptResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Receipt"];
            trace_id: string;
        };
        RefundResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Refund"];
            trace_id: string;
        };
        RevisionResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Revision"];
            trace_id: string;
        };
        TicketResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Ticket"];
            trace_id: string;
        };
        PresetConfigResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["PresetConfig"];
            trace_id: string;
        };
        ComponentOptionResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["ComponentOption"];
            trace_id: string;
        };
        VariantBlueprintResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["VariantBlueprint"];
            trace_id: string;
        };
        ResourceOptionResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["ResourceOption"];
            trace_id: string;
        };
        RightsRecordResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["RightsRecord"];
            trace_id: string;
        };
        PresetDraftResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["PresetDraft"];
            trace_id: string;
        };
        SampleResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Sample"];
            trace_id: string;
        };
        SampleMediaResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["SampleMedia"];
            trace_id: string;
        };
        PublicSampleMediaResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["PublicSampleMedia"];
            trace_id: string;
        };
        PublicationResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Publication"];
            trace_id: string;
        };
        FavoriteResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Favorite"];
            trace_id: string;
        };
        ReportResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Report"];
            trace_id: string;
        };
        AppealResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["Appeal"];
            trace_id: string;
        };
        PrivacyDeletionResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["PrivacyDeletion"];
            trace_id: string;
        };
        HelpArticleResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["HelpArticle"];
            trace_id: string;
        };
        ManagementResultResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["ManagementResult"];
            trace_id: string;
        };
        ManagedVersionResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["ManagedVersion"];
            trace_id: string;
        };
        OrderTraceResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["OrderTrace"];
            trace_id: string;
        };
        MetricsSummaryResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["MetricsSummary"];
            trace_id: string;
        };
        ProductList: {
            items: components["schemas"]["Product"][];
            next_cursor: string | null;
        };
        ProductListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["ProductList"];
            trace_id: string;
        };
        PresetSummaryList: {
            items: components["schemas"]["PresetSummary"][];
            next_cursor: string | null;
        };
        PresetSummaryListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["PresetSummaryList"];
            trace_id: string;
        };
        VariantList: {
            items: components["schemas"]["Variant"][];
            next_cursor: string | null;
        };
        VariantListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["VariantList"];
            trace_id: string;
        };
        RecommendationList: {
            items: components["schemas"]["Recommendation"][];
            next_cursor: string | null;
        };
        RecommendationListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["RecommendationList"];
            trace_id: string;
        };
        OrderList: {
            items: components["schemas"]["Order"][];
            next_cursor: string | null;
        };
        OrderListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["OrderList"];
            trace_id: string;
        };
        StageList: {
            items: components["schemas"]["Stage"][];
            next_cursor: string | null;
        };
        StageListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["StageList"];
            trace_id: string;
        };
        PresetDraftList: {
            items: components["schemas"]["PresetDraft"][];
            next_cursor: string | null;
        };
        PresetDraftListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["PresetDraftList"];
            trace_id: string;
        };
        ReportList: {
            items: components["schemas"]["Report"][];
            next_cursor: string | null;
        };
        ReportListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["ReportList"];
            trace_id: string;
        };
        TicketList: {
            items: components["schemas"]["Ticket"][];
            next_cursor: string | null;
        };
        TicketListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["TicketList"];
            trace_id: string;
        };
        HelpArticleList: {
            items: components["schemas"]["HelpArticle"][];
            next_cursor: string | null;
        };
        HelpArticleListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["HelpArticleList"];
            trace_id: string;
        };
        ComponentOptionList: {
            items: components["schemas"]["ComponentOption"][];
            next_cursor: string | null;
        };
        ComponentOptionListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["ComponentOptionList"];
            trace_id: string;
        };
        VariantBlueprintList: {
            items: components["schemas"]["VariantBlueprint"][];
            next_cursor: string | null;
        };
        VariantBlueprintListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["VariantBlueprintList"];
            trace_id: string;
        };
        ResourceOptionList: {
            items: components["schemas"]["ResourceOption"][];
            next_cursor: string | null;
        };
        ResourceOptionListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["ResourceOptionList"];
            trace_id: string;
        };
        PublicationList: {
            items: components["schemas"]["Publication"][];
            next_cursor: string | null;
        };
        PublicationListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["PublicationList"];
            trace_id: string;
        };
        /** @enum {string} */
        AgentInstanceState: "REQUESTED" | "PREPARING" | "READY" | "ACTIVE" | "DRAINING" | "RELEASING" | "CLEANUP_FAILED" | "RELEASED";
        /** @enum {string} */
        AgentRunState: "QUEUED" | "LOADING_SKILLS" | "RUNNING" | "UNKNOWN" | "FAILED" | "INTERRUPTED" | "SUCCEEDED" | "CHECKPOINTED";
        /** @enum {string} */
        ReviewPacketState: "SEALED" | "REVIEWING" | "PASSED" | "STALE" | "FAILED" | "INSUFFICIENT_EVIDENCE";
        /** @enum {string} */
        SkillBundleState: "DRAFT_NOT_ADMITTED" | "VALIDATING" | "ADMITTED" | "REVOKED";
        /** @enum {string} */
        AgentRole: "CONTENT" | "PRODUCTION" | "POST" | "REVIEW_FACTS" | "REVIEW_STYLE";
        CodexContract: {
            /** @constant */
            runtime_kind: "CODEX_APP_SERVER";
            runtime_build_id: string;
            runtime_sha256: string;
            protocol_version: string;
            model_version_id: string;
            rate_version_id: string;
            skill_bundle_id: string;
            skill_bundle_version: string;
            skill_bundle_hash: string;
            role_prompt_version: string;
            tool_policy_version: string;
            qc_policy_version: string;
            required_roles: ("CONTENT" | "PRODUCTION" | "POST" | "REVIEW_FACTS" | "REVIEW_STYLE")[];
            max_turns_per_role: number;
            max_input_tokens: number;
            max_output_tokens: number;
            max_tool_calls: number;
            agent_cost_ceiling_micro: number;
            /** @constant */
            inference_spend_control: "PRE_REQUEST_RESERVATION_AND_HARD_LIMIT";
            /** @constant */
            independent_reviewers: 2;
            /** @constant */
            review_context_policy: "FRESH_THREADS_NO_CREATOR_HISTORY";
            /** @constant */
            isolation: "NATIVE_RESTRICTED_IDENTITY";
            /** @constant */
            release_after_terminal: true;
            release_grace_seconds: number;
            release_target_seconds: number;
            /** @constant */
            repair_extends_deadline: false;
        };
        CodexQuoteBinding: {
            tenant_id: string;
            quote_id: string;
            preview_session_id: string;
            plan_hash: string;
            codex_contract: {
                /** @constant */
                runtime_kind: "CODEX_APP_SERVER";
                runtime_build_id: string;
                runtime_sha256: string;
                protocol_version: string;
                model_version_id: string;
                rate_version_id: string;
                skill_bundle_id: string;
                skill_bundle_version: string;
                skill_bundle_hash: string;
                role_prompt_version: string;
                tool_policy_version: string;
                qc_policy_version: string;
                required_roles: ("CONTENT" | "PRODUCTION" | "POST" | "REVIEW_FACTS" | "REVIEW_STYLE")[];
                max_turns_per_role: number;
                max_input_tokens: number;
                max_output_tokens: number;
                max_tool_calls: number;
                agent_cost_ceiling_micro: number;
                /** @constant */
                inference_spend_control: "PRE_REQUEST_RESERVATION_AND_HARD_LIMIT";
                /** @constant */
                independent_reviewers: 2;
                /** @constant */
                review_context_policy: "FRESH_THREADS_NO_CREATOR_HISTORY";
                /** @constant */
                isolation: "NATIVE_RESTRICTED_IDENTITY";
                /** @constant */
                release_after_terminal: true;
                release_grace_seconds: number;
                release_target_seconds: number;
                /** @constant */
                repair_extends_deadline: false;
            };
            codex_contract_hash: string;
            skill_bundle_hash: string;
            /** Format: date-time */
            expires_at: string;
        };
        AgentInstance: {
            tenant_id: string;
            order_id: string | null;
            preview_session_id: string | null;
            instance_id: string;
            state: components["schemas"]["AgentInstanceState"];
            fencing_token: number;
            os_identity_ref: string;
            workspace_ref: string;
            isolation_profile_id: string;
            skill_bundle_id: string;
            run_ids: string[];
            /** Format: date-time */
            allocated_at: string;
            /** Format: date-time */
            lease_expires_at: string;
            release_reason: ("DELIVERED" | "FAILED" | "CANCELLED" | "SUSPEND" | "PREQUOTE_COMPLETE" | "EXPIRED") | null;
        } & ({
            order_id?: string;
            preview_session_id?: null;
        } | {
            order_id?: null;
            preview_session_id?: string;
        });
        AgentInstanceList: {
            items: components["schemas"]["AgentInstance"][];
            next_cursor: string | null;
        };
        AgentReleaseRequest: {
            /** @enum {string} */
            reason: "TERMINAL_RECONCILIATION" | "ORPHAN_RECOVERY" | "SUSPEND";
            expected_fencing_token: number;
            ticket_id: string;
        };
        AgentRun: {
            tenant_id: string;
            order_id: string | null;
            preview_session_id: string | null;
            run_id: string;
            instance_id: string;
            role: components["schemas"]["AgentRole"];
            thread_id: string | null;
            turn_id: string | null;
            state: components["schemas"]["AgentRunState"];
            runtime_process_ref: string | null;
            role_identity_ref: string;
            role_workspace_ref: string;
            input_hash: string;
            output_hash: string | null;
            checkpoint_hash: string | null;
            skill_bundle_hash: string;
            loaded_skill_hashes: string[];
            spend_reserved_micro: number;
            spend_confirmed_micro: number;
            /** Format: date-time */
            deadline_at: string;
            fencing_token: number;
        } & ({
            order_id?: string;
            preview_session_id?: null;
        } | {
            order_id?: null;
            preview_session_id?: string;
        });
        AgentStageResult: {
            tenant_id: string;
            order_id: string | null;
            preview_session_id: string | null;
            run_id: string;
            role: components["schemas"]["AgentRole"];
            input_hash: string;
            snapshot_hash: string | null;
            skill_bundle_hash: string;
            output_asset_ids: string[];
            tool_receipt_ids: string[];
            checkpoint_hash: string;
            /** @enum {string} */
            result: "READY" | "BLOCKED" | "FAILED";
            reason_codes: string[];
        } & ({
            order_id?: string;
            preview_session_id?: null;
        } | {
            order_id?: null;
            preview_session_id?: string;
        });
        ReviewReport: {
            report_id: string;
            tenant_id: string;
            order_id: string;
            run_id: string;
            thread_id: string;
            runtime_process_ref: string;
            isolation_evidence_id: string;
            /** @enum {string} */
            role: "REVIEW_FACTS" | "REVIEW_STYLE";
            packet_hash: string;
            snapshot_hash: string;
            output_set_hash: string;
            /** @enum {string} */
            verdict: "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";
            evidence_complete: boolean;
            findings: {
                /** @enum {string} */
                category: "PRODUCT" | "FACT" | "SPEC" | "AUDIO" | "CAPTION" | "STYLE" | "CONTINUITY" | "EVIDENCE";
                /** @enum {string} */
                severity: "BLOCKER" | "MAJOR" | "MINOR";
                evidence_ids: string[];
                time_ms: number | null;
                detail: string;
            }[];
            policy_version: string;
        };
        ReviewPacket: {
            packet_id: string;
            tenant_id: string;
            order_id: string;
            state: components["schemas"]["ReviewPacketState"];
            packet_hash: string;
            snapshot_hash: string;
            identity_lock_hash: string;
            skill_bundle_hash: string;
            qc_policy_version: string;
            original_assets: {
                asset_id: string;
                sha256: string;
            }[];
            evidence_assets: {
                asset_id: string;
                sha256: string;
            }[];
            output_set_hash: string;
            required_slot_ids: string[];
            outputs: {
                slot_id: string;
                asset_id: string;
                sha256: string;
            }[];
            production_run_ids: string[];
            production_thread_ids: string[];
            production_process_refs: string[];
            reports: {
                report_id: string;
                tenant_id: string;
                order_id: string;
                run_id: string;
                thread_id: string;
                runtime_process_ref: string;
                isolation_evidence_id: string;
                /** @enum {string} */
                role: "REVIEW_FACTS" | "REVIEW_STYLE";
                packet_hash: string;
                snapshot_hash: string;
                output_set_hash: string;
                /** @enum {string} */
                verdict: "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";
                evidence_complete: boolean;
                findings: {
                    /** @enum {string} */
                    category: "PRODUCT" | "FACT" | "SPEC" | "AUDIO" | "CAPTION" | "STYLE" | "CONTINUITY" | "EVIDENCE";
                    /** @enum {string} */
                    severity: "BLOCKER" | "MAJOR" | "MINOR";
                    evidence_ids: string[];
                    time_ms: number | null;
                    detail: string;
                }[];
                policy_version: string;
            }[];
            deterministic_pass: boolean;
            evidence_complete: boolean;
            unknown_paid_calls: number;
            /** @enum {string} */
            publication_decision: "PENDING" | "ALLOW" | "BLOCK";
        };
        CleanupReceipt: {
            tenant_id: string;
            order_id: string | null;
            preview_session_id: string | null;
            cleanup_receipt_id: string;
            instance_id: string;
            fencing_token: number;
            /** @enum {string} */
            state: "RELEASING" | "RELEASED" | "CLEANUP_FAILED";
            /** @enum {string} */
            release_reason: "DELIVERED" | "FAILED" | "CANCELLED" | "SUSPEND" | "PREQUOTE_COMPLETE" | "EXPIRED";
            processes_stopped: boolean;
            capabilities_revoked: boolean;
            temporary_files_removed: boolean;
            runtime_history_removed: boolean;
            durable_artifacts_preserved: boolean;
            pending_submissions_detached: boolean;
            pending_provider_submission_ids: string[];
            verified_at: string | null;
            evidence_hash: string | null;
            error_codes: string[];
        } & ({
            order_id?: string;
            preview_session_id?: null;
        } | {
            order_id?: null;
            preview_session_id?: string;
        });
        SkillBundleResource: {
            bundle_id: string;
            version: string;
            sha256: string;
            state: components["schemas"]["SkillBundleState"];
            signature_ref: string | null;
            evaluation_id: string | null;
            skill_hashes: string[];
        };
        SkillBundleList: {
            items: components["schemas"]["SkillBundleResource"][];
            next_cursor: string | null;
        };
        SkillBundleRevokeRequest: {
            expected_bundle_hash: string;
            reason_code: string;
            ticket_id: string;
        };
        ToolCallIntent: {
            tenant_id: string;
            order_id: string | null;
            preview_session_id: string | null;
            intent_id: string;
            instance_id: string;
            run_id: string;
            role: components["schemas"]["AgentRole"];
            tool_name: string;
            snapshot_hash: string;
            request_hash: string;
            idempotency_key: string;
            fencing_token: number;
            reservation_id: string;
            reserved_cost_micro: number;
            /** @constant */
            currency: "CNY";
            /** @enum {string} */
            state: "INTENT" | "SUBMITTING" | "ACKNOWLEDGED" | "UNKNOWN" | "SUCCEEDED" | "FAILED";
            provider_submission_id: string | null;
            /** Format: date-time */
            capability_expires_at: string;
            /** Format: date-time */
            deadline_at: string;
        } & ({
            order_id?: string;
            preview_session_id?: null;
        } | {
            order_id?: null;
            preview_session_id?: string;
        });
        AgentInstanceListResponse: {
            data: components["schemas"]["AgentInstanceList"];
            trace_id: string;
        };
        AgentInstanceResponse: {
            data: components["schemas"]["AgentInstance"];
            trace_id: string;
        };
        AgentRunResponse: {
            data: components["schemas"]["AgentRun"];
            trace_id: string;
        };
        ReviewPacketResponse: {
            data: components["schemas"]["ReviewPacket"];
            trace_id: string;
        };
        CleanupReceiptResponse: {
            data: components["schemas"]["CleanupReceipt"];
            trace_id: string;
        };
        SkillBundleListResponse: {
            data: components["schemas"]["SkillBundleList"];
            trace_id: string;
        };
        SkillBundleResourceResponse: {
            data: components["schemas"]["SkillBundleResource"];
            trace_id: string;
        };
        RightsRecordList: {
            items: components["schemas"]["RightsRecord"][];
            next_cursor: string | null;
        };
        RightsRecordListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["RightsRecordList"];
            trace_id: string;
        };
        SampleList: {
            items: components["schemas"]["Sample"][];
            next_cursor: string | null;
        };
        SampleListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["SampleList"];
            trace_id: string;
        };
        AppealList: {
            items: components["schemas"]["Appeal"][];
            next_cursor: string | null;
        };
        AppealListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["AppealList"];
            trace_id: string;
        };
        RevisionList: {
            items: components["schemas"]["Revision"][];
            next_cursor: string | null;
        };
        RevisionListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["RevisionList"];
            trace_id: string;
        };
        PresetLicenseSummary: {
            license_id: string;
            version: string;
            name: string;
            /** @enum {string} */
            state: "DRAFT" | "ACTIVE" | "RETIRED";
            content_hash: string;
            fork_allowed: boolean;
            /** @constant */
            attribution_required: true;
        };
        PresetLicense: {
            license_id: string;
            version: string;
            name: string;
            /** @enum {string} */
            state: "DRAFT" | "ACTIVE" | "RETIRED";
            content_hash: string;
            fork_allowed: boolean;
            /** @constant */
            attribution_required: true;
            full_text: string;
        };
        PresetLicenseList: {
            items: components["schemas"]["PresetLicenseSummary"][];
            next_cursor: string | null;
        };
        PresetLicenseRegistration: {
            license_id: string;
            version: string;
            name: string;
            full_text: string;
            fork_allowed: boolean;
            /** @constant */
            attribution_required: true;
        };
        PresetLicenseDecision: {
            /** @enum {string} */
            expected_state: "DRAFT" | "ACTIVE";
            expected_content_hash: string;
            /** @enum {string} */
            decision: "APPROVE" | "RETIRE";
            review_reference: string;
            reason: string;
        };
        PresetLicenseResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["PresetLicense"];
            trace_id: string;
        };
        PresetLicenseListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["PresetLicenseList"];
            trace_id: string;
        };
        PublicSampleWithdrawalRequest: {
            expected_revision: number;
            reason: string;
        };
        SupportReply: {
            message: string;
            /** Format: date-time */
            updated_at: string;
        };
        ManagedSupportTicket: {
            ticket_id: string;
            order_id: string;
            /** @enum {string} */
            state: "OPEN" | "PROCESSING" | "RESOLVED" | "CLOSED";
            category: string;
            /** Format: date-time */
            updated_at: string;
            revision: number;
            assigned_actor: string | null;
            has_response: boolean;
            content_available: boolean;
        };
        ManagedSupportTicketList: {
            items: components["schemas"]["ManagedSupportTicket"][];
            next_cursor: string | null;
        };
        ManagedSupportDetail: {
            summary: components["schemas"]["ManagedSupportTicket"];
            message: string | null;
            attachment_asset_ids: string[];
            response: components["schemas"]["SupportReply"] | null;
            repair_access?: boolean;
        };
        SupportProcessRequest: {
            expected_revision: number;
            /** @enum {string} */
            action: "CLAIM" | "REPLY" | "RESOLVE" | "CLOSE";
            message?: string;
        };
        SupportEvidence: {
            asset_id: string;
            /** @constant */
            mime_type: "image/png";
            sha256: string;
            bytes_base64: string;
        };
        ManagedSupportTicketResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["ManagedSupportTicket"];
            trace_id: string;
        };
        ManagedSupportTicketListResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["ManagedSupportTicketList"];
            trace_id: string;
        };
        ManagedSupportDetailResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["ManagedSupportDetail"];
            trace_id: string;
        };
        SupportEvidenceResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["SupportEvidence"];
            trace_id: string;
        };
        PlatformErrorRepairRequest: {
            ticket_id: string;
            expected_ticket_revision: number;
            change: components["schemas"]["RevisionRequest"];
        };
        SupportRepairContext: {
            ticket: components["schemas"]["ManagedSupportTicket"];
            manifest: components["schemas"]["Deliverables"] | null;
            product_profile: components["schemas"]["Profile"] | null;
            repair: components["schemas"]["Revision"] | null;
            can_submit: boolean;
            allowed_changes: ("COVER" | "ALLOWED_ORDER" | "DISPLAY_TEXT" | "IMAGE_TEXT")[];
            reason_codes: string[];
            window_expires_at: string | null;
        };
        SupportRepairImage: {
            /** @constant */
            mime_type: "image/png";
            sha256: string;
            bytes_base64: string;
            deliverable_id: string;
            manifest_revision: number;
        };
        SupportRepairContextResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["SupportRepairContext"];
            trace_id: string;
        };
        SupportRepairImageResponse: {
            /** @constant */
            code: "OK";
            data: components["schemas"]["SupportRepairImage"];
            trace_id: string;
        };
        PublicationReviewFile: {
            sample_id: string;
            item_id: string;
            /** @enum {unknown} */
            kind: "image" | "video";
            /** @enum {unknown} */
            mime_type: "image/png" | "video/mp4";
            sha256: string;
            size_bytes: number;
        };
        PublicationReviewRights: {
            record: components["schemas"]["RightsRecord"];
            statement: string | null;
            license_reference: string | null;
            evidence_asset_ids: string[];
        };
        PublicationReviewSample: {
            sample: components["schemas"]["Sample"];
            files: components["schemas"]["PublicationReviewFile"][];
        };
        PublicationReviewDetail: {
            publication: components["schemas"]["Publication"];
            config: components["schemas"]["PresetConfig"] | null;
            license: components["schemas"]["PresetLicense"] | null;
            rights: components["schemas"]["PublicationReviewRights"][];
            samples: components["schemas"]["PublicationReviewSample"][];
            content_available: boolean;
        };
        PublicationReviewMedia: {
            publication_id: string;
            sample_id: string | null;
            rights_record_id: string | null;
            item_id: string;
            /** @enum {unknown} */
            mime_type: "image/png" | "video/mp4";
            sha256: string;
            size_bytes: number;
            bytes_base64: string;
        };
        PublicationReviewDetailResponse: {
            data: components["schemas"]["PublicationReviewDetail"];
            trace_id: string;
        };
        PublicationReviewMediaResponse: {
            data: components["schemas"]["PublicationReviewMedia"];
            trace_id: string;
        };
        /** @enum {string} */
        UsageChoice: "PLANNED_USE" | "USED" | "NEEDS_ADJUSTMENT";
        UsageFeedback: {
            order_id: string;
            choice: components["schemas"]["UsageChoice"] | null;
            revision: number;
            updated_at: string | null;
        };
        UsageFeedbackRequest: {
            choice: components["schemas"]["UsageChoice"] | null;
            expected_revision: number;
        };
        /** @enum {string} */
        TrafficGroup: "UNCLASSIFIED" | "INTERNAL_TEST" | "EXTERNAL";
        TrafficClassificationRequest: {
            traffic_group: components["schemas"]["TrafficGroup"];
        };
        TrafficClassification: {
            traffic_group: components["schemas"]["TrafficGroup"];
            updated_at: string | null;
        };
        ProductInsights: {
            /** Format: date-time */
            window_start: string;
            /** Format: date-time */
            window_end: string;
            /** @enum {string} */
            traffic_group: "ALL" | "UNCLASSIFIED" | "INTERNAL_TEST" | "EXTERNAL";
            recognition: {
                jobs: number;
                ready_jobs: number;
                blocked_jobs: number;
                failed_jobs: number;
                attempts: number;
                machine_profiles: number;
                profiles_with_observed_fields: number;
                observed_fields: number;
                ocr_fields: number;
                hypothesis_fields: number;
                unknown_fields: number;
                conflicted_fields: number;
                evidenced_field_share: number | null;
                accuracy: null;
            };
            funnel: {
                selected_product_presets: number;
                paid_orders: number;
                paid_buyers: number;
                first_deliveries: number;
                recommendation_impressions: number | null;
                recommendation_clicks: number | null;
                automatic_success_ratio: null;
            };
            album: {
                saved_files: number;
                saved_orders: number;
                unwindowed_receipts: number;
            };
            feedback: {
                planned_use: number;
                used: number;
                needs_adjustment: number;
                withdrawn: number;
            };
            community: {
                published_versions: number;
                effective_reuses: number;
            };
            costs: {
                /** @constant */
                currency: "CNY";
                order_settled_micro: number;
                platform_settled_micro: number;
                platform_unresolved_reservations: number;
                platform_unclassified_reservations: number;
                review_support_micro: null;
                complete_cost_micro: null;
            };
            recommendation_measurement: components["schemas"]["RecommendationMeasurementCoverage"];
        };
        UsageFeedbackResponse: {
            data: components["schemas"]["UsageFeedback"];
            trace_id: string;
        };
        TrafficClassificationResponse: {
            data: components["schemas"]["TrafficClassification"];
            trace_id: string;
        };
        ProductInsightsResponse: {
            data: components["schemas"]["ProductInsights"];
            trace_id: string;
        };
        RecommendationMeasurement: {
            token: string;
            /** Format: date-time */
            expires_at: string;
        };
        RecommendationEventRequest: {
            measurement_token: string;
            /** @enum {string} */
            kind: "IMPRESSION" | "CLICK";
        };
        RecommendationEventReceipt: {
            /** @constant */
            accepted: true;
            duplicate: boolean;
        };
        RecommendationMeasurementCoverage: {
            /** Format: date-time */
            started_at: string;
            /** @enum {string} */
            window_coverage: "UNCOLLECTED" | "PARTIAL" | "SINCE_START";
            /** @constant */
            evidence: "CLIENT_REPORTED";
        };
        RecommendationEventReceiptResponse: {
            data: components["schemas"]["RecommendationEventReceipt"];
            trace_id: string;
        };
        PlusLinkCreateRequest: Record<string, never>;
        PlusLink: {
            link_id: string;
            user_code: string;
            poll_key: string;
            /** Format: date-time */
            expires_at: string;
            /** @constant */
            poll_interval_seconds: 3;
        };
        PlusLinkInspectRequest: {
            user_code: string;
        };
        PlusLinkDecisionRequest: {
            user_code: string;
            /** @enum {string} */
            decision: "APPROVE" | "DENY";
        };
        PlusLinkApproval: {
            link_id: string;
            user_code: string;
            /** Format: date-time */
            expires_at: string;
            /** @enum {string} */
            state: "PENDING" | "APPROVED" | "DENIED";
            /** @constant */
            access: "OWN_PROJECTS_AND_EDIT_DRAFTS";
        };
        PlusLinkPollRequest: {
            poll_key: string;
        };
        PlusSessionInfo: {
            session_id: string;
            platform: components["schemas"]["Platform"];
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            expires_at: string;
            /** @enum {string} */
            state: "ACTIVE" | "REVOKED" | "EXPIRED";
        };
        PlusBrowserSession: {
            access_token: string;
            /** @constant */
            token_type: "Bearer";
            /** Format: date-time */
            expires_at: string;
            user_id: string;
            connection: components["schemas"]["PlusSessionInfo"];
        };
        PlusLinkStatus: {
            /** @enum {string} */
            state: "PENDING" | "APPROVED" | "DENIED";
            session?: components["schemas"]["PlusBrowserSession"];
        };
        PlusSessionList: {
            items: components["schemas"]["PlusSessionInfo"][];
            next_cursor: null;
        };
        PlusEditSettings: {
            crop: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
            canvas: {
                width: number;
                height: number;
            };
            title: string;
            brand: string;
            facts: string[];
        };
        PlusEditCreateRequest: {
            order_id: string;
            deliverable_id: string;
        };
        PlusEditSaveRequest: {
            expected_revision: number;
            settings: components["schemas"]["PlusEditSettings"];
        };
        PlusEditDraft: {
            draft_id: string;
            order_id: string;
            product_id: string;
            manifest_id: string;
            manifest_revision: number;
            deliverable_id: string;
            source_sha256: string;
            revision: number;
            settings: components["schemas"]["PlusEditSettings"];
            /** @constant */
            fact_status: "USER_PROVIDED_UNVERIFIED";
            /** @constant */
            state: "DRAFT";
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            updated_at: string;
        };
        PlusEditList: {
            items: components["schemas"]["PlusEditDraft"][];
            next_cursor: string | null;
        };
        PlusLinkResponse: {
            data: components["schemas"]["PlusLink"];
            trace_id: string;
        };
        PlusLinkApprovalResponse: {
            data: components["schemas"]["PlusLinkApproval"];
            trace_id: string;
        };
        PlusLinkStatusResponse: {
            data: components["schemas"]["PlusLinkStatus"];
            trace_id: string;
        };
        PlusSessionInfoResponse: {
            data: components["schemas"]["PlusSessionInfo"];
            trace_id: string;
        };
        PlusSessionListResponse: {
            data: components["schemas"]["PlusSessionList"];
            trace_id: string;
        };
        PlusEditDraftResponse: {
            data: components["schemas"]["PlusEditDraft"];
            trace_id: string;
        };
        PlusEditListResponse: {
            data: components["schemas"]["PlusEditList"];
            trace_id: string;
        };
    };
    responses: never;
    parameters: {
        IdempotencyKey: string;
        Cursor: string;
        Limit: number;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    createPlatformSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SessionRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listProducts: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createProduct: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProductRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getProduct: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                product_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createUploadGrant: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AssetRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadGrantResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    completeAssetUpload: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                asset_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AssetCompleteRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssetResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    bindProductPhotos: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                product_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PhotoBindingRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createAnalysis: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                product_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AnalysisRequest"];
            };
        };
        responses: {
            /** @description 已持久化受理，可按资源ID查询 */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnalysisResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getAnalysis: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                analysis_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnalysisResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getProductProfile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                product_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    correctProfile: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                product_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CorrectionRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listPresets: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PresetSummaryListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getPresetVersion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                preset_id: string;
                version: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PresetDetailResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listPresetVariants: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path: {
                preset_id: string;
                version: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VariantListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    recommendPresets: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path: {
                product_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecommendationListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    checkVariantInput: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InputCheckRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InputCheckResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createPlan: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlanRequest"];
            };
        };
        responses: {
            /** @description 已持久化受理，可按资源ID查询 */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlanResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getPlan: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                plan_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlanResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createOptionalPreview: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                product_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PreviewRequest"];
            };
        };
        responses: {
            /** @description 已持久化受理，可按资源ID查询 */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PreviewResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getOptionalPreview: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                preview_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PreviewResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createPreviewLink: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                preview_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PreviewLinkResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createQuote: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["QuoteRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuoteResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listOrders: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createOrder: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrderRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getOrder: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                order_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getOrCreatePaymentAction: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                order_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaymentActionResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    receivePaymentEvent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: "alipay" | "douyin";
            };
            cookie?: never;
        };
        /** @description 保留原始字节，媒体类型/验签字段/ACK按获准通道正式协议；无产品Bearer不等于免验签。 */
        requestBody: {
            content: {
                "application/json": unknown;
                "application/x-www-form-urlencoded": string;
                "text/xml": string;
            };
        };
        responses: {
            /** @description 按原支付通道正式协议返回ACK，不包裹产品JSON；实际报文适配后冻结 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getJob: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listJobStages: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StageListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getDeliverables: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                order_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeliverablesResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createDownloadLink: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                deliverable_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DownloadLinkResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createSaveSession: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SaveSessionRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SaveSessionResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    recordSaveReceipt: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SaveReceiptRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReceiptResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    cancelOrder: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                order_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReasonRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    requestRefund: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                order_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReasonRequest"];
            };
        };
        responses: {
            /** @description 已持久化受理，可按资源ID查询 */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RefundResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getRefund: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                refund_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RefundResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listRevisions: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path: {
                order_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RevisionListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    requestLimitedRevision: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                order_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RevisionRequest"];
            };
        };
        responses: {
            /** @description 已持久化受理，可按资源ID查询 */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RevisionResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getRevision: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                revision_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RevisionResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createSupportTicket: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                order_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TicketRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TicketResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listSupportTickets: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TicketListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getSupportTicket: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ticket_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TicketResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listHelpArticles: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HelpArticleListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    requestPrivacyDeletion: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PrivacyDeletionRequest"];
            };
        };
        responses: {
            /** @description 已持久化受理，可按资源ID查询 */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PrivacyDeletionResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getPrivacyDeletion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                deletion_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PrivacyDeletionResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listCommunityComponents: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ComponentOptionListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listVariantBlueprints: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VariantBlueprintListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listCommunityResources: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResourceOptionListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listRightsRecords: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RightsRecordListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    submitRightsRecord: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RightsRecordRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RightsRecordResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getRightsRecord: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rights_record_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RightsRecordResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listPresetDrafts: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PresetDraftListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createPresetDraft: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PresetDraftRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PresetDraftResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getPresetDraft: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                draft_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PresetDraftResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    updatePresetDraft: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                draft_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PresetDraftPatch"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PresetDraftResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listPresetSamples: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path: {
                draft_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SampleListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createPresetSample: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                draft_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SampleRequest"];
            };
        };
        responses: {
            /** @description 已持久化受理，可按资源ID查询 */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SampleResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getPresetSample: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sample_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SampleResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createPrivateSampleMediaLinks: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                sample_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SampleMediaResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getPublicSampleMedia: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sample_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicSampleMediaResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getAppeal: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                appeal_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AppealResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    submitPresetPublication: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                draft_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublicationRequest"];
            };
        };
        responses: {
            /** @description 已持久化受理，可按资源ID查询 */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicationResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getPresetPublication: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                publication_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicationResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    setFavorite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                preset_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FavoriteResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    deleteFavorite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                preset_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FavoriteResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listFavorites: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PresetSummaryListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    forkPreset: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                preset_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ForkRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PresetDraftResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    reportPreset: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                preset_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReportRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listReports: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getReport: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                report_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    appealReportDecision: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                report_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AppealRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AppealResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listPresetPublications: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicationListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listAppeals: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AppealListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listAuthorReports: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    withdrawPublicSamples: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                publication_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublicSampleWithdrawalRequest"];
            };
        };
        responses: {
            /** @description 已持久化受理，可按资源ID查询 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicationResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listPresetLicenses: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PresetLicenseListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getPresetLicense: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                license_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PresetLicenseResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getUsageFeedback: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                order_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsageFeedbackResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    setUsageFeedback: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                order_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UsageFeedbackRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsageFeedbackResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    recordRecommendationEvent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                product_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecommendationEventRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecommendationEventReceiptResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createPlusLink: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlusLinkCreateRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlusLinkResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    inspectPlusLink: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlusLinkInspectRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlusLinkApprovalResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    decidePlusLink: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlusLinkDecisionRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlusLinkApprovalResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    pollPlusLink: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                link_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlusLinkPollRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlusLinkStatusResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getPlusSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlusSessionInfoResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listPlusSessions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlusSessionListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    revokePlusSession: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                plus_session_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlusSessionInfoResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listPlusEditDrafts: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlusEditListResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createPlusEditDraft: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlusEditCreateRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlusEditDraftResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getPlusEditDraft: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                draft_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlusEditDraftResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    savePlusEditDraft: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                draft_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlusEditSaveRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlusEditDraftResponse"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description 业务/鉴权错误，具体code及恢复语义见接口文档 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
}

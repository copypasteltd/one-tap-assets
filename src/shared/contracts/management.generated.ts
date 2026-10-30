export interface paths {
    "/publications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询预设审核队列
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        get: operations["listReviewQueue"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/publications/{publication_id}/review-decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 留证据的内容与权利审核
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        post: operations["decidePublicationReview"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/publications/{publication_id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 仅在审核及准入齐备后发布
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        post: operations["publishApprovedPreset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/variants/{variant_id}/versions/{version}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询变体管理修订与准入证据索引
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        get: operations["getManagedVariantVersion"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/model-versions/{model_version_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询模型管理修订与能力证据索引
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        get: operations["getManagedModelVersion"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/variants/{variant_id}/versions/{version}/admission-decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 按能力权利价格基准证据准入或拒绝
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        post: operations["decideVariantAdmission"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/variants/{variant_id}/versions/{version}/sale-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 精确停新售或经重验恢复
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        post: operations["changeVariantAvailability"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/model-versions/{model_version_id}/availability": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 模型能力版本停售或重验恢复
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        post: operations["changeModelAvailability"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/{report_id}/decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 审理举报并记录决定
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        post: operations["decideGovernanceReport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{order_id}/trace": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 按需审计读取原单脱敏事件
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        get: operations["readRedactedOrderTrace"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{order_id}/platform-repairs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 平台错误关联免费纠错不耗小改额度
         * @description 原接手客服及原版本工单；三路线已有封面、完整清单顺序或配套文案纠错；音视频字节保持不变，有声单重验原转写、已结算听音和许可，并由新角色复核原意。共享原售后预算、推理和工具额度，冻结300秒/48小时/领取期最早截止，五阶段重新验收。不耗用户一次小修改，不自动解决工单。
         */
        post: operations["requestPlatformErrorRepair"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{order_id}/compensations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 原单退款或幂等补投原履约事件
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        post: operations["requestOriginalOrderCompensation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/provider-submissions/{submission_id}/reconciliations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 查原任务或消费有证据的对账记录
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        post: operations["reconcileProviderSubmission"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/metrics/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 按窗口读取聚合履约成本质量索引
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        get: operations["readOperationalSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/privacy-deletions/{deletion_id}/reconcile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 重试受控清理并更新边界回执
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        post: operations["reconcilePrivacyDeletion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/actions/{action_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 有权限的发起者查询管理动作进展
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        get: operations["getManagementAction"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/agent-instances": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询受限实例
         * @description 独立管理权限/范围/审计。只返回受权脱敏证据；释放不得丢弃在途意图或耐久交付，不能凭管理请求绕过质量/预算/退款。
         */
        get: operations["listAgentInstances"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/agent-instances/{instance_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询实例状态与代次
         * @description 独立管理权限/范围/审计。只返回受权脱敏证据；释放不得丢弃在途意图或耐久交付，不能凭管理请求绕过质量/预算/退款。
         */
        get: operations["getAgentInstance"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/agent-instances/{instance_id}/release": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 核对状态后申请幂等回收
         * @description 独立管理权限/范围/审计。只返回受权脱敏证据；释放不得丢弃在途意图或耐久交付，不能凭管理请求绕过质量/预算/退款。
         */
        post: operations["requestAgentRelease"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/agent-runs/{run_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询角色运行的脱敏证据
         * @description 独立管理权限/范围/审计。只返回受权脱敏证据；释放不得丢弃在途意图或耐久交付，不能凭管理请求绕过质量/预算/退款。
         */
        get: operations["getAgentRun"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/review-packets/{packet_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询封存审查包和双报告
         * @description 独立管理权限/范围/审计。只返回受权脱敏证据；释放不得丢弃在途意图或耐久交付，不能凭管理请求绕过质量/预算/退款。
         */
        get: operations["getReviewPacket"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/skill-bundles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询Skill包准入状态
         * @description 独立管理权限/范围/审计。只返回受权脱敏证据；释放不得丢弃在途意图或耐久交付，不能凭管理请求绕过质量/预算/退款。
         */
        get: operations["listSkillBundles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/skill-bundles/{bundle_id}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 撤销指定摘要版本并审计
         * @description 独立管理权限/范围/审计。只返回受权脱敏证据；释放不得丢弃在途意图或耐久交付，不能凭管理请求绕过质量/预算/退款。
         */
        post: operations["revokeSkillBundle"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/agent-instances/{instance_id}/cleanup-receipt": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询真实清理核验结果
         * @description 独立管理权限/范围/审计。只返回受权脱敏证据；释放不得丢弃在途意图或耐久交付，不能凭管理请求绕过质量/预算/退款。
         */
        get: operations["getCleanupReceipt"];
        put?: never;
        post?: never;
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
        get?: never;
        put?: never;
        /**
         * 登记不可变社区许可草案
         * @description 独立管理权限/范围/审计。只返回受权脱敏证据；释放不得丢弃在途意图或耐久交付，不能凭管理请求绕过质量/预算/退款。
         */
        post: operations["registerPresetLicense"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/preset-licenses/{license_id}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 审核启用或退役指定许可版本
         * @description 独立管理权限/范围/审计。只返回受权脱敏证据；释放不得丢弃在途意图或耐久交付，不能凭管理请求绕过质量/预算/退款。
         */
        post: operations["decidePresetLicense"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support-tickets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询客服待办（无私有正文）
         * @description 独立管理身份；正文与附件读取审计且不缓存，原版本/接手人限制写入。处理完成不代表退款、修复或重新交付。
         */
        get: operations["listManagedSupportTickets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support-tickets/{ticket_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 授权查询工单正文与回复
         * @description 独立管理身份；正文与附件读取审计且不缓存，原版本/接手人限制写入。处理完成不代表退款、修复或重新交付。
         */
        get: operations["getManagedSupportTicket"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support-tickets/{ticket_id}/evidence/{asset_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 授权查看原工单证明图片
         * @description 独立管理身份；正文与附件读取审计且不缓存，原版本/接手人限制写入。处理完成不代表退款、修复或重新交付。
         */
        get: operations["readSupportEvidence"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support-tickets/{ticket_id}/process": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 按原版本接单、回复、解决或关闭
         * @description 独立管理身份；正文与附件读取审计且不缓存，原版本/接手人限制写入。处理完成不代表退款、修复或重新交付。
         */
        post: operations["processSupportTicket"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support-tickets/{ticket_id}/repair-context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 核对原工单的素材、档案与纠错状态
         * @description 独立support:repair权限及原接手客服；每次重验撤销、许可、原清单与SHA，私有内容不缓存。可受理不等于保证交付；写入仍重新校验原工单与额度。
         */
        get: operations["getSupportRepairContext"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support-tickets/{ticket_id}/repair-manifests/{manifest_revision}/images/{deliverable_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 读取当前原清单内的实际私有图片
         * @description 独立support:repair权限及原接手客服；每次重验撤销、许可、原清单与SHA，私有内容不缓存。可受理不等于保证交付；写入仍重新校验原工单与额度。
         */
        get: operations["readSupportRepairImage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/publications/{publication_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 读取原发布申请、许可与授权样例
         * @description 独立审核权限，只投影原申请绑定的作者资料；实际字节逐项核对登记、撤回、SHA和文件签名。
         */
        get: operations["getPublicationReview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/publications/{publication_id}/samples/{sample_id}/media/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 核对原申请指定样例的实际私有文件
         * @description 独立审核权限，只投影原申请绑定的作者资料；实际字节逐项核对登记、撤回、SHA和文件签名。
         */
        get: operations["readPublicationReviewMedia"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/publications/{publication_id}/rights/{rights_record_id}/evidence/{asset_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 核对原申请指定授权的证明图片
         * @description 独立审核权限，只投影原申请绑定的作者资料；实际字节逐项核对登记、撤回、SHA和文件签名。
         */
        get: operations["readPublicationRightsEvidence"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/metrics/product-insights": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 读取分群识别、保存、反馈、社区复用与已入账成本
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        get: operations["readProductInsights"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/metrics/accounts/{tenant_id}/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 读取服务端流量标记
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        get: operations["getTrafficClassification"];
        /**
         * 标记内部测试、外部或未分类流量；不是客户真实性认证
         * @description 管理域独立audience与角色，所有访问/动作审计；产品会话不得提升权限。审批不能覆盖缺失的能力/价格/权利证据。
         */
        put: operations["setTrafficClassification"];
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
    listReviewQueue: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
                state?: components["schemas"]["PublicationState"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicationListResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    decidePublicationReview: {
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
                "application/json": components["schemas"]["ReviewDecisionRequest"];
            };
        };
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicationResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    publishApprovedPreset: {
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
                "application/json": components["schemas"]["ManagementActionRequest"];
            };
        };
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicationResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getManagedVariantVersion: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path: {
                variant_id: string;
                version: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagedVersionResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getManagedModelVersion: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path: {
                model_version_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagedVersionResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    decideVariantAdmission: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                variant_id: string;
                version: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AdmissionDecisionRequest"];
            };
        };
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResultResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    changeVariantAvailability: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                variant_id: string;
                version: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AvailabilityRequest"];
            };
        };
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResultResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    changeModelAvailability: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                model_version_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AvailabilityRequest"];
            };
        };
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResultResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    decideGovernanceReport: {
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
                "application/json": components["schemas"]["GovernanceDecisionRequest"];
            };
        };
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    readRedactedOrderTrace: {
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
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderTraceResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    requestPlatformErrorRepair: {
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
                "application/json": components["schemas"]["PlatformErrorRepairRequest"];
            };
        };
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RevisionResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    requestOriginalOrderCompensation: {
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
                "application/json": components["schemas"]["CompensationRequest"];
            };
        };
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResultResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    reconcileProviderSubmission: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                submission_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManagementActionRequest"];
            };
        };
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResultResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    readOperationalSummary: {
        parameters: {
            query: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
                window_start: string;
                window_end: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MetricsSummaryResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    reconcilePrivacyDeletion: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                deletion_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManagementActionRequest"];
            };
        };
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PrivacyDeletionResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getManagementAction: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path: {
                action_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResultResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listAgentInstances: {
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
            /** @description 设计中的持久状态/脱敏工件结果，不代表已实现。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentInstanceListResponse"];
                };
            };
            /** @description 权限/状态/证据错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getAgentInstance: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                instance_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 设计中的持久状态/脱敏工件结果，不代表已实现。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentInstanceResponse"];
                };
            };
            /** @description 权限/状态/证据错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    requestAgentRelease: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                instance_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AgentReleaseRequest"];
            };
        };
        responses: {
            /** @description 设计中的持久状态/脱敏工件结果，不代表已实现。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentInstanceResponse"];
                };
            };
            /** @description 权限/状态/证据错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getAgentRun: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 设计中的持久状态/脱敏工件结果，不代表已实现。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentRunResponse"];
                };
            };
            /** @description 权限/状态/证据错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getReviewPacket: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                packet_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 设计中的持久状态/脱敏工件结果，不代表已实现。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReviewPacketResponse"];
                };
            };
            /** @description 权限/状态/证据错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listSkillBundles: {
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
            /** @description 设计中的持久状态/脱敏工件结果，不代表已实现。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SkillBundleListResponse"];
                };
            };
            /** @description 权限/状态/证据错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    revokeSkillBundle: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                bundle_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SkillBundleRevokeRequest"];
            };
        };
        responses: {
            /** @description 设计中的持久状态/脱敏工件结果，不代表已实现。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SkillBundleResourceResponse"];
                };
            };
            /** @description 权限/状态/证据错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getCleanupReceipt: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                instance_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 设计中的持久状态/脱敏工件结果，不代表已实现。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CleanupReceiptResponse"];
                };
            };
            /** @description 权限/状态/证据错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    registerPresetLicense: {
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
                "application/json": components["schemas"]["PresetLicenseRegistration"];
            };
        };
        responses: {
            /** @description 设计中的持久状态/脱敏工件结果，不代表已实现。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PresetLicenseResponse"];
                };
            };
            /** @description 权限/状态/证据错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    decidePresetLicense: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                license_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PresetLicenseDecision"];
            };
        };
        responses: {
            /** @description 设计中的持久状态/脱敏工件结果，不代表已实现。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PresetLicenseResponse"];
                };
            };
            /** @description 权限/状态/证据错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listManagedSupportTickets: {
        parameters: {
            query?: {
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
                state?: "OPEN" | "PROCESSING" | "RESOLVED" | "CLOSED";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 工单状态或受权内容 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagedSupportTicketListResponse"];
                };
            };
            /** @description 权限、版本或内容撤销错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getManagedSupportTicket: {
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
            /** @description 工单状态或受权内容 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagedSupportDetailResponse"];
                };
            };
            /** @description 权限、版本或内容撤销错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    readSupportEvidence: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ticket_id: string;
                asset_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 工单状态或受权内容 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupportEvidenceResponse"];
                };
            };
            /** @description 权限、版本或内容撤销错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    processSupportTicket: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                ticket_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SupportProcessRequest"];
            };
        };
        responses: {
            /** @description 工单状态或受权内容 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagedSupportTicketResponse"];
                };
            };
            /** @description 权限、版本或内容撤销错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getSupportRepairContext: {
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
            /** @description 工单状态或受权内容 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupportRepairContextResponse"];
                };
            };
            /** @description 权限、版本或内容撤销错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    readSupportRepairImage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ticket_id: string;
                manifest_revision: number;
                deliverable_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 工单状态或受权内容 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupportRepairImageResponse"];
                };
            };
            /** @description 权限、版本或内容撤销错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getPublicationReview: {
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
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicationReviewDetailResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    readPublicationReviewMedia: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                publication_id: string;
                sample_id: string;
                item_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicationReviewMediaResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    readPublicationRightsEvidence: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                publication_id: string;
                rights_record_id: string;
                asset_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicationReviewMediaResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    readProductInsights: {
        parameters: {
            query: {
                window_start: string;
                window_end: string;
                traffic_group?: "ALL" | "UNCLASSIFIED" | "INTERNAL_TEST" | "EXTERNAL";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductInsightsResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getTrafficClassification: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                tenant_id: string;
                user_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TrafficClassificationResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    setTrafficClassification: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                tenant_id: string;
                user_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TrafficClassificationRequest"];
            };
        };
        responses: {
            /** @description 持久化的动作/资源结果，异步进展通过返回ID查询；非真实能力证明 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TrafficClassificationResponse"];
                };
            };
            /** @description 鉴权/状态/证据/依赖错误 */
            default: {
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

# 自有业务接口目录

拟实现合同；统一前缀`/v1/p01`，全部DESIGN_NOT_IMPLEMENTED。

产品Bearer须逐对象授权；public仅允许公开目录/临时码交换；支付回调必须原通道验签/查单。

| 方法/路径 | operationId | 请求 → 响应数据 | 需求 |
| --- | --- | --- | --- |
| POST /sessions/platform | createPlatformSession | SessionRequest → Session | P01-F01, P01-F23 |
| POST /products | createProduct | ProductRequest → Product | P01-F01, P01-F02, P01-F03 |
| GET /products | listProducts | 无JSON体/通道原报文 → ProductList | P01-F01 |
| GET /products/{product_id} | getProduct | 无JSON体/通道原报文 → Product | P01-F01, P01-F02 |
| POST /assets | createUploadGrant | AssetRequest → UploadGrant | P01-F02, P01-F15, P01-F23 |
| POST /assets/{asset_id}/complete | completeAssetUpload | AssetCompleteRequest → Asset | P01-F02, P01-F15, P01-F25 |
| PUT /products/{product_id}/photos | bindProductPhotos | PhotoBindingRequest → Product | P01-F02, P01-F03, P01-F25 |
| POST /products/{product_id}/analyses | createAnalysis | AnalysisRequest → Analysis | P01-F03, P01-F25, P01-F26, P01-F34 |
| GET /analyses/{analysis_id} | getAnalysis | 无JSON体/通道原报文 → Analysis | P01-F03, P01-F26 |
| GET /products/{product_id}/profile | getProductProfile | 无JSON体/通道原报文 → Profile | P01-F03, P01-F26, P01-F34 |
| POST /products/{product_id}/corrections | correctProfile | CorrectionRequest → Profile | P01-F03, P01-F12, P01-F26, P01-F34 |
| GET /presets | listPresets | 无JSON体/通道原报文 → PresetSummaryList | P01-F04, P01-F21, P01-F27, P01-F29 |
| GET /presets/{preset_id}/versions/{version} | getPresetVersion | 无JSON体/通道原报文 → PresetDetail | P01-F04, P01-F21, P01-F30, P01-F33 |
| GET /presets/{preset_id}/versions/{version}/variants | listPresetVariants | 无JSON体/通道原报文 → VariantList | P01-F19, P01-F21, P01-F33, P01-F37, P01-F38, P01-F39, P01-F42, P01-F46 |
| GET /products/{product_id}/preset-recommendations | recommendPresets | 无JSON体/通道原报文 → RecommendationList | P01-F21, P01-F25, P01-F29 |
| POST /input-check | checkVariantInput | InputCheckRequest → InputCheck | P01-F21, P01-F25, P01-F36, P01-F42 |
| POST /plans | createPlan | PlanRequest → Plan | P01-F05, P01-F06, P01-F32, P01-F33, P01-F35, P01-F36, P01-F37, P01-F38, P01-F39, P01-F40 |
| GET /plans/{plan_id} | getPlan | 无JSON体/通道原报文 → Plan | P01-F05, P01-F06, P01-F35 |
| POST /products/{product_id}/previews | createOptionalPreview | PreviewRequest → Preview | P01-F06, P01-F07 |
| GET /previews/{preview_id} | getOptionalPreview | 无JSON体/通道原报文 → Preview | P01-F06 |
| POST /previews/{preview_id}/download-link | createPreviewLink | 无JSON体/通道原报文 → PreviewLink | P01-F06, P01-F15 |
| POST /quotes | createQuote | QuoteRequest → Quote | P01-F07, P01-F33, P01-F42, P01-F46 |
| POST /orders | createOrder | OrderRequest → Order | P01-F06, P01-F07, P01-F08, P01-F33 |
| GET /orders | listOrders | 无JSON体/通道原报文 → OrderList | P01-F01, P01-F08, P01-F11 |
| GET /orders/{order_id} | getOrder | 无JSON体/通道原报文 → Order | P01-F08, P01-F09, P01-F13 |
| POST /orders/{order_id}/payment-attempts | getOrCreatePaymentAction | 无JSON体/通道原报文 → PaymentAction | P01-F08, P01-F23 |
| POST /payment-events/{provider} | receivePaymentEvent | 无JSON体/通道原报文 → 原通道ACK | P01-F08, P01-F13, P01-F43 |
| GET /jobs/{job_id} | getJob | 无JSON体/通道原报文 → Job | P01-F09, P01-F43, P01-F46, P01-F49, P01-F50 |
| GET /jobs/{job_id}/stages | listJobStages | 无JSON体/通道原报文 → StageList | P01-F09, P01-F43, P01-F50 |
| GET /orders/{order_id}/deliverables | getDeliverables | 无JSON体/通道原报文 → Deliverables | P01-F10, P01-F11, P01-F40, P01-F41 |
| POST /deliverables/{deliverable_id}/download-link | createDownloadLink | 无JSON体/通道原报文 → DownloadLink | P01-F11, P01-F15, P01-F22 |
| POST /save-sessions | createSaveSession | SaveSessionRequest → SaveSession | P01-F11, P01-F22, P01-F23 |
| POST /save-receipts | recordSaveReceipt | SaveReceiptRequest → Receipt | P01-F17, P01-F22, P01-F23 |
| POST /orders/{order_id}/cancel | cancelOrder | ReasonRequest → Order | P01-F08, P01-F13, P01-F43 |
| POST /orders/{order_id}/refund-requests | requestRefund | ReasonRequest → Refund | P01-F13, P01-F16 |
| GET /refunds/{refund_id} | getRefund | 无JSON体/通道原报文 → Refund | P01-F13, P01-F16 |
| POST /orders/{order_id}/revisions | requestLimitedRevision | RevisionRequest → Revision | P01-F12 |
| GET /revisions/{revision_id} | getRevision | 无JSON体/通道原报文 → Revision | P01-F12 |
| POST /orders/{order_id}/tickets | createSupportTicket | TicketRequest → Ticket | P01-F12, P01-F14, P01-F16 |
| GET /tickets | listSupportTickets | 无JSON体/通道原报文 → TicketList | P01-F16 |
| GET /tickets/{ticket_id} | getSupportTicket | 无JSON体/通道原报文 → Ticket | P01-F16 |
| GET /help-articles | listHelpArticles | 无JSON体/通道原报文 → HelpArticleList | P01-F16 |
| POST /privacy-deletions | requestPrivacyDeletion | PrivacyDeletionRequest → PrivacyDeletion | P01-F15 |
| GET /privacy-deletions/{deletion_id} | getPrivacyDeletion | 无JSON体/通道原报文 → PrivacyDeletion | P01-F15 |
| GET /community-components | listCommunityComponents | 无JSON体/通道原报文 → ComponentOptionList | P01-F28, P01-F32 |
| GET /variant-blueprints | listVariantBlueprints | 无JSON体/通道原报文 → VariantBlueprintList | P01-F28, P01-F32, P01-F33, P01-F42 |
| GET /community-resource-versions | listCommunityResources | 无JSON体/通道原报文 → ResourceOptionList | P01-F28, P01-F30, P01-F36, P01-F40, P01-F47 |
| POST /rights-records | submitRightsRecord | RightsRecordRequest → RightsRecord | P01-F15, P01-F28, P01-F30, P01-F47 |
| GET /rights-records/{rights_record_id} | getRightsRecord | 无JSON体/通道原报文 → RightsRecord | P01-F28, P01-F30, P01-F47 |
| POST /preset-drafts | createPresetDraft | PresetDraftRequest → PresetDraft | P01-F04, P01-F28, P01-F32 |
| GET /preset-drafts | listPresetDrafts | 无JSON体/通道原报文 → PresetDraftList | P01-F28 |
| GET /preset-drafts/{draft_id} | getPresetDraft | 无JSON体/通道原报文 → PresetDraft | P01-F28, P01-F33 |
| PATCH /preset-drafts/{draft_id} | updatePresetDraft | PresetDraftPatch → PresetDraft | P01-F28, P01-F32, P01-F33 |
| POST /preset-drafts/{draft_id}/samples | createPresetSample | SampleRequest → Sample | P01-F28, P01-F36, P01-F47 |
| GET /preset-samples/{sample_id} | getPresetSample | 无JSON体/通道原报文 → Sample | P01-F28, P01-F47 |
| POST /preset-samples/{sample_id}/media-links | createPrivateSampleMediaLinks | 无JSON体/通道原报文 → SampleMedia | P01-F15, P01-F28, P01-F47 |
| GET /public-samples/{sample_id} | getPublicSampleMedia | 无JSON体/通道原报文 → PublicSampleMedia | P01-F21, P01-F28, P01-F31, P01-F47 |
| GET /appeals/{appeal_id} | getAppeal | 无JSON体/通道原报文 → Appeal | P01-F31 |
| POST /preset-drafts/{draft_id}/submit | submitPresetPublication | PublicationRequest → Publication | P01-F28, P01-F30, P01-F31, P01-F47 |
| GET /preset-publications/{publication_id} | getPresetPublication | 无JSON体/通道原报文 → Publication | P01-F28, P01-F31, P01-F50 |
| PUT /presets/{preset_id}/favorite | setFavorite | 无JSON体/通道原报文 → Favorite | P01-F29 |
| DELETE /presets/{preset_id}/favorite | deleteFavorite | 无JSON体/通道原报文 → Favorite | P01-F29 |
| GET /favorites | listFavorites | 无JSON体/通道原报文 → PresetSummaryList | P01-F29 |
| POST /presets/{preset_id}/forks | forkPreset | ForkRequest → PresetDraft | P01-F30, P01-F32 |
| POST /presets/{preset_id}/reports | reportPreset | ReportRequest → Report | P01-F31 |
| GET /reports | listReports | 无JSON体/通道原报文 → ReportList | P01-F31 |
| GET /reports/{report_id} | getReport | 无JSON体/通道原报文 → Report | P01-F31 |
| POST /reports/{report_id}/appeals | appealReportDecision | AppealRequest → Appeal | P01-F31 |

产品schema是受控DTO；支付action为产品适配器接口，获准通道的原生报文/验签/ACK在G0后分别冻结。
运营审核/停售/补偿/指标使用独立管理域，产品会话无权访问。

## 内部管理域

前缀`/v1/internal/p01`，独立管理身份/逐动作权限/审计；尚未实现。

| 方法/路径 | operationId | 权限 |
| --- | --- | --- |
| GET /publications | listReviewQueue | moderator:review |
| POST /publications/{publication_id}/review-decisions | decidePublicationReview | moderator:review |
| POST /publications/{publication_id}/publish | publishApprovedPreset | moderator:publish |
| GET /variants/{variant_id}/versions/{version} | getManagedVariantVersion | registry:read |
| GET /model-versions/{model_version_id} | getManagedModelVersion | registry:read |
| POST /variants/{variant_id}/versions/{version}/admission-decisions | decideVariantAdmission | registry:admit |
| POST /variants/{variant_id}/versions/{version}/sale-status | changeVariantAvailability | registry:availability |
| POST /model-versions/{model_version_id}/availability | changeModelAvailability | registry:availability |
| POST /reports/{report_id}/decisions | decideGovernanceReport | moderator:govern |
| GET /orders/{order_id}/trace | readRedactedOrderTrace | support:read_order_trace |
| POST /orders/{order_id}/platform-repairs | requestPlatformErrorRepair | support:repair |
| POST /orders/{order_id}/compensations | requestOriginalOrderCompensation | finance:compensate |
| POST /provider-submissions/{submission_id}/reconciliations | reconcileProviderSubmission | operator:reconcile_submission |
| GET /metrics/summary | readOperationalSummary | metrics:read |
| POST /privacy-deletions/{deletion_id}/reconcile | reconcilePrivacyDeletion | privacy:reconcile |
| GET /actions/{action_id} | getManagementAction | management:read_own_action |

## 社区恢复查询增补 v1.1

| 方法/路径 | operationId | 返回 |
| --- | --- | --- |
| GET /rights-records | listRightsRecords | RightsRecordList |
| GET /preset-drafts/{draft_id}/samples | listPresetSamples | SampleList |
| GET /preset-publications | listPresetPublications | PublicationList |
| GET /appeals | listAppeals | AppealList |
| GET /creator/reports | listAuthorReports | ReportList |
| GET /orders/{order_id}/revisions | listRevisions | RevisionList |
| POST /preset-publications/{publication_id}/sample-withdrawals | withdrawPublicSamples | Publication |
| GET /preset-licenses | listPresetLicenses | PresetLicenseList |
| GET /preset-licenses/{license_id} | getPresetLicense | PresetLicense |
## Codex管理增补 v1.1

| 方法/路径 | operationId | 权限 |
| --- | --- | --- |
| GET /agent-instances | listAgentInstances | agent:read |
| GET /agent-instances/{instance_id} | getAgentInstance | agent:read |
| POST /agent-instances/{instance_id}/release | requestAgentRelease | agent:release |
| GET /agent-runs/{run_id} | getAgentRun | agent:read |
| GET /review-packets/{packet_id} | getReviewPacket | quality:read |
| GET /skill-bundles | listSkillBundles | skills:read |
| POST /skill-bundles/{bundle_id}/revoke | revokeSkillBundle | skills:revoke |
| GET /agent-instances/{instance_id}/cleanup-receipt | getCleanupReceipt | agent:read |
| POST /preset-licenses | registerPresetLicense | moderator:review |
| POST /preset-licenses/{license_id}/decision | decidePresetLicense | moderator:publish |
| GET /support-tickets | listManagedSupportTickets | support:read |
| GET /support-tickets/{ticket_id} | getManagedSupportTicket | support:read |
| GET /support-tickets/{ticket_id}/evidence/{asset_id} | readSupportEvidence | support:evidence |
| POST /support-tickets/{ticket_id}/process | processSupportTicket | support:write |
| GET /support-tickets/{ticket_id}/repair-context | getSupportRepairContext | support:repair |
| GET /support-tickets/{ticket_id}/repair-manifests/{manifest_revision}/images/{deliverable_id} | readSupportRepairImage | support:repair |
| GET /publications/{publication_id} | getPublicationReview | moderator:review |
| GET /publications/{publication_id}/samples/{sample_id}/media/{item_id} | readPublicationReviewMedia | moderator:review |
| GET /publications/{publication_id}/rights/{rights_record_id}/evidence/{asset_id} | readPublicationRightsEvidence | moderator:review |
| GET /metrics/product-insights | readProductInsights | metrics:read |
| GET /metrics/accounts/{tenant_id}/{user_id} | getTrafficClassification | metrics:classify |
| PUT /metrics/accounts/{tenant_id}/{user_id} | setTrafficClassification | metrics:classify |

## 自愿反馈与运营分群增补（兼容扩展）

原目录状态标签保留为设计合同；源码和验证状态见实施文档。PUT 自愿反馈使用 expected_revision 比较更新，无通用幂等缓存，避免撤回后从缓存重放个人选择。

| 方法/路径 | operationId | 请求 → 响应 | 权限 |
| --- | --- | --- | --- |
| GET /orders/{order_id}/usage-feedback | getUsageFeedback | 无 → UsageFeedback | 本人订单 |
| PUT /orders/{order_id}/usage-feedback | setUsageFeedback | UsageFeedbackRequest → UsageFeedback | 本人订单 |
| GET /metrics/product-insights | readProductInsights | 无 → ProductInsights | metrics:read |
| GET /metrics/accounts/{tenant_id}/{user_id} | getTrafficClassification | 无 → TrafficClassification | metrics:classify |
| PUT /metrics/accounts/{tenant_id}/{user_id} | setTrafficClassification | TrafficClassificationRequest → TrafficClassification | metrics:classify |


## 推荐体验记录增补

| 方法/路径 | operationId | 请求 → 响应 | 权限 |
| --- | --- | --- | --- |
| POST /products/{product_id}/recommendation-events | recordRecommendationEvent | RecommendationEventRequest → RecommendationEventReceipt | 本人当前商品及签名推荐 |

GET 推荐保持只读。可见比例至少 50% 且连续停留 500ms 后报曝光；点击独立，不推断曝光或转化率。服务端自然键去重；客户端体验证据不是已验证真人或付费凭证。历史采集前保持 null。


## Plus主动接续与独立编辑草稿

所有凭证只在内存流转，原生会话批准，电脑会话限制在本人读取/草稿；不复制支付权限。自然键与修订号提供幂等，避免通用缓存复活撤销连接。

| 方法/路径 | operationId | 请求 → 响应 |
| --- | --- | --- |
| POST /plus/links | createPlusLink | PlusLinkCreateRequest → PlusLink |
| POST /plus/links/inspect | inspectPlusLink | PlusLinkInspectRequest → PlusLinkApproval |
| POST /plus/links/decision | decidePlusLink | PlusLinkDecisionRequest → PlusLinkApproval |
| POST /plus/links/{link_id}/poll | pollPlusLink | PlusLinkPollRequest → PlusLinkStatus |
| GET /plus/session | getPlusSession | 无 → PlusSessionInfo |
| GET /plus/sessions | listPlusSessions | 无 → PlusSessionList |
| DELETE /plus/sessions/{plus_session_id} | revokePlusSession | 无 → PlusSessionInfo |
| POST /plus/edit-drafts | createPlusEditDraft | PlusEditCreateRequest → PlusEditDraft |
| GET /plus/edit-drafts/{draft_id} | getPlusEditDraft | 无 → PlusEditDraft |
| PUT /plus/edit-drafts/{draft_id} | savePlusEditDraft | PlusEditSaveRequest → PlusEditDraft |
| GET /plus/edit-drafts | listPlusEditDrafts | 无 → PlusEditList |
| GET /plus/render-styles | listPlusRenderStyles | 无 → PlusRenderStyleList |
| POST /plus/edit-drafts/{draft_id}/render-plans | createPlusRenderPlan | PlusRenderCreateRequest → PlusRenderPlan |
| GET /plus/render-plans | listPlusRenderPlans | 无 → PlusRenderPlanList |
| GET /plus/render-plans/{request_id} | getPlusRenderPlan | 无 → PlusRenderPlan |

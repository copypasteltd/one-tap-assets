// Generated from the v1.1 endpoint contract; do not edit.
export const endpoints = {
  "createPlatformSession": {
    "method": "POST",
    "path": "/sessions/platform",
    "authenticated": false,
    "idempotency": false,
    "request": "SessionRequest",
    "response": "Session"
  },
  "createProduct": {
    "method": "POST",
    "path": "/products",
    "authenticated": true,
    "idempotency": true,
    "request": "ProductRequest",
    "response": "Product"
  },
  "listProducts": {
    "method": "GET",
    "path": "/products",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "ProductList"
  },
  "getProduct": {
    "method": "GET",
    "path": "/products/{product_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Product"
  },
  "createUploadGrant": {
    "method": "POST",
    "path": "/assets",
    "authenticated": true,
    "idempotency": true,
    "request": "AssetRequest",
    "response": "UploadGrant"
  },
  "completeAssetUpload": {
    "method": "POST",
    "path": "/assets/{asset_id}/complete",
    "authenticated": true,
    "idempotency": true,
    "request": "AssetCompleteRequest",
    "response": "Asset"
  },
  "bindProductPhotos": {
    "method": "PUT",
    "path": "/products/{product_id}/photos",
    "authenticated": true,
    "idempotency": true,
    "request": "PhotoBindingRequest",
    "response": "Product"
  },
  "createAnalysis": {
    "method": "POST",
    "path": "/products/{product_id}/analyses",
    "authenticated": true,
    "idempotency": true,
    "request": "AnalysisRequest",
    "response": "Analysis"
  },
  "getAnalysis": {
    "method": "GET",
    "path": "/analyses/{analysis_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Analysis"
  },
  "getProductProfile": {
    "method": "GET",
    "path": "/products/{product_id}/profile",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Profile"
  },
  "correctProfile": {
    "method": "POST",
    "path": "/products/{product_id}/corrections",
    "authenticated": true,
    "idempotency": true,
    "request": "CorrectionRequest",
    "response": "Profile"
  },
  "listPresets": {
    "method": "GET",
    "path": "/presets",
    "authenticated": false,
    "idempotency": false,
    "request": null,
    "response": "PresetSummaryList"
  },
  "getPresetVersion": {
    "method": "GET",
    "path": "/presets/{preset_id}/versions/{version}",
    "authenticated": false,
    "idempotency": false,
    "request": null,
    "response": "PresetDetail"
  },
  "listPresetVariants": {
    "method": "GET",
    "path": "/presets/{preset_id}/versions/{version}/variants",
    "authenticated": false,
    "idempotency": false,
    "request": null,
    "response": "VariantList"
  },
  "recommendPresets": {
    "method": "GET",
    "path": "/products/{product_id}/preset-recommendations",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "RecommendationList"
  },
  "checkVariantInput": {
    "method": "POST",
    "path": "/input-check",
    "authenticated": true,
    "idempotency": true,
    "request": "InputCheckRequest",
    "response": "InputCheck"
  },
  "createPlan": {
    "method": "POST",
    "path": "/plans",
    "authenticated": true,
    "idempotency": true,
    "request": "PlanRequest",
    "response": "Plan"
  },
  "getPlan": {
    "method": "GET",
    "path": "/plans/{plan_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Plan"
  },
  "createOptionalPreview": {
    "method": "POST",
    "path": "/products/{product_id}/previews",
    "authenticated": true,
    "idempotency": true,
    "request": "PreviewRequest",
    "response": "Preview"
  },
  "getOptionalPreview": {
    "method": "GET",
    "path": "/previews/{preview_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Preview"
  },
  "createPreviewLink": {
    "method": "POST",
    "path": "/previews/{preview_id}/download-link",
    "authenticated": true,
    "idempotency": true,
    "request": null,
    "response": "PreviewLink"
  },
  "createQuote": {
    "method": "POST",
    "path": "/quotes",
    "authenticated": true,
    "idempotency": true,
    "request": "QuoteRequest",
    "response": "Quote"
  },
  "createOrder": {
    "method": "POST",
    "path": "/orders",
    "authenticated": true,
    "idempotency": true,
    "request": "OrderRequest",
    "response": "Order"
  },
  "listOrders": {
    "method": "GET",
    "path": "/orders",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "OrderList"
  },
  "getOrder": {
    "method": "GET",
    "path": "/orders/{order_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Order"
  },
  "getOrCreatePaymentAction": {
    "method": "POST",
    "path": "/orders/{order_id}/payment-attempts",
    "authenticated": true,
    "idempotency": true,
    "request": null,
    "response": "PaymentAction"
  },
  "getJob": {
    "method": "GET",
    "path": "/jobs/{job_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Job"
  },
  "listJobStages": {
    "method": "GET",
    "path": "/jobs/{job_id}/stages",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "StageList"
  },
  "getDeliverables": {
    "method": "GET",
    "path": "/orders/{order_id}/deliverables",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Deliverables"
  },
  "createDownloadLink": {
    "method": "POST",
    "path": "/deliverables/{deliverable_id}/download-link",
    "authenticated": true,
    "idempotency": true,
    "request": null,
    "response": "DownloadLink"
  },
  "createSaveSession": {
    "method": "POST",
    "path": "/save-sessions",
    "authenticated": true,
    "idempotency": true,
    "request": "SaveSessionRequest",
    "response": "SaveSession"
  },
  "recordSaveReceipt": {
    "method": "POST",
    "path": "/save-receipts",
    "authenticated": true,
    "idempotency": true,
    "request": "SaveReceiptRequest",
    "response": "Receipt"
  },
  "cancelOrder": {
    "method": "POST",
    "path": "/orders/{order_id}/cancel",
    "authenticated": true,
    "idempotency": true,
    "request": "ReasonRequest",
    "response": "Order"
  },
  "requestRefund": {
    "method": "POST",
    "path": "/orders/{order_id}/refund-requests",
    "authenticated": true,
    "idempotency": true,
    "request": "ReasonRequest",
    "response": "Refund"
  },
  "getRefund": {
    "method": "GET",
    "path": "/refunds/{refund_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Refund"
  },
  "requestLimitedRevision": {
    "method": "POST",
    "path": "/orders/{order_id}/revisions",
    "authenticated": true,
    "idempotency": true,
    "request": "RevisionRequest",
    "response": "Revision"
  },
  "getRevision": {
    "method": "GET",
    "path": "/revisions/{revision_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Revision"
  },
  "createSupportTicket": {
    "method": "POST",
    "path": "/orders/{order_id}/tickets",
    "authenticated": true,
    "idempotency": true,
    "request": "TicketRequest",
    "response": "Ticket"
  },
  "listSupportTickets": {
    "method": "GET",
    "path": "/tickets",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "TicketList"
  },
  "getSupportTicket": {
    "method": "GET",
    "path": "/tickets/{ticket_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Ticket"
  },
  "listHelpArticles": {
    "method": "GET",
    "path": "/help-articles",
    "authenticated": false,
    "idempotency": false,
    "request": null,
    "response": "HelpArticleList"
  },
  "requestPrivacyDeletion": {
    "method": "POST",
    "path": "/privacy-deletions",
    "authenticated": true,
    "idempotency": true,
    "request": "PrivacyDeletionRequest",
    "response": "PrivacyDeletion"
  },
  "getPrivacyDeletion": {
    "method": "GET",
    "path": "/privacy-deletions/{deletion_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "PrivacyDeletion"
  },
  "listCommunityComponents": {
    "method": "GET",
    "path": "/community-components",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "ComponentOptionList"
  },
  "listVariantBlueprints": {
    "method": "GET",
    "path": "/variant-blueprints",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "VariantBlueprintList"
  },
  "listCommunityResources": {
    "method": "GET",
    "path": "/community-resource-versions",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "ResourceOptionList"
  },
  "submitRightsRecord": {
    "method": "POST",
    "path": "/rights-records",
    "authenticated": true,
    "idempotency": true,
    "request": "RightsRecordRequest",
    "response": "RightsRecord"
  },
  "getRightsRecord": {
    "method": "GET",
    "path": "/rights-records/{rights_record_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "RightsRecord"
  },
  "createPresetDraft": {
    "method": "POST",
    "path": "/preset-drafts",
    "authenticated": true,
    "idempotency": true,
    "request": "PresetDraftRequest",
    "response": "PresetDraft"
  },
  "listPresetDrafts": {
    "method": "GET",
    "path": "/preset-drafts",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "PresetDraftList"
  },
  "getPresetDraft": {
    "method": "GET",
    "path": "/preset-drafts/{draft_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "PresetDraft"
  },
  "updatePresetDraft": {
    "method": "PATCH",
    "path": "/preset-drafts/{draft_id}",
    "authenticated": true,
    "idempotency": true,
    "request": "PresetDraftPatch",
    "response": "PresetDraft"
  },
  "createPresetSample": {
    "method": "POST",
    "path": "/preset-drafts/{draft_id}/samples",
    "authenticated": true,
    "idempotency": true,
    "request": "SampleRequest",
    "response": "Sample"
  },
  "getPresetSample": {
    "method": "GET",
    "path": "/preset-samples/{sample_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Sample"
  },
  "createPrivateSampleMediaLinks": {
    "method": "POST",
    "path": "/preset-samples/{sample_id}/media-links",
    "authenticated": true,
    "idempotency": true,
    "request": null,
    "response": "SampleMedia"
  },
  "getPublicSampleMedia": {
    "method": "GET",
    "path": "/public-samples/{sample_id}",
    "authenticated": false,
    "idempotency": false,
    "request": null,
    "response": "PublicSampleMedia"
  },
  "getAppeal": {
    "method": "GET",
    "path": "/appeals/{appeal_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Appeal"
  },
  "submitPresetPublication": {
    "method": "POST",
    "path": "/preset-drafts/{draft_id}/submit",
    "authenticated": true,
    "idempotency": true,
    "request": "PublicationRequest",
    "response": "Publication"
  },
  "getPresetPublication": {
    "method": "GET",
    "path": "/preset-publications/{publication_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Publication"
  },
  "setFavorite": {
    "method": "PUT",
    "path": "/presets/{preset_id}/favorite",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Favorite"
  },
  "deleteFavorite": {
    "method": "DELETE",
    "path": "/presets/{preset_id}/favorite",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Favorite"
  },
  "listFavorites": {
    "method": "GET",
    "path": "/favorites",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "PresetSummaryList"
  },
  "forkPreset": {
    "method": "POST",
    "path": "/presets/{preset_id}/forks",
    "authenticated": true,
    "idempotency": true,
    "request": "ForkRequest",
    "response": "PresetDraft"
  },
  "reportPreset": {
    "method": "POST",
    "path": "/presets/{preset_id}/reports",
    "authenticated": true,
    "idempotency": true,
    "request": "ReportRequest",
    "response": "Report"
  },
  "listReports": {
    "method": "GET",
    "path": "/reports",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "ReportList"
  },
  "getReport": {
    "method": "GET",
    "path": "/reports/{report_id}",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "Report"
  },
  "appealReportDecision": {
    "method": "POST",
    "path": "/reports/{report_id}/appeals",
    "authenticated": true,
    "idempotency": true,
    "request": "AppealRequest",
    "response": "Appeal"
  },
  "listRightsRecords": {
    "method": "GET",
    "path": "/rights-records",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "RightsRecordList"
  },
  "listPresetSamples": {
    "method": "GET",
    "path": "/preset-drafts/{draft_id}/samples",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "SampleList"
  },
  "listPresetPublications": {
    "method": "GET",
    "path": "/preset-publications",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "PublicationList"
  },
  "listAppeals": {
    "method": "GET",
    "path": "/appeals",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "AppealList"
  },
  "listAuthorReports": {
    "method": "GET",
    "path": "/creator/reports",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "ReportList"
  },
  "listRevisions": {
    "method": "GET",
    "path": "/orders/{order_id}/revisions",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "RevisionList"
  },
  "withdrawPublicSamples": {
    "method": "POST",
    "path": "/preset-publications/{publication_id}/sample-withdrawals",
    "authenticated": true,
    "idempotency": true,
    "request": "PublicSampleWithdrawalRequest",
    "response": "Publication"
  },
  "listPresetLicenses": {
    "method": "GET",
    "path": "/preset-licenses",
    "authenticated": false,
    "idempotency": false,
    "request": null,
    "response": "PresetLicenseList"
  },
  "getPresetLicense": {
    "method": "GET",
    "path": "/preset-licenses/{license_id}",
    "authenticated": false,
    "idempotency": false,
    "request": null,
    "response": "PresetLicense"
  },
  "getUsageFeedback": {
    "method": "GET",
    "path": "/orders/{order_id}/usage-feedback",
    "authenticated": true,
    "idempotency": false,
    "request": null,
    "response": "UsageFeedback"
  },
  "setUsageFeedback": {
    "method": "PUT",
    "path": "/orders/{order_id}/usage-feedback",
    "authenticated": true,
    "idempotency": false,
    "request": "UsageFeedbackRequest",
    "response": "UsageFeedback"
  },
  "recordRecommendationEvent": {
    "method": "POST",
    "path": "/products/{product_id}/recommendation-events",
    "authenticated": true,
    "idempotency": false,
    "request": "RecommendationEventRequest",
    "response": "RecommendationEventReceipt"
  }
} as const;

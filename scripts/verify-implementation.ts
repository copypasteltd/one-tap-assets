import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { sha256, hash } from '../src/api/lib/crypto.js';
const root = process.cwd(); const pnpm = resolve('runtime/tools/package-manager/node_modules/pnpm/bin/pnpm.cjs');
await mkdir('runtime/test-results', { recursive: true }); await mkdir('assets/implementation', { recursive: true });
interface FileHash {path:string;sha256:string}
async function sourceFiles():Promise<FileHash[]> {
  const found:FileHash[]=[];
  async function walk(dir:string):Promise<void>{
    for(const item of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      const path=join(dir,item.name);if(item.isDirectory())await walk(path);
      else if(/\.(?:ts|tsx|cjs|js|css|html|sql|json|py|ps1)$/.test(item.name))found.push({path:relative(root,path).replaceAll('\\','/'),sha256:sha256(await readFile(path))});
    }
  }
  for(const dir of ['src','tests','scripts'])await walk(resolve(dir));
  for(const path of ['package.json','pnpm-lock.yaml','.npmrc','tsconfig.json','vitest.config.ts','vitest.integration.config.ts'])found.push({path,sha256:sha256(await readFile(path))});
  return found;
}
type CommandCheck={command:string;status:'PASS'|'FAIL';log_path:string;log_sha256:string};
let retainedIntegration:{checked_at:string;previous_source_set_hash:string;validated_source_set_hash:string;allowed_changed_files:string[];report_sha256:string;command:CommandCheck}|undefined;
// Explicit recovery of a failed mini build, not an application-test cache.
// Only the minimizer config and this verifier may differ from the prior run;
// type/unit/server/mini checks run again, while native integration is retained.
if(process.argv.includes('--retry-mini-builds')){
  const previous=JSON.parse(await readFile('assets/implementation/current.json','utf8')) as {
    checked_at:string;source_set_hash:string;files:FileHash[];runtime_contract_files:FileHash[];resource_files:FileHash[];commands:CommandCheck[]};
  const current=await sourceFiles(),prior=new Map(previous.files.map(f=>[f.path,f.sha256]));
  const allowed=new Set(['scripts/mini-config.cjs','scripts/verify-implementation.ts']);
  const changed=current.filter(f=>prior.get(f.path)!==f.sha256).map(f=>f.path);
  if(current.length!==previous.files.length||current.some(f=>!prior.has(f.path))||changed.some(path=>!allowed.has(path)))
    throw new Error('Mini retry requires unchanged application/test/config inputs');
  for(const f of [...previous.runtime_contract_files,...previous.resource_files])
    if(sha256(await readFile(f.path))!==f.sha256)throw new Error(`Mini retry contract/resource changed: ${f.path}`);
  const command=previous.commands.find(c=>c.command==='./scripts/run.ps1 test:integration');
  if(!command||command.status!=='PASS'||command.log_path!=='runtime/test-results/test-integration.log'
    ||sha256(await readFile(command.log_path))!==command.log_sha256)throw new Error('Original passing native integration log unavailable');
  const raw=await readFile('runtime/test-results/integration.json'),native=JSON.parse(raw.toString('utf8')) as TestReport;
  if(!native.success||native.numFailedTests||native.numTotalTests!==native.numPassedTests||native.startTime>Date.parse(previous.checked_at)
    ||!native.testResults.length||native.testResults.some(s=>s.status!=='passed'||s.assertionResults.some(t=>t.status!=='passed')))
    throw new Error('Original complete integration report unavailable');
  retainedIntegration={checked_at:previous.checked_at,previous_source_set_hash:previous.source_set_hash,validated_source_set_hash:hash(current),allowed_changed_files:changed,report_sha256:sha256(raw),command};
}
const results: { command: string; status: 'PASS' | 'FAIL'; log_path: string; log_sha256: string }[] = [];
const commands = ['typecheck', 'test', 'test:integration', 'build:server', 'build:alipay', 'build:douyin'];
for (const command of commands) {
  if(command==='test:integration'&&retainedIntegration){results.push(retainedIntegration.command);
    process.stdout.write('test:integration: PASS (retained native run; build-only delta verified)\n');continue;}
  const started = Date.now();
  const result = spawnSync(process.execPath, [pnpm, command], { cwd: root, windowsHide: true, encoding: 'utf8', env: process.env,
    // Native media and Codex protocol fixtures execute serially; preserve their
    // assertions and per-test limits while allowing the growing suite to finish.
    // The previous complete 342-case run took 1958s. Final-audio review adds
    // five native control cases; the whole serial command keeps its 3600s cap.
    // No prior report is retained for application changes; bail remains.
    // Test assertions, RPC, purchase deadlines and quotas stay fixed; mini builds allow 600s.
    // Unit process/module startup exhausted 180s after 44 passing cases under
    // host load; permit the full command 360s, retaining each case's 30s limit.
    // Original listening/QC round trips keep 240s and POST revocation 180s.
    // New final-role/publication round trips include two more roles and actual
    // delivery checks at 300s; existing native per-case limits stay unchanged.
    timeout: command === 'test:integration' ? 3600000 : command === 'test' ? 360000 : command === 'build:alipay' || command === 'build:douyin' ? 600000 : 180000 });
  const diagnostic = { exit_code: result.status, signal: result.signal, error_code: (result.error as NodeJS.ErrnoException | undefined)?.code ?? null, elapsed_ms: Date.now() - started };
  const log = (result.stdout ?? '') + (result.stderr ?? '') + `\nVerification process: ${JSON.stringify(diagnostic)}\n`; const path = `runtime/test-results/${command.replaceAll(':', '-')}.log`;
  await writeFile(path, log); const passed = result.status === 0; results.push({ command: `./scripts/run.ps1 ${command}`, status: passed ? 'PASS' : 'FAIL', log_path: path, log_sha256: sha256(log) });
  process.stdout.write(`${command}: ${passed ? 'PASS' : 'FAIL'}\n`);
  if (!passed) { process.stdout.write(log.slice(-6000)); process.exitCode = 1; break; }
}
interface TestReport { numTotalTests: number; numPassedTests: number; numFailedTests: number; success: boolean; startTime: number;
  testResults: { name: string; status: string; assertionResults: { status: string }[] }[] }
const suites = [];
let integrationReport: TestReport | undefined; let unitReport: TestReport | undefined;
if (results.length === commands.length && results.every(r => r.status === 'PASS')) {
  for (const kind of ['unit', 'integration']) {
    const path = `runtime/test-results/${kind}.json`; const raw = await readFile(path); const report = JSON.parse(raw.toString('utf8')) as TestReport;
    if(kind==='integration'&&retainedIntegration&&sha256(raw)!==retainedIntegration.report_sha256)throw new Error('Retained integration report changed during mini retry');
    if (!report.success || report.numFailedTests || report.numTotalTests !== report.numPassedTests) throw new Error(`Test report disagrees: ${kind}`);
    if (kind === 'integration') integrationReport = report;
    else unitReport = report;
    suites.push({ kind, status: 'PASS', tests: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests,
      executed_at: new Date(report.startTime).toISOString(), report_path: path, report_sha256: sha256(raw) });
  }
}
function verifiedCases(file: string, minimum: number, kind = 'integration'): boolean {
  const entry = (kind === 'integration' ? integrationReport : unitReport)?.testResults.find(result => result.name.replaceAll('\\', '/').endsWith(`/tests/${kind}/${file}`));
  return entry?.status === 'passed' && entry.assertionResults.length >= minimum && entry.assertionResults.every(result => result.status === 'passed');
}
const files=await sourceFiles();
if(retainedIntegration&&hash(files)!==retainedIntegration.validated_source_set_hash)throw new Error('Source changed during mini retry');
const contractFiles: { path: string; sha256: string }[] = [];
async function contractInventory(dir: string): Promise<void> {
  for (const item of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, item.name);
    if (item.isDirectory()) await contractInventory(path);
    else if (/\.(?:json|md)$/.test(item.name)) contractFiles.push({ path: relative(root, path).replaceAll('\\', '/'), sha256: sha256(await readFile(path)) });
  }
}
await contractInventory(resolve('assets/development/v1.1/contracts')); await contractInventory(resolve('assets/skills/ypcc/v1.0'));
for (const path of ['assets/presets/presets.v3.1.json', 'assets/blueprints/云端方案映射.v3.1.json', 'assets/design/柚子创作社/v1.0/design-tokens.json'])
  contractFiles.push({ path, sha256: sha256(await readFile(path)) });
const report = {
  schema_version: '1.0.0', requirements_version: '3.1', development_contract_version: '1.1', status: 'IN_PROGRESS',
  checked_at: new Date().toISOString(), full_product_verified: false, production_admitted: false, cloud_deployed: false,
  verification_mode:retainedIntegration?'MINI_BUILD_RETRY_WITH_RETAINED_NATIVE_INTEGRATION':'FRESH_FULL',
  retained_integration:retainedIntegration??null,
  command_checks_passed: results.length === commands.length && results.every(r => r.status === 'PASS'), commands: results, suites,
  source_files: files.length, source_set_hash: hash(files), files,
  runtime_contract_files: contractFiles, runtime_contract_set_hash: hash(contractFiles),
  resource_files: await Promise.all(['NotoSansSC[wght].ttf', 'OFL.txt', 'METADATA.pb', 'source.json'].map(async name => {
    const path = `assets/resources/fonts/noto-sans-sc/${name}`; return { path, sha256: sha256(await readFile(path)) };
  })),
  order_cost_envelope:{repair_hold_protected_from_first_pass:true,aftercare_hold_protected_from_first_pass:true,
    original_total_budget_unchanged:true,unknown_holds_retained:true,canonical_rate_and_owner_replay_guard:true,
    payment_revocation_and_wall_clock_deadline_guard:true,historical_obligations_preserved:true,
    fixture_verified:verifiedCases('order-budget-envelope.test.ts',6)&&verifiedCases('queue-budget.test.ts',5),
    automatic_media_repair_implemented:false,real_provider_billing_verified:false,production_admitted:false},
  mcp_observation_recovery:{acknowledged_original_intent_only:true,creation_post_never_retried:true,
    transient_get_failures_bounded:true,max_consecutive_observation_failures:3,http_cap_ms:20000,
    original_role_deadline_unchanged:true,authority_rate_limit_and_tls_failures_not_retried:true,
    stdin_close_aborts_owned_http:true,fixture_verified:verifiedCases('mcp-observation.test.ts',15),
    historical_native_asr_failure_root_cause_confirmed:false,production_admitted:false},
  worker_failure_diagnostics:{fixed_private_categories:true,raw_error_fields_logged:false,public_error_code_unchanged:true,
    log_sinks_non_authoritative:true,tool_failure_phase_recorded:true,settlement_and_original_failure_recorded:true,
    fixture_verified:verifiedCases('worker-runtime.test.ts',6)&&verifiedCases('tool-consumer.test.ts',7)
      &&verifiedCases('worker-observability.test.ts',2,'unit'),
    durable_log_delivery_verified:false,historical_fault_root_cause_confirmed:false,production_admitted:false},
  visible_text_layout:{drawn_shot_intent_claim_guard:true,actual_pinned_font_measurement:true,grapheme_wrapping:true,
    silent_truncation_allowed:false,quote_and_pre_purchase_preflight:true,ai_chapter_footer_safe_areas:true,
    renderer_version_bound:true,original_media_input_change_blocked:true,
    fixture_verified:verifiedCases('profile-plan.test.ts',7,'unit')&&verifiedCases('native-media.test.ts',4)
      &&verifiedCases('codex-planning.test.ts',12)&&verifiedCases('media-stages.test.ts',12),
    automatic_media_repair_implemented:false,real_model_semantics_verified:false,production_admitted:false},
  ai_disclosure:{private_contract_frozen:true,actual_image_glyph_check:true,actual_image_alpha_check:true,all_video_frames_checked:true,
    generated_and_native_pipeline_connected:true,
    fixture_verified:verifiedCases('disclosure.test.ts',3)&&verifiedCases('disclosure.test.ts',5,'unit')
      &&verifiedCases('generated-production.test.ts',7)&&verifiedCases('native-order.test.ts',23),
    official_multi_means:'CONTINUOUS_MULTI_SHOT_NOT_REQUIRED_MULTI_SPEAKER',
    real_generated_content_quality_verified:false,host_or_legal_marking_admitted:false,production_admitted:false},
  scope: ['Actual Fastify routes and native PostgreSQL', 'Real synthetic image normalization and EXIF removal', 'Native ten-style PNG and 30-frame FFmpeg/ffprobe smoke', 'Lease fencing, dependencies, outbox, tenant isolation, atomic budget and idempotency', 'Payment state recovery with explicit synthetic transport', 'Codex stdio transport with a self-authored fixture process', 'Worker heartbeat, deadline compensation, registration filters and native server build', 'Image payloads, durable vision receipts, platform cost isolation and unknown-request recovery using explicit synthetic transport', 'Scoped content and photo production/post tools, stale completion rejection, per-role inference and whole-order call quotas', 'Alipay and Douyin native bundles for 17 shared screens including favorites, creator drafts, rights records, publication status and moderation; C visual tokens, generated endpoint client and cursor paging; compilation only', 'Account-scoped client recovery, ambiguous native payment creation and per-file album journals using explicit host fixtures', 'Client photo-batch retries through actual API and native PostgreSQL; authorized bounded multipart uploads', 'Private photo production and explicit post-processing via synthetic stdio roles and real HTTPS/MCP, native media, original receipt recovery, complete-slot and proof checks; one-second synthetic contract only', 'Pinned OFL font, sold resource/license bindings, actual private QC, immutable review packets and native uniform/boundary/scene-change frame evidence; real-model semantic quality remains unverified', 'Fresh independent review roles with complete sealed PNG/text input and rejected forged reports, recovery without rebuy, atomic whole-pack PHOTO publication, final commit fencing and hash-checked authorized downloads; synthetic Codex/inference only'],
  client_implementation: { mini_shared_pages: 17, community_pages_implemented: true,
    community_api_recovery_fixture_verified: verifiedCases('community.test.ts', 9) && verifiedCases('client.test.ts', 5, 'unit'),
    creator_publication_form_implemented: true,
    creator_publication_api_fixture_verified: verifiedCases('publication-workflow.test.ts', 24),
    sample_worker_implemented: true,
    sample_photo_pipeline_fixture_verified: verifiedCases('sample-production.test.ts', 13),
    public_sample_lifecycle_implemented: true,
    public_sample_lifecycle_fixture_verified: verifiedCases('publication-workflow.test.ts', 24) && verifiedCases('sample-production.test.ts', 13),
    optional_photo_preview_implemented: true,
    optional_photo_preview_fixture_verified: verifiedCases('optional-preview.test.ts', 10),
    generated_preview_implemented: false, limited_revision_worker_implemented: true,
    limited_revision_photo_pipeline_fixture_verified: verifiedCases('limited-revision.test.ts', 15),
    limited_revision_all_routes_verified: false,
    native_device_ui_verified: false, complete_creator_publication_flow_verified: false, plus_web_implemented: false,
    notes: 'Seventeen shared screens include creator product/rights selection, private samples, separate license/public-copy consent, submission and withdrawal. SAMPLE has seven durable stages, independent frozen costs, five synthetic roles, native PHOTO media/post/QC and sealed double review. Actual produced PNG/MP4 samples also pass approval, independent registered public copying and public byte downloads without new inference. Other publication cases use explicit READY/QC fixtures only in APP_ENV=test. Public copies have frozen 30-day consent, revoke/expiry/rights/resource checks, fenced recovery and late-PUT cleanup; signed deletion replay preserves RETENTION while USER deletion ends distribution. Native UI, generated/audio/custom-resource samples, production Bundle admission and Plus remain incomplete.' },
  generation_implementation: { provider: 'VOLCENGINE_ARK', wire_contracts: ['ARK_IMAGE','ARK_VIDEO'],
    quote_contract_and_budget_guards_implemented: true, original_order_cost_ledger_implemented: true,
    durable_original_submission_recovery_implemented: true, native_media_fixture_verified: verifiedCases('generation-gateway.test.ts',35),
    original_stage_binding_fixture_verified: verifiedCases('generation-gateway.test.ts',35),
    unsettled_generation_receipts_retained: true, absolute_purchase_deadline_propagated: true,
    production_tools_registered: true, generated_reference_semantic_gate_implemented: true,
    production_tools_fixture_verified: verifiedCases('generation-tools.test.ts',6),
    reference_purchase_gate_fixture_verified: verifiedCases('generation-gateway.test.ts',35) && verifiedCases('reference-identity.test.ts',15),
    reference_identity_service_implemented: true,
    reference_identity_service_fixture_verified: verifiedCases('reference-identity.test.ts',15),
    silent_generated_pack_implemented: true,
    silent_generated_pack_fixture_verified: verifiedCases('generated-production.test.ts',7),
    generated_post_qc_final_review_delivery_implemented: true,
    generated_original_role_recovery_fixture_verified: verifiedCases('generated-production.test.ts',7),
    silent_qc_policy: 'YPCC-QC-GENERATED-SILENT-1.0.0',
    all_generated_routes_verified: false, native_audio_verified: false, real_provider_call_verified: false,
    notes: 'Both silent generated routes now execute platform-derived references, a released independent identity review, one PRODUCTION role and bounded render_generated_pack, actual generated image/video assembly, explicit POST, route-specific QC, fresh final facts/style reviews and atomic delivery. Reference and final facts runs share the original two-turn facts bucket; five paid roles and twelve tool calls must fit the sold limits. Same-generation role uniqueness, original budget and deadline remain unchanged. Generated source/approval hashes and actual stored bytes are revalidated through post, QC and publication, including inside the publication transaction. Seven complete-pack/rejection/recovery fixtures join the 35 gateway, 6 MCP and 15 reference cases, using native PostgreSQL, actual PNG/MP4, HTTPS and stdio/MCP with synthetic model, usage and isolation. Actual source clip colors and order are checked after final download; no still-animation substitution. Official audio variants, real semantic quality/provider admission, generated SAMPLE/revisions and full variant benchmarks remain incomplete.' },
  native_audio_kernel: { implemented:true,native_fixture_verified:verifiedCases('native-audio.test.ts',15),
    policy:'YPCC-NATIVE-AUDIO-KERNEL-1.0.0',caption_styles:['standard','bold','minimal','karaoke'],
    actual_pcm_decode:true,actual_caption_burn_in:true,native_voice_unit_gain:true,licensed_bed_ducking:true,
    original_deadline_and_cancellation:true,durable_asr_implemented:true,independent_audio_review_implemented:true,order_tool_registered:true,
    native_speech_order_admitted:false,real_chinese_speech_verified:false,
    notes:'Standalone kernel fixtures use native PostgreSQL/FFmpeg/AAC/PNG/PCM with synthetic tones and explicitly manual timecodes. Actual encoded waveforms, subtitle pixels/timing, music-only ducking, revocation, sample counts, loops and cleanup are exercised. The separate native_order_media scope now wraps the kernel in private ORDER PRODUCTION/POST; kernel proof flags still describe its standalone scope. Receipt hashes and signal presence do not certify recognition, semantic listening or complete audible delivery. NATIVE_AUDIO_NOT_ADMITTED remains.' },
  speech_transcription: {implemented:true,native_fixture_verified:verifiedCases('speech-gateway.test.ts',17),
    provider:'ALIYUN_DASHSCOPE',wire:'QWEN3_ASR_FLASH_FILETRANS_ASYNC',original_intent_receipts_and_budget:true,
    private_mono_wav:true,legacy_distinct_stereo_rejected:true,frozen_mean_stereo_derivative:true,phase_cancellation_guard:true,actual_word_timestamps_required:true,stored_receipt_maintenance:true,
    order_tool_registered:true,production_post_connected:true,order_pipeline_connected:true,real_provider_verified:false,real_chinese_speech_verified:false,native_speech_order_admitted:false,
    notes:'Native PostgreSQL/FFmpeg/AAC/PCM/private files with synthetic HTTPS transport and transcript/usage responses. Original intent, send marker, task ID, append-only ACK/query/result, source/PCM/WAV hashes and original cost reservation persist. Missing ACK/usage never permits another purchase. Legacy contracts require identical stereo; an explicitly frozen MEAN_STEREO_V1 derivative uses both channels, rejects destructive cancellation and leaves production stereo unchanged. Private POST/QC, original listening, final roles and publication are connected; real recognition/listening/billing and public audio admission remain closed.'},
  native_audio_contract: {implemented:true,native_fixture_verified:verifiedCases('audio-contract.test.ts',23),
    version:'YPCC-NATIVE-AUDIO-CONTRACT-1',frozen_character_voice_video_binding:true,frozen_captions_and_music:true,
    original_order_budget_and_once_only_prepaid_allocation:true,one_assembled_track_asr_intent:true,live_rights_on_payment_and_resume:true,
    immutable_license_and_character_evidence:true,native_quotes_admitted:false,order_tool_registered:true,production_post_connected:true,order_pipeline_connected:true,
    independent_audio_review_implemented:true,real_authorizations_verified:false,real_provider_verified:false,
    notes:'Native PostgreSQL/FFmpeg/actual AAC plus synthetic character/voice/music authorization, ASR transport/transcript/usage and payment facts. Contract compilation, snapshot hashes, revoked-rights payment refund intent, original budget and concurrent full-track ASR limits are exercised. Fixed prepaid allocation is internal accounting, not proof of an external license purchase. The official multi variant means continuous multi-shot, not required multiple speakers; real cross-shot product/character quality remains unverified. NATIVE_AUDIO_NOT_ADMITTED and all sales-disabled gates remain.'},
  native_order_media: {implemented:true,native_fixture_verified:verifiedCases('native-order.test.ts',23),
    version:'YPCC-NATIVE-ORDER-PIPELINE-1',routes:['PER_SHOT_AI','REFERENCE_FILM'],production_post_connected:true,
    actual_full_track_pcm_assembly:true,lossless_intermediate_codec:'ALAC',final_audio_codec:'AAC',canonical_original_source_only:true,
    scoped_asr_tool:true,once_only_original_asr:true,stored_post_receipt_restore:true,licensed_music_bytes_preflight:true,
    frozen_mono_derivative:'MEAN_STEREO_V1',independent_audio_review_implemented:true,audio_qc_connected:true,
    audio_delivery_connected:true,native_quotes_admitted:false,official_multi_presenter_verified:false,official_multi_shot_verified:false,real_provider_verified:false,
    notes:'Twenty-three native PostgreSQL/actual AAC-ALAC-PCM/media/HTTPS-stdio-MCP cases with synthetic external model, authorizations, ASR/usage and isolation. Twelve original production/POST/file-QC cases seal complete stereo tracks, original settled ASR and actual caption frames; six foundation cases preserve uncertainty/UNKNOWN and original receipts/costs. Five final-review cases exercise both route deliveries, original-role recovery, exact receipt and billing holds, durable irreversible voice revocation and missing role/tool listening inputs; actual final media now binds full-frame AI disclosure. Positive Chinese/semantic PASS is deliberately fabricated over tone fixtures for control testing, never real hearing certification. No public audio, official continuous multi-shot or real-provider admission. The retained multi-presenter field refers only to an optional multi-speaker extension, not an extra official P0 requirement.'},
  native_audio_qc: {implemented:true,native_fixture_verified:verifiedCases('native-order.test.ts',23),
    unit_fixture_verified:verifiedCases('native-review-audio.test.ts',4,'unit'),policy:'YPCC-QC-GENERATED-NATIVE-AUDIO-1.0.0',
    evidence_version:'YPCC-NATIVE-AUDIO-QC-EVIDENCE-1',full_stereo_review_wav:true,original_settled_asr_only:true,
    independent_mix_reconstruction:true,caption_timecode_frames:true,commit_time_source_license_and_bytes_recheck:true,
    immutable_sealed_evidence:true,semantic_review:'PENDING',independent_listening:'REQUIRED',
    independent_listening_implemented:true,final_reviews_connected:true,final_reviews_admitted:false,audio_delivery_connected:true,
    notes:'Technical file QC retains its original PENDING/REQUIRED historical fields. Complete source/final stereo WAV, original ASR JSON, actual ASS and QC JSON stay immutable. A separate original listening response and fresh final facts/style reports now authorize private publication, with original bytes/rights/costs rechecked at every consumption boundary. Positive semantics are fabricated control fixtures; real-model quality and commercial final-review admission remain false. ASR or a visual report cannot replace the original listening approval.'},
  native_listening: {implemented:true,wire:'QWEN_OMNI_STEREO_CHAT_SSE_1',
    unit_fixture_verified:verifiedCases('listening.test.ts',7,'unit'),native_fixture_verified:verifiedCases('native-order.test.ts',23),
    complete_original_and_final_stereo_wav:true,all_sealed_images:true,original_contract_and_budget:true,
    exact_original_request_response:true,unknown_never_repurchased:true,saved_receipt_maintenance:true,
    reasoning_output_metered:true,cached_usage_policy:'REQUIRE_ZERO_OR_HOLD',uncertain_observations_retained:true,
    final_codex_stages_connected:true,final_review_reports_connected:true,final_review_reports_admitted:false,audio_delivery_connected:true,
    final_review_publication_fixture_verified:verifiedCases('native-order.test.ts',23),synthetic_semantic_pass_only:true,
    real_model_listening_verified:false,real_usage_cache_billing_verified:false,native_speech_order_admitted:false,
    notes:'Private platform preparation plus final-role/report/publication integration. FACTS alone prepares or recovers one original request per packet; STYLE, metered inference, report validation and publication read exact original bytes/usage/settlement and complete current stereo/visual material. Both fresh roles receive the full same observation object; inference and controlled tool proofs bind its hash, immutable reports cover the full input and the private manifest links original receipt/result hashes. Original tones remain INSUFFICIENT in negative cases. Positive Chinese PASS is deliberately fabricated to test control bindings, not a speech/listening/billing claim. Seven protocol units and twenty-three order cases include five new final-review/revocation/missing-proof scenarios. All public sales, real listening/cache billing and official variants remain unadmitted.'},
  codex_implementation: { scope: 'CONTENT PLAN, silent PHOTO_LAYOUT/PER_SHOT_AI/REFERENCE_FILM PRODUCTION/POST, private native-audio PER_SHOT_AI/REFERENCE_FILM PRODUCTION/POST/QC with scoped original-track ASR, complete stereo evidence and original paid listening bound through final REVIEW_FACTS/REVIEW_STYLE inputs/inference/tools/immutable reports and transactional native publication, independent generated-reference facts review, metered Responses gateway, atomic silent pack publication, independent seven-stage photo creator SAMPLE pipeline',
    fixture_tests_only: true, real_codex_turn_verified: false, native_launcher_executable_provided: false,
    native_isolation_verified: false, certified_token_cost_bound_verified: false, independent_reaper_implemented: true,
    independent_reaper_fixture_verified: verifiedCases('instance-reaper.test.ts', 11) && verifiedCases('built-worker.test.ts', 3),
    review_publication_fixture_verified: verifiedCases('review-delivery.test.ts', 8),
    scoped_internal_traffic_fixture_verified: verifiedCases('agent-traffic.test.ts', 3),
    role_lease_heartbeat_fixture_verified: verifiedCases('codex-planning.test.ts', 11),
    limited_revision_notes: 'Five durable REVISION stages produce a new linked PHOTO_LAYOUT/no-speech manifest for existing-image cover selection, full-pack display order or actual replacement copy bytes. Three new synthetic roles review a new sealed packet; original expiry and original delivery remain intact. Pre-sale frozen aftercare costs share the original total budget across failed retries; UNKNOWN holds are not reset. Stage fencing, recovery, late writes and private role graph are exercised. Generated/audio revisions and real Codex/isolation/device verification remain incomplete. Internal traffic is bounded per live run across all four tool/inference routes; invalid/revoked tokens use the shared IP bucket, and durable cost/tool limits still apply.',
    notes: 'Real HTTPS/MCP, synthetic native stdio roles, persisted planning/photo media and complete sealed visual/text review inputs, original receipt recovery, immutable independent reports, fenced atomic publication and authorized hash-checked downloads are exercised. Independent durable reaping uses registered real Node children and test-only cleanup ports; claims, expired-owner rejection, immutable retries and actual directory guards are exercised. All model judgments, token usage and native isolation assertions remain fixtures. Real Codex, restricted OS identity/process-tree cleanup, certified image cost, semantic quality, official generated/audio variants and bounded repair remain incomplete; both short silent generated pack fixtures have separate native coverage.' },
  lifecycle_implementation: { independent_reaper_entry: 'src/worker/lifecycle/reaper-main.ts',
    cleanup_protocol: 'YPCC-CLEANUP-1', cleanup_evidence: 'IMMUTABLE_PER_GENERATION',
    cleanup_ports_test_only: true, real_native_cleanup_verified: false,
    frozen_input_retention_fixture_verified: verifiedCases('payment-recovery.test.ts', 8) && verifiedCases('review-delivery.test.ts', 8),
    physical_privacy_deletion_verified: false,
    media_maintenance_entry: 'src/worker/lifecycle/media-maintenance-main.ts',
    controlled_object_erasure_implemented: true,
    controlled_object_erasure_fixture_verified: verifiedCases('media-erasure.test.ts', 14) && verifiedCases('built-worker.test.ts', 4),
    oss_version_erasure_fixture_verified: verifiedCases('oss-erasure.test.ts', 4, 'unit'),
    uncertain_object_recovery_fixture_verified: verifiedCases('private-object-recovery.test.ts', 3),
    retired_receipt_reconciliation_fixture_verified: verifiedCases('codex-inference.test.ts', 11) && verifiedCases('vision-analysis.test.ts', 8),
    private_database_redaction_implemented: true, private_database_redaction_fixture_verified: verifiedCases('privacy-redaction.test.ts', 5),
    external_deletion_journal_implemented: true, restore_admission_gate_implemented: true,
    backup_deletion_replay_fixture_verified: verifiedCases('privacy-restore.test.ts', 7) && verifiedCases('built-worker.test.ts', 4),
    privacy_journal_cli_fixture_verified: verifiedCases('built-worker.test.ts', 4),
    journal_production_durability_verified: false, financial_restore_verified: false,
    real_oss_version_erasure_verified: false, privacy_database_redaction_verified: false, backup_deletion_replay_verified: false,
    notes: 'Unpaid creation does not extend TTL; paid frozen inputs retain their entitlement. Private keys are written once and registered before I/O. Maintenance verifies original UNKNOWN bytes, settles durable original Codex/vision receipts after role retirement without purchasing inference, and erases exact objects with immutable attempts. Controlled private DB content is redacted only after binaries, instance release, capabilities, tools and billing settle; the original 32-table checks are extended with private SAMPLE source and role graph coverage in a 33-table policy; immutable per-row digest receipts and database guards reject forged receipts or content restoration. A separate signed hash-chain journal, frozen deletion sets, API/Worker/tool admission gates and original-request replay are exercised against an actual native PostgreSQL pg_dump/pg_restore and restored synthetic file bytes. Malformed legacy locators no longer starve other maintenance requests. Completing controlled privacy replay retains a financial recovery hold; only non-production preview with all paid flags disabled can resume. Off-host checkpoint durability, key rotation, power-loss/ACL guarantees, financial restore, WAL/provider/replica copies, real OSS and production isolation remain unverified. Live WRITING, missing/mismatched original bytes and unsettled billing remain blocked; full privacy completion remains false.' },
  not_verified: ['Real end-to-end product execution and production admission of every registered stage; a complete handler registry is not production readiness',
    'Generated/audio/custom-resource creator samples, production community SkillBundle admission, generated/audio revisions and native revision UI verification, Plus/management web interfaces; public sample lifecycle has native/fixture coverage but no production admission',
    'Native host login/upload/payment/album behavior and visual review on actual devices', 'Real Codex/model/payment calls', 'Operator native restricted-identity launcher executable, actual OS isolation and certified inference hard limits', 'Real-model independent semantic reviews, actual native process-tree cleanup and production orphan reaping', 'Full privacy erasure across private DB/provider/replica copies and real OSS; production off-host deletion-journal durability and backup replay admission; uncertain writes remain blocked', 'Independent post-backup payment/usage intent recovery and financial restore admission', 'All three production pipelines and 420 full-pack benchmark runs', 'Four physical-device groups', 'Windows native media long-run stability after one intermittent C0000374 heap termination', 'Production deployment and full 58-requirement audit'],
  source_license: 'Independently written project source; upstream AGPL clone remains research-only; no upstream production implementation copied.',
};
await writeFile('assets/implementation/current.json', JSON.stringify(report, null, 2) + '\n');
process.stdout.write(`Evidence recorded: ${files.length} source/test/build-config files; full product remains unverified.\n`);

import {addSeconds,id} from '../../src/api/lib/crypto.js';
import {LISTENING_WIRE,type ListeningContract,type ListeningResult,type PreparedListening} from '../../src/worker/providers/omni-listening.js';

/** Synthetic model, authorization, semantic observations and price. It proves
 * protocol/ledger boundaries, never that a tone contains Chinese speech. */
export function syntheticListeningContract():ListeningContract{
  return {version:LISTENING_WIRE,state:'ADMITTED',provider:'SYNTHETIC-NOT-REAL',model_version_id:id('synthetic_listening'),
    actual_model:'qwen3.8-omni-flash',base_url:'https://listening.example.test/compatible-mode/v1',registry_version:'SYNTHETIC-1',
    rate_snapshot_id:'SYNTHETIC-NO-REAL-PRICE',official_documentation:'https://help.aliyun.com/en/model-studio/qwen-omni',
    capability_evidence_sha256:'b'.repeat(64),valid_until:addSeconds(3600),use_multichannel:true,audio_format:'wav',
    non_audio_input_policy:'UNIFORM_TEXT_IMAGE_RATE',cached_usage_policy:'REQUIRE_ZERO_OR_HOLD',max_target_frames:900,max_images:100,
    max_total_image_bytes:6000000,max_request_bytes:32000000,certified_max_input_tokens:10000,max_output_tokens:8000,
    non_audio_micro_per_million:1000,audio_micro_per_million:2000,output_micro_per_million:3000,per_request_ceiling_micro:100,max_packets:2,
    no_charge_http_statuses:[400,401,403,413,429]};
}
export function syntheticListeningResult(summary:PreparedListening['summary']):ListeningResult{
  return {version:'YPCC-INDEPENDENT-LISTENING-1',packet_hash:summary.packet_hash,verdict:'INSUFFICIENT',
    tracks:summary.audios.map(a=>({audio_asset_id:a.asset_id,segments:[{start_ms:0,end_ms:summary.duration_ms,kind:'UNCERTAIN',heard_text:''}]})),
    checks:{native_preservation:'INSUFFICIENT',intelligibility:'INSUFFICIENT',music_masking:'INSUFFICIENT',caption_agreement:'INSUFFICIENT',spoken_facts:'INSUFFICIENT'},findings:[]};
}
/** Deliberately fabricated positive semantic response for authorization and
 * delivery-control tests ONLY. The actual fixture is a tone, not this text.
 * Never publish this as evidence of real listening, speech or Chinese quality. */
export function syntheticControlListeningPass(summary:PreparedListening['summary']):ListeningResult{
  const result=syntheticListeningResult(summary);result.verdict='PASS';
  for(const key of Object.keys(result.checks) as (keyof typeof result.checks)[])result.checks[key]='PASS';
  for(const track of result.tracks)track.segments=[{start_ms:0,end_ms:summary.duration_ms,kind:'SPEECH',
    heard_text:'合成控制流程批准响应，并非实际音频识别结果。'}];
  return result;
}
export function listeningSse(c:ListeningContract,result:ListeningResult,change?:(usage:Record<string,unknown>)=>void):Buffer{
  const usage:Record<string,unknown>={prompt_tokens:1000,completion_tokens:200,total_tokens:1200,
    prompt_tokens_details:{audio_tokens:400,text_tokens:600,cached_tokens:0},completion_tokens_details:{reasoning_tokens:120,text_tokens:80}};
  change?.(usage);
  const base={id:'synthetic-original-listening',model:c.actual_model,object:'chat.completion.chunk'};
  const events=[{...base,choices:[{index:0,delta:{content:JSON.stringify(result)},finish_reason:null}],usage:null},
    {...base,choices:[{index:0,delta:{},finish_reason:'stop'}],usage:null},{...base,choices:[],usage}];
  return Buffer.from(events.map(e=>`data: ${JSON.stringify(e)}\n\n`).join('')+'data: [DONE]\n\n');
}

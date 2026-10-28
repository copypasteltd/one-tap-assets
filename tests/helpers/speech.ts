import {addSeconds,id} from '../../src/api/lib/crypto.js';
import {ASR_DOCUMENTATION,type SpeechContract} from '../../src/worker/providers/dashscope-asr.js';

/** Synthetic HTTPS/model/price admission; no recognizer or billing evidence. */
export function syntheticSpeechContract(seconds=1):SpeechContract {
  return {version:'YPCC-DASHSCOPE-FILETRANS-1',provider:'ALIYUN_DASHSCOPE',state:'ADMITTED',model_version_id:id('synthetic_asr'),
    request_model:'qwen3-asr-flash-filetrans',actual_model:'qwen3-asr-flash-filetrans',registry_version:'SYNTHETIC-NOT-PRODUCTION',rate_snapshot_id:'synthetic-asr-rate',
    base_url:'https://speech.example.test/api/v1',official_documentation:ASR_DOCUMENTATION,capability_evidence_sha256:'a'.repeat(64),valid_until:addSeconds(3600),
    input_hosts:['input.example.test'],result_hosts:['result.example.test'],max_response_bytes:100000,max_queries:4,poll_seconds:1,max_audio_seconds:seconds,
    rate:{unit:'AUDIO_SECOND',micro_per_million_units:100_000_000,max_billable_units:seconds,ceiling_micro:100*seconds}};
}

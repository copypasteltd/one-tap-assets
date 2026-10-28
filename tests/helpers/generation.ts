import type {ArkContract} from '../../src/worker/providers/ark.js';
import {addSeconds,id} from '../../src/api/lib/crypto.js';

/** Synthetic model/rate/media limits, never a real provider admission. */
export function syntheticArkContract(kind:'IMAGE'|'VIDEO'):ArkContract{
  return {schema_version:'1.0.0',state:'ADMITTED',provider:'VOLCENGINE_ARK',wire:kind==='IMAGE'?'ARK_IMAGE':'ARK_VIDEO',
    model_version_id:id(`synthetic_${kind}`),request_model:`synthetic-${kind.toLowerCase()}`,actual_model:`synthetic-${kind.toLowerCase()}`,
    registry_version:'SYNTHETIC-NOT-PRODUCTION',rate_snapshot_id:`synthetic-${kind.toLowerCase()}-rate`,base_url:'https://generation.example.test/api/v3',
    official_documentation:kind==='IMAGE'?'https://docs.volcengine.com/docs/ark/image-generation-api':'https://docs.volcengine.com/docs/ark/create-video-generation-task-api',
    capability_evidence_sha256:'a'.repeat(64),valid_until:addSeconds(3600),max_request_bytes:5000000,max_response_bytes:4000000,max_download_bytes:4000000,
    max_images:5,max_image_pixels:1000000,max_total_pixels:3000000,media_hosts:['media.example.test'],no_charge_http_statuses:[400],
    rate:kind==='IMAGE'?{unit:'IMAGE',micro_per_million_units:100000000,max_billable_units:1,ceiling_micro:100}
      :{unit:'VIDEO_TOKEN',micro_per_million_units:1000000,max_billable_units:500,ceiling_micro:500},
    image:kind==='IMAGE'?{width:640,height:800,grouping_control:'EXPLICIT_DISABLED'}:null,
    video:kind==='VIDEO'?{durations:[1],resolutions:['480p'],ratios:['3:4'],dimensions:[{resolution:'480p',ratio:'3:4',width:480,height:640}],
      reference_modes:['FIRST_FRAME','REFERENCE_IMAGES'],native_audio:false,max_status_queries:4,poll_seconds:1}:null};
}

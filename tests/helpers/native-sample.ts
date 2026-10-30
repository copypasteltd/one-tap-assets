import type {TestDatabase} from './database.js';
import type {Config} from '../../src/api/config.js';
import type {VariantSource} from '../../src/api/modules/catalog.js';
import type {ArkContract} from '../../src/worker/providers/ark.js';
import {syntheticSpeechContract} from './speech.js';
import {syntheticListeningContract} from './listening.js';
import {addSeconds,hash,id,sha256} from '../../src/api/lib/crypto.js';
import {insert} from '../../src/api/db/store.js';
import type {AudioRightKind,CharacterVoiceAdmission} from '../../src/worker/audio/contract.js';

/** Synthetic public-SAMPLE authorization only. Creates no paid order or buyer budget. */
export async function nativeSampleRegistry(db:TestDatabase,cfg:Config,source:VariantSource,video:ArkContract,use:'SAMPLE'|'ORDER'='SAMPLE'){
  if(cfg.env!=='test')throw new Error('Synthetic sample registry is test-only');
  const speech=syntheticSpeechContract(source.timeline_policy.target_frames/30),listening=syntheticListeningContract();speech.channel_policy='MEAN_STEREO_V1';
  cfg.provider.speech={enabled:true,baseUrl:speech.base_url,apiKey:'SYNTHETIC-NOT-REAL',allowedHosts:['speech.example.test','input.example.test','result.example.test']};
  cfg.provider.listening={enabled:true,baseUrl:listening.base_url,apiKey:'SYNTHETIC-NOT-REAL',allowedHosts:['listening.example.test']};
  const licenses:string[]=[];
  const license=async(kind:AudioRightKind)=>{
    const binding={resource_version_id:id('sample_resource'),license_record_id:id('sample_license'),hash:sha256(id('synthetic_sample_right'))};
    const text='SYNTHETIC SAMPLE ONLY — NO REAL CHARACTER, VOICE OR MUSIC AUTHORIZATION';
    await insert(db.pool,'resource_licenses',{id:binding.license_record_id,resource_id:binding.resource_version_id,version:'SYNTHETIC-SAMPLE-1',expires_at:addSeconds(3600),data:{
      resource_version_id:binding.resource_version_id,resource_hash:binding.hash,admission_state:'ADMITTED',license_text:text,license_sha256:sha256(text),
      audio_rights:use==='SAMPLE'?{sample:{kind,allowed_use:'PUBLIC_ADVERTISING_SAMPLE',allocation_mode:'PREPAID_PLATFORM_SAMPLE_ALLOCATION',allocation_micro:20}}:
        {kind,allowed_use:'GENERATED_COMMERCIAL_AD',allocation_mode:'PREPAID_ORDER_ALLOCATION',allocation_micro:20}}});
    licenses.push(binding.license_record_id);return binding;
  };
  const character:CharacterVoiceAdmission={version:'YPCC-CHARACTER-VOICE-1',character_version_id:id('sample_character'),native_voice_id:id('sample_voice'),
    video_model_version_id:video.model_version_id,evidence_sha256:'e'.repeat(64),valid_until:addSeconds(3600),language:'zh-CN',secondary_tts:false,
    character_binding:await license('NATIVE_CHARACTER'),voice_binding:await license('NATIVE_VOICE')};
  await insert(db.pool,'character_versions',{id:character.character_version_id,character_id:id('synthetic_sample_person'),version:'SYNTHETIC-SAMPLE-1',
    data:{admission_state:'ADMITTED',native_voice_ids:[character.native_voice_id],native_audio_admissions:[character]}});
  for(const [c,role,key] of [[speech,'SPEECH','speech_contract'],[listening,'QC','listening_contract']] as const){
    const binding={provider:c.provider,actual_model:c.actual_model,registry_version:c.registry_version,roles:[role],capability_hash:hash(c),rate_snapshot_id:c.rate_snapshot_id};
    await insert(db.pool,'provider_model_versions',{id:c.model_version_id,provider:c.provider,actual_model:c.actual_model,status:'ADMITTED',version:c.registry_version,data:binding,private:{[key]:c}});
  }
  source.audio_policy={speech:'native_speech',language:'zh-CN',music:'approved_licensed_or_contract_silent',preserve_native_speech:true,
    caption_alignment:'actual_audio',second_tts_over_native_speech_allowed:false,action_sound_required:false};
  source.creative_components={...source.creative_components,caption_preset:'karaoke',music_asset_version:null,bgm_volume:.15,bgm_duck:true,music_loop_to_timeline:true};
  return {speech,listening,character,licenses};
}

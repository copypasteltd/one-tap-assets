import {mkdir} from 'node:fs/promises';
import {config,inside} from '../../src/api/config.js';
import {insert} from '../../src/api/db/store.js';
import {transaction} from '../../src/api/db/pool.js';
import {addSeconds,hash,id,sha256} from '../../src/api/lib/crypto.js';
import {storage,type ObjectStorage} from '../../src/api/storage/storage.js';
import type {ResourceBinding} from '../../src/worker/compiler/snapshot.js';
import {freezeNativeAudio,type AudioRightKind,type CharacterVoiceAdmission,type SpeechModelRow} from '../../src/worker/audio/contract.js';
import {NATIVE_AUDIO_QC_POLICY} from '../../src/worker/generation/contracts.js';
import type {TestDatabase} from './database.js';
import {mediaFixture} from './media.js';
import {syntheticArkContract} from './generation.js';
import {syntheticSpeechContract} from './speech.js';
import {syntheticListeningContract} from './listening.js';

/** A complete private ORDER input, with synthetic authorization/model/price
 * registrations. This never changes public sales or real-provider admission. */
export async function nativeOrderFixture(db:TestDatabase,root:string,options:{engine:'PER_SHOT_AI'|'REFERENCE_FILM';music?:Buffer;style?:'standard'|'bold'|'minimal'|'karaoke';listening?:boolean;revisions?:boolean}={engine:'PER_SHOT_AI'}){
  if(db.cfg.env!=='test')throw new Error('Native order fixture requires APP_ENV=test');
  const directory=inside(db.cfg.runtimeRoot,root);await mkdir(directory,{recursive:true});
  const image=syntheticArkContract('IMAGE'),video=syntheticArkContract('VIDEO'),speech=syntheticSpeechContract(2);
  const listening=options.listening?syntheticListeningContract():undefined;
  speech.channel_policy='MEAN_STEREO_V1';
  video.video={...video.video!,native_audio:true,durations:[1,2],ratios:['9:16'],dimensions:[{resolution:'480p',ratio:'9:16',width:360,height:640}]};
  const cfg=config({...db.cfg,generationEnabled:true,provider:{...db.cfg.provider,apiKey:'SYNTHETIC-NOT-REAL',baseUrl:image.base_url,
    imageModel:image.request_model,videoModel:video.request_model,allowedHosts:['generation.example.test','media.example.test'],
    ...(listening?{listening:{enabled:true,baseUrl:listening.base_url,apiKey:'SYNTHETIC-NOT-REAL',allowedHosts:['listening.example.test']}}:{}),
    speech:{enabled:true,baseUrl:speech.base_url,apiKey:'SYNTHETIC-NOT-REAL',allowedHosts:['speech.example.test','input.example.test','result.example.test']}}});
  let musicBinding:ResourceBinding|undefined,character:CharacterVoiceAdmission|undefined;
  const fixture=await mediaFixture({...db,cfg},{speech,revisions:options.revisions??false,generation:{engine:options.engine,contracts:[image,video],twoShots:true,
    variantId:options.engine==='PER_SHOT_AI'?'quiet-luxury.ai-detail':'portrait-social.ai-presenter-multi'},
    configureContract:async c=>{
      const license=async(kind:AudioRightKind,cost:number,bytes?:Buffer):Promise<ResourceBinding>=>{
        const binding={resource_version_id:id('synthetic_resource'),license_record_id:id('synthetic_license'),hash:bytes?sha256(bytes):sha256(id('synthetic_proof'))};
        const text='SYNTHETIC ORDER TEST LICENSE — NO REAL PERSON, VOICE OR MUSIC AUTHORIZATION';
        const media=bytes?{object_key:`licensed-resources/${binding.resource_version_id}/music.wav`,sha256:sha256(bytes),size_bytes:bytes.length,mime_type:'audio/wav'}:undefined;
        await insert(db.pool,'resource_licenses',{id:binding.license_record_id,resource_id:binding.resource_version_id,version:'SYNTHETIC-1',expires_at:addSeconds(3600),data:{
          resource_version_id:binding.resource_version_id,resource_hash:binding.hash,admission_state:'ADMITTED',license_text:text,license_sha256:sha256(text),
          audio_rights:{kind,allowed_use:'GENERATED_COMMERCIAL_AD',allocation_mode:'PREPAID_ORDER_ALLOCATION',allocation_micro:cost},...(media?{audio_media:media}:{})}});
        // The platform resource namespace is separate from buyer-private media.
        if(media)await storage(cfg).put(media.object_key,bytes!,media.mime_type);return binding;
      };
      c.source.audio_policy={speech:'native_speech',language:'zh-CN',music:'approved_licensed_or_contract_silent',preserve_native_speech:true,
        caption_alignment:'actual_audio',second_tts_over_native_speech_allowed:false,action_sound_required:false};
      c.source.creative_components={...c.source.creative_components,caption_preset:options.style??'karaoke',music_asset_version:null,font_asset_version:null,
        bgm_volume:.15,bgm_duck:true,music_loop_to_timeline:true};
      character={version:'YPCC-CHARACTER-VOICE-1',character_version_id:id('synthetic_character'),native_voice_id:id('synthetic_voice'),video_model_version_id:video.model_version_id,
        evidence_sha256:'e'.repeat(64),valid_until:addSeconds(3600),language:'zh-CN',secondary_tts:false,
        character_binding:await license('NATIVE_CHARACTER',20),voice_binding:await license('NATIVE_VOICE',30)};
      c.creative.character_version_id=character.character_version_id;c.creative.native_voice_id=character.native_voice_id;
      c.creative.shots[0]!.spoken_text='商品实拍。';c.creative.shots[1]!.spoken_text='细节展示。';c.plan_hash=hash(c.creative);
      if(options.music){musicBinding=await license('MUSIC',40,options.music);c.resource_versions.push(musicBinding);c.source.creative_components.music_asset_version=musicBinding.resource_version_id;}
      await insert(db.pool,'character_versions',{id:character.character_version_id,character_id:id('synthetic_character_id'),version:'SYNTHETIC-1',data:{
        admission_state:'ADMITTED',native_voice_ids:[character.native_voice_id],native_audio_admissions:[character]}});
      c.codex_contract.qc_policy_version=NATIVE_AUDIO_QC_POLICY;
      // Synthetic full audio material has a larger original, pre-sale context
      // ceiling. This never refills a sold order or certifies a real model.
      if(listening){c.codex_contract.max_input_tokens=600000;c.runtime_binding!.limits.max_input_tokens=600000;}
      if(listening){const binding={provider:listening.provider,actual_model:listening.actual_model,registry_version:listening.registry_version,
        roles:['QC' as const],capability_hash:hash(listening),rate_snapshot_id:listening.rate_snapshot_id};
        c.model_versions.push(binding);
        await insert(db.pool,'provider_model_versions',{id:listening.model_version_id,provider:listening.provider,actual_model:listening.actual_model,
          status:'ADMITTED',version:listening.registry_version,data:binding,private:{listening_contract:listening}});}
      const models=(await db.pool.query<SpeechModelRow>('SELECT id,status,data,private FROM provider_model_versions WHERE id=ANY($1)',[[speech.model_version_id,...(listening?[listening.model_version_id]:[])]] )).rows;
      await transaction(db.pool,q=>freezeNativeAudio(q,cfg,c,models));
    }});
  fixture.cfg.provider.allowedHosts.push('generation.example.test','media.example.test');
  const store:ObjectStorage={put:fixture.store.put.bind(fixture.store),get:fixture.store.get.bind(fixture.store),delete:fixture.store.delete.bind(fixture.store),exists:fixture.store.exists.bind(fixture.store),
    signedReadUrl:(key,expiry)=>`https://input.example.test/${key}?Expires=${Math.floor(expiry.getTime()/1000)}&Signature=SYNTHETIC`};
  return {...fixture,store,models:{image,video,speech,...(listening?{listening}:{})},character:character!,musicBinding};
}

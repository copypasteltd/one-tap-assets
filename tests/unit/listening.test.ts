import {it,expect} from 'vitest';
import {hash,sha256,addSeconds} from '../../src/api/lib/crypto.js';
import {config} from '../../src/api/config.js';
import {nativeReviewWav} from '../../src/worker/review/native-audio.js';
import {admitListeningContract,frozenListeningContract,prepareListening,parseListeningSse,listeningUsage,validateListeningResult,
  type ListeningInput} from '../../src/worker/providers/omni-listening.js';
import {syntheticListeningContract,syntheticListeningResult,listeningSse} from '../helpers/listening.js';

function fixture(){
  const c=syntheticListeningContract(),bytes=nativeReviewWav(Buffer.alloc(48000*4)),image=Buffer.from('synthetic-image-protocol-only');
  const input:ListeningInput={packet_hash:'a'.repeat(64),snapshot_hash:'b'.repeat(64),output_set_hash:'c'.repeat(64),target_frames:30,
    audios:[{asset_id:'native',kind:'NATIVE_AUDIO',sha256:sha256(bytes),bytes},{asset_id:'final',kind:'FINAL_AUDIO',sha256:sha256(bytes),bytes}],
    images:[0,1,2].map(i=>({asset_id:`image-${i}`,sha256:sha256(image),bytes:image,width:100,height:100})),facts:{visible_color:'green'}};
  const prepared=prepareListening(c,input);return {c,input,prepared,result:syntheticListeningResult(prepared.summary)};
}
it('freezes the full thinking/input bound and settles historical rates independently of new admission',()=>{
  const {c}=fixture();expect(()=>frozenListeningContract({...c,per_request_ceiling_micro:1})).toThrowError(expect.objectContaining({code:'LISTENING_COST_BOUND_INVALID'}));
  const expired={...c,valid_until:addSeconds(-1)};expect(hash(frozenListeningContract(expired))).toBe(hash(expired));
  const cfg=config({generationEnabled:true,provider:{...config().provider,listening:{enabled:true,baseUrl:c.base_url,apiKey:'SYNTHETIC',allowedHosts:['listening.example.test']}}});
  expect(()=>admitListeningContract(cfg,expired)).toThrowError(expect.objectContaining({code:'LISTENING_NOT_ADMITTED'}));
  expect(()=>frozenListeningContract({...c,use_multichannel:false})).toThrow();
});
it('sends both complete stereo WAVs and every exact image without ASR or a planned script',()=>{
  const {input,prepared}=fixture(),request=JSON.parse(prepared.body),content=request.messages[0].content;
  expect(request).toMatchObject({stream:true,stream_options:{include_usage:true},use_multichannel:true,modalities:['text']});
  expect(content.filter((i:{type:string})=>i.type==='input_audio').map((i:{input_audio:{data:string}})=>Buffer.from(i.input_audio.data.split(',')[1]!,'base64')))
    .toEqual(input.audios.map(a=>a.bytes));
  expect(content.filter((i:{type:string})=>i.type==='image_url')).toHaveLength(input.images.length);
  expect(prepared.body).not.toContain('transcript_text');expect(prepared.requestHash).toBe(sha256(prepared.body));
});
it('rejects shortened, mono or differently sampled audio before preparing any paid request',()=>{
  const {c,input}=fixture();
  for(const change of [(b:Buffer)=>b.subarray(0,b.length-4),(b:Buffer)=>{b.writeUInt16LE(1,22);return b;},(b:Buffer)=>{b.writeUInt32LE(44100,24);return b;}]){
    const bad=structuredClone(input),bytes=change(Buffer.from(input.audios[0]!.bytes));bad.audios[0]={...input.audios[0]!,bytes,sha256:sha256(bytes)};
    expect(()=>prepareListening(c,bad)).toThrowError(expect.objectContaining({code:'LISTENING_AUDIO_INVALID'}));
  }
  expect(()=>prepareListening(c,{...input,audios:[input.audios[0]!]})).toThrow();
});
it('requires a complete same-request SSE with final usage, rejecting truncation and model switches',()=>{
  const {c,result}=fixture(),bytes=listeningSse(c,result);expect(parseListeningSse(bytes,c).finish_reason).toBe('stop');
  expect(()=>parseListeningSse(bytes.subarray(0,bytes.length-2),c)).toThrow();
  expect(()=>parseListeningSse(Buffer.from(bytes.toString().replace('"choices":[],"usage":','"choices":[],"usage":null,"discarded":')),c)).toThrow();
  expect(()=>parseListeningSse(Buffer.from(bytes.toString().replace(c.actual_model,'other-model')),c)).toThrowError(expect.objectContaining({code:'LISTENING_MODEL_MISMATCH'}));
});
it('accounts for all reasoning tokens and refuses unallocatable cached or excessive usage',()=>{
  const {c,result}=fixture();expect(listeningUsage(parseListeningSse(listeningSse(c,result),c),c)).toBe(2);
  for(const change of [(u:Record<string,unknown>)=>{(u.prompt_tokens_details as Record<string,unknown>).cached_tokens=1;},
    (u:Record<string,unknown>)=>{(u.prompt_tokens_details as Record<string,unknown>).text_tokens=700;},
    (u:Record<string,unknown>)=>{(u.completion_tokens_details as Record<string,unknown>).reasoning_tokens=0;},
    (u:Record<string,unknown>)=>{u.prompt_tokens=10001;u.total_tokens=10201;}]){
    expect(()=>listeningUsage(parseListeningSse(listeningSse(c,result,change),c),c)).toThrow();
  }
});
it('accepts explicit uncertainty but rejects gaps, foreign evidence and an unsupported PASS',()=>{
  const {prepared,result}=fixture();expect(validateListeningResult(result,prepared.summary).verdict).toBe('INSUFFICIENT');
  const bad=structuredClone(result);bad.tracks[0]!.segments[0]!.start_ms=1;expect(()=>validateListeningResult(bad,prepared.summary)).toThrow();
  expect(()=>validateListeningResult({...result,packet_hash:'f'.repeat(64)},prepared.summary)).toThrow();
  expect(()=>validateListeningResult({...result,verdict:'PASS'},prepared.summary)).toThrowError(expect.objectContaining({code:'LISTENING_FALSE_PASS'}));
  expect(()=>validateListeningResult({...result,findings:[{category:'OTHER',severity:'HIGH',audio_asset_id:'native',start_ms:0,end_ms:100,
    evidence_ids:['foreign-asset'],detail:'Synthetic invalid evidence'}]},prepared.summary)).toThrow();
});
it('refuses a semantic PASS without independently observed Chinese speech in both complete tracks',()=>{
  const {prepared,result}=fixture();result.verdict='PASS';
  for(const k of Object.keys(result.checks) as (keyof typeof result.checks)[])result.checks[k]='PASS';
  for(const t of result.tracks)t.segments=[{start_ms:0,end_ms:prepared.summary.duration_ms,kind:'MUSIC',heard_text:''}];
  expect(()=>validateListeningResult(result,prepared.summary)).toThrowError(expect.objectContaining({code:'LISTENING_FALSE_PASS'}));
  for(const t of result.tracks)t.segments[0]={...t.segments[0]!,kind:'SPEECH',heard_text:'Synthetic English text'};
  expect(()=>validateListeningResult(result,prepared.summary)).toThrowError(expect.objectContaining({code:'LISTENING_FALSE_PASS'}));
  // A fabricated positive response exercises the parser only, not hearing.
  for(const t of result.tracks)t.segments[0]!.heard_text='合成中文语义响应，仅测试格式。';
  expect(validateListeningResult(result,prepared.summary).verdict).toBe('PASS');
});

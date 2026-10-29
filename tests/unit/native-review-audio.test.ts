import {it,expect} from 'vitest';
import {nativeReviewWav,nativeCaptionFrames} from '../../src/worker/review/native-audio.js';
import type {NativeTranscript} from '../../src/worker/media/native-captions.js';

function transcript():NativeTranscript{return {
  version:'YPCC-ACTUAL-AUDIO-TRANSCRIPT-1',source_sha256:'a'.repeat(64),pcm_sha256:'b'.repeat(64),audio_evidence_hash:'c'.repeat(64),language:'zh-CN',
  recognizer:{provider:'SYNTHETIC',actual_model:'test',registry_version:'test',rate_snapshot_id:'test',original_receipt_sha256:'d'.repeat(64)},
  segments:[{start_ms:100,end_ms:400,text:'商品',words:[{start_ms:100,end_ms:200,text:'商'},{start_ms:200,end_ms:400,text:'品'}]}]
};}
it('preserves every original stereo sample in the complete canonical review WAV',()=>{
  const pcm=Buffer.alloc(16);[1000,-2000,32767,-32768,7,19,0,-1].forEach((n,i)=>pcm.writeInt16LE(n,i*2));
  const wav=nativeReviewWav(pcm);
  expect(wav.length).toBe(pcm.length+44);expect(wav.subarray(44).equals(pcm)).toBe(true);
  expect(wav.toString('ascii',0,4)).toBe('RIFF');expect(wav.toString('ascii',8,16)).toBe('WAVEfmt ');
  expect(wav.readUInt32LE(4)).toBe(wav.length-8);expect(wav.readUInt16LE(22)).toBe(2);
  expect(wav.readUInt32LE(24)).toBe(48000);expect(wav.readUInt16LE(34)).toBe(16);
  expect(wav.toString('ascii',36,40)).toBe('data');expect(wav.readUInt32LE(40)).toBe(pcm.length);
});
it('rejects empty, partial stereo samples and overlong review audio',()=>{
  for(const pcm of [Buffer.alloc(0),Buffer.alloc(2),Buffer.alloc(48000*120*4+4)])
    expect(()=>nativeReviewWav(pcm)).toThrowError(expect.objectContaining({code:'REVIEW_AUDIO_PCM_INVALID'}));
});
it('exposes distinct actual frames at phrase and word boundaries and midpoints',()=>{
  expect(nativeCaptionFrames(transcript(),15)).toEqual([3,4,5,6,7,9,11]);
  const end=transcript();end.segments=[{start_ms:400,end_ms:500,text:'尾'}];
  expect(nativeCaptionFrames(end,15)).toEqual([12,13,14]);
});
it('rejects caption intervals outside the complete original timeline',()=>{
  for(const [start,end] of [[-1,100],[100,100],[100,501],[NaN,100]] as const){
    const invalid=transcript();invalid.segments[0]!.start_ms=start;invalid.segments[0]!.end_ms=end;
    expect(()=>nativeCaptionFrames(invalid,15)).toThrowError(expect.objectContaining({code:'REVIEW_AUDIO_TIMELINE_INVALID'}));
  }
  for(const frames of [0,3601,1.5])expect(()=>nativeCaptionFrames(transcript(),frames)).toThrow();
});

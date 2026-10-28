import {it,expect} from 'vitest';
import {sha256} from '../../src/api/lib/crypto.js';
import {speechMonoDerivative} from '../../src/worker/speech/input.js';

function stereo(samples:number[]):Buffer{
  const pcm=Buffer.alloc(samples.length*2);samples.forEach((sample,index)=>pcm.writeInt16LE(sample,index*2));return pcm;
}
it('preserves legacy identical stereo bytes without introducing a new proof',()=>{
  const made=speechMonoDerivative(stereo([500,500,-1000,-1000]));
  expect(made.mono).toEqual(stereo([500,-1000]));expect(made.proof).toBeUndefined();
});
it('retains legacy rejection for distinct stereo when no new policy was frozen',()=>{
  expect(()=>speechMonoDerivative(stereo([1000,900]))).toThrowError(expect.objectContaining({code:'ASR_STEREO_REVIEW_REQUIRED'}));
});
it('uses both channels at equal weight and freezes rounding and PCM provenance',()=>{
  const pcm=stereo([1000,500,-999,-500]),made=speechMonoDerivative(pcm,'MEAN_STEREO_V1');
  expect(made.mono).toEqual(stereo([750,-749]));expect(made.proof).toMatchObject({policy:'MEAN_STEREO_V1',source_pcm_sha256:sha256(pcm),
    mono_pcm_sha256:sha256(made.mono),samples:2,coefficients:[0.5,0.5],min_energy_ratio:0.1});
  expect(pcm).toEqual(stereo([1000,500,-999,-500]));
});
it('refuses silent and phase-cancelled derivatives instead of losing the speech track',()=>{
  for(const pcm of [stereo([1000,-1000,-800,800]),stereo([0,0])])
    expect(()=>speechMonoDerivative(pcm,'MEAN_STEREO_V1')).toThrowError(expect.objectContaining({code:'ASR_STEREO_CANCELLATION'}));
});

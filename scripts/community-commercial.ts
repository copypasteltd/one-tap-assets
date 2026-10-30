import {config} from '../src/api/config.js';
import {createPool,transaction} from '../src/api/db/pool.js';
import {prepareCommunityCommercial} from '../src/api/modules/community-commercial.js';

const [variantId,version,revision,actor,reason,characterId,voiceId,...extra]=process.argv.slice(2);
if(!variantId||!version||!/^\d+$/.test(revision??'')||!actor||!reason||extra.length||Boolean(characterId)!==Boolean(voiceId)) {
  throw new Error('Usage: pnpm community:prepare <variant-id> <version> <expected-revision> <operator> <reason> [<character-version-id> <native-voice-id>]');
}
const cfg=config(),pool=createPool(cfg);
try {
  const result=await transaction(pool,db=>prepareCommunityCommercial(db,cfg,{variantId,version,expectedRevision:Number(revision),actor,reason,
    ...(characterId&&voiceId?{nativeVoice:{character_version_id:characterId,native_voice_id:voiceId}}:{})}));
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
} finally {await pool.end();}

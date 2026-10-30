import {config} from '../src/api/config.js';
import {createPool,transaction} from '../src/api/db/pool.js';
import {prepareCommunityCommercial} from '../src/api/modules/community-commercial.js';

const [variantId,version,revision,actor,reason,...extra]=process.argv.slice(2);
if(!variantId||!version||!/^\d+$/.test(revision??'')||!actor||!reason||extra.length) {
  throw new Error('Usage: pnpm community:prepare <variant-id> <version> <expected-revision> <operator> <reason>');
}
const cfg=config(),pool=createPool(cfg);
try {
  const result=await transaction(pool,db=>prepareCommunityCommercial(db,cfg,{variantId,version,expectedRevision:Number(revision),actor,reason}));
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
} finally {await pool.end();}

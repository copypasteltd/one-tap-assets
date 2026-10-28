import type {FastifyRequest} from 'fastify';
import type pg from 'pg';
import type {Config} from '../../api/config.js';
import {sha256} from '../../api/lib/crypto.js';
import {AppError} from '../../api/lib/errors.js';
import {authorizeTool} from './http.js';

const internalRoutes=new Set([
  '/v1/internal/p01/agent-tools',
  '/v1/internal/p01/agent-tools/calls',
  '/v1/internal/p01/agent-tools/calls/:intent_id',
  '/v1/internal/p01/agent-inference/responses',
]);
/** One API-process traffic bucket per live run across all internal routes.
 * This does not replace durable tool/inference quotas or cost reservations.
 * Untrusted tokens cannot mint buckets; rotated live tokens share their run.
 */
export function requestRateLimit(pool:pg.Pool,cfg:Config){
  return {
    timeWindow:'1 minute',
    max:(_request:FastifyRequest,key:string)=>key.startsWith('agent-run:')?600:180,
    keyGenerator:async(request:FastifyRequest):Promise<string>=>{
      const ipKey=sha256(`${request.ip}:${cfg.signingKey}`);
      if(!internalRoutes.has(request.routeOptions.url??''))return ipKey;
      try{
        const scope=await authorizeTool(pool,request.headers.authorization);
        return `agent-run:${sha256(`${scope.tenant_id}:${scope.run_id}:${cfg.signingKey}`)}`;
      }catch(error){
        if(error instanceof AppError&&error.status<500)return ipKey;
        throw error;
      }
    },
  };
}

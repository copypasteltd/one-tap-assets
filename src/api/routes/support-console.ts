import type {FastifyInstance} from 'fastify';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {requireThat} from '../lib/errors.js';
/** Public login shell; every data request still requires an independent management credential. */
export function registerSupportConsole(app:FastifyInstance){
  const runtime=resolve('runtime'),root=resolve(process.env.YPCC_BUILD_ROOT||'runtime/build','preview');
  const rel=relative(runtime,root);requireThat(rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel),'SUPPORT_BUILD_ROOT_INVALID','客服页面构建目录无效',500);
  const read=async(name:string)=>{const path=resolve(root,name);const physical=await realpath(path);const physicalRoot=await realpath(root);
    const within=relative(physicalRoot,physical);requireThat(!within.startsWith('..')&&!isAbsolute(within)&&(await lstat(path)).isFile(),'NOT_FOUND','页面资源不存在',404);return readFile(path);};
  app.get('/ops/support',async(_request,reply)=>{reply.header('Cache-Control','no-store').header('Referrer-Policy','no-referrer');
    try{return reply.type('text/html; charset=utf-8').send(await read('support.html'));}catch{return reply.code(503).send({code:'SUPPORT_UI_NOT_BUILT',message:'请先构建并配置当前客服页面'});}});
  app.get<{Params:{file:string}}>('/ops/assets/:file',async(request,reply)=>{
    const match=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,180}\.(js|css|ttf|woff2|woff)$/.exec(request.params.file);requireThat(match,'NOT_FOUND','页面资源不存在',404);
    const mime:Record<string,string>={js:'application/javascript; charset=utf-8',css:'text/css; charset=utf-8',ttf:'font/ttf',woff2:'font/woff2',woff:'font/woff'};
    reply.header('Cache-Control','no-store').header('Referrer-Policy','no-referrer');try{return reply.type(mime[match[1]!]!).send(await read(`assets/${request.params.file}`));}catch{return reply.code(404).send();}
  });
}

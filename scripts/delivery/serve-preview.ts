import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,relative,extname,isAbsolute} from 'node:path';
import {checked,local} from './common.js';
const directory=local(process.env.YPCC_PREVIEW_DIRECTORY||'runtime/build/preview');
await checked(resolve(directory,'index.html'));
const port=Number(process.env.YPCC_PREVIEW_PORT||4173);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error('Invalid preview port');
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.gif':'image/gif','.jpg':'image/jpeg','.mp4':'video/mp4','.woff2':'font/woff2','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'");
  if(!['GET','HEAD'].includes(req.method||'')){res.writeHead(405).end();return;}
  try{
    const name=decodeURIComponent((req.url||'/').split('?')[0]!);
    if(name.includes('\\')||name.includes('\0')||name.split('/').some(p=>p.startsWith('.'))){res.writeHead(404).end();return;}
    const path=resolve(directory,'.'+(name==='/'?'/index.html':name)),rel=relative(directory,path);
    if(rel.startsWith('..')||isAbsolute(rel)||!types[extname(path)]){res.writeHead(404).end();return;}
    await checked(path);if(!(await stat(path)).isFile()){res.writeHead(404).end();return;}
    const bytes=await readFile(path);res.setHeader('Content-Type',types[extname(path)]!);res.setHeader('Accept-Ranges','bytes');
    let start=0,end=bytes.length-1;
    if(req.headers.range){
      const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);start=m?Number(m[1]):NaN;end=m?.[2]?Number(m[2]):end;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start> end||end>=bytes.length){res.writeHead(416,{'Content-Range':`bytes */${bytes.length}`}).end();return;}
      res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${bytes.length}`);
    }
    res.setHeader('Content-Length',end-start+1);res.end(req.method==='HEAD'?undefined:bytes.subarray(start,end+1));
  }catch{res.writeHead(404).end();}
});
await new Promise<void>((done,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',done);});
console.log(JSON.stringify({event:'preview_ready',url:`http://127.0.0.1:${port}`,mode:'SHARED_MINI_PAGE_FIXTURES'}));
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>server.close(()=>process.exit(0)));

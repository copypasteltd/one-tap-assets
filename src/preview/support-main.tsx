import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {DTO} from '../shared/contracts/types';
import {SupportDeskClient} from '../shared/client/support-desk';
import {supportCategories,ticketStates} from '../shared/client/support';
import {SupportRepairPanel} from './support-repair';
import './support-console.css';

function SupportConsole(){
  const desk=useRef(new SupportDeskClient()),epoch=useRef(0);const [token,setToken]=useState(''),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [state,setState]=useState<DTO<'Ticket'>['state']>('OPEN'),[items,setItems]=useState<DTO<'ManagedSupportTicket'>[]>([]),[next,setNext]=useState<string|null>(null);
  const [detail,setDetail]=useState<DTO<'ManagedSupportDetail'>>(),[message,setMessage]=useState(''),[image,setImage]=useState(''),[pending,setPending]=useState(false);
  const [repairRefresh,setRepairRefresh]=useState(0);
  useEffect(()=>()=>{epoch.current++;desk.current.disconnect();},[]);
  async function run(work:()=>Promise<void>){const current=epoch.current;setBusy(true);setError('');try{await work();}catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'操作未完成，请查询原工单');}
    finally{if(current===epoch.current){setBusy(false);setPending(desk.current.pending);}}}
  async function load(filter=state,more=false){const list=await desk.current.list(filter,more?next??undefined:undefined);setItems(old=>more?[...old,...list.items]:list.items);setNext(list.next_cursor);}
  function logout(){epoch.current++;desk.current.disconnect();setToken('');setConnected(false);setItems([]);setNext(null);setDetail(undefined);setImage('');setMessage('');setPending(false);setBusy(false);setError('');}
  async function act(action:DTO<'SupportProcessRequest'>['action']){if(!detail)return;const id=detail.summary.ticket_id;
    await desk.current.process(id,{expected_revision:detail.summary.revision,action,...(['REPLY','RESOLVE'].includes(action)?{message:message.trim()}:{})});
    setMessage('');setDetail(await desk.current.detail(id));await load();}
  return <main className="desk"><header><a className="desk-brand" href="/ops/support">柚子创作社 <span>一品成片</span></a><div><span className="desk-kicker">客户支持</span><h1>让每一个问题，<br/>都有回应。</h1><p>接手、核实、回复，处理进展回到用户的原反馈记录。</p></div><nav className="support-ops-links"><a href="/ops/metrics">运营看板 ↗</a><a href="/ops/review">社区审核 ↗</a><span className="desk-dot">客服工作台</span></nav></header>
    {!connected?<section className="desk-login"><h2>连接客服账户</h2><p>使用独立分配的客服访问令牌。访问令牌仅在当前页面内存中使用。</p><label>客服访问令牌<input autoComplete="off" type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="输入独立客服令牌"/></label><button disabled={busy||!token.trim()} onClick={()=>void run(async()=>{desk.current.connect(token);setToken('');await load();setConnected(true);})}>连接工作台</button></section>:<>
      <div className="desk-toolbar"><label>工单状态<select aria-label="工单状态" value={state} disabled={busy||pending} onChange={e=>{const value=e.target.value as typeof state;setState(value);setDetail(undefined);setImage('');void run(()=>load(value));}}>{Object.entries(ticketStates).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <button className="quiet" disabled={busy} onClick={()=>void run(async()=>{await load();if(detail){setDetail(await desk.current.detail(detail.summary.ticket_id));setImage('');setRepairRefresh(n=>n+1);}})}>刷新工单</button><button className="quiet" onClick={logout}>退出并清空</button></div>
      {pending&&<div className="desk-notice" role="status">原操作回执未确认，已保留原版本、内容和请求编号。请继续确认后再处理其他工单。<button disabled={busy} onClick={()=>void run(async()=>{const id=desk.current.pendingTicketId!;if(desk.current.pendingKind==='REPAIR')await desk.current.retryRepair();else await desk.current.retry();setMessage('');setDetail(await desk.current.detail(id));await load();setRepairRefresh(n=>n+1);})}>继续确认原操作</button></div>}
      <div className="desk-grid"><section className="desk-list"><h2>处理队列 <span>{items.length}</span></h2>{!items.length&&<p className="desk-empty">当前状态没有待处理工单。</p>}
        {items.map(t=><button className={`desk-ticket ${detail?.summary.ticket_id===t.ticket_id?'selected':''}`} key={t.ticket_id} disabled={busy||pending} onClick={()=>void run(async()=>{setDetail(undefined);setMessage('');setImage('');setDetail(await desk.current.detail(t.ticket_id));})}><strong>{supportCategories[t.category as keyof typeof supportCategories]??'订单问题'}</strong><span>{ticketStates[t.state]}</span><small>{t.ticket_id}</small><small>订单 {t.order_id}</small></button>)}
        {next&&<button className="quiet" disabled={busy||pending} onClick={()=>void run(()=>load(state,true))}>加载更多工单</button>}</section>
        <section className="desk-detail">{!detail?<div className="desk-empty"><span className="desk-sun">✳</span><h2>从一个具体的问题开始</h2><p>选择工单，核对订单和用户说明，再接手处理。</p></div>:<>
          <div className="desk-status">{ticketStates[detail.summary.state]} · 版本 {detail.summary.revision}</div><h2>{supportCategories[detail.summary.category as keyof typeof supportCategories]??'订单问题'}</h2><p className="desk-meta">工单：{detail.summary.ticket_id}<br/>订单：{detail.summary.order_id}<br/>接手人：{detail.summary.assigned_actor??'待接手'}</p>
          {!detail.summary.content_available?<div className="desk-notice">该订单的私有内容已撤销。说明、回复和证明图片不可继续查看或追加。</div>:<>
            <h3>用户说明</h3><p className="desk-message">{detail.message??'暂无说明'}</p><div className="desk-evidence">{detail.attachment_asset_ids.map((id,index)=><button className="quiet" disabled={busy} key={id} onClick={()=>void run(async()=>{setImage('');const proof=await desk.current.evidence(detail.summary.ticket_id,id);if(proof.asset_id!==id||proof.mime_type!=='image/png')throw new Error('证明回执不匹配');setImage(`data:image/png;base64,${proof.bytes_base64}`);})}>查看证明图片 {index+1}</button>)}</div>
            {image&&<figure><img src={image} alt="当前工单的授权证明图片"/><button className="quiet" onClick={()=>setImage('')}>收起证明图片</button></figure>}
            {detail.response&&<div className="desk-response"><h3>最近一次客服回复</h3><p className="desk-message">{detail.response.message}</p><small>{new Date(detail.response.updated_at).toLocaleString()}</small></div>}
            {detail.summary.state==='OPEN'&&<button disabled={busy||pending} onClick={()=>void run(()=>act('CLAIM'))}>接手这条工单</button>}
            {detail.summary.state==='PROCESSING'&&<><label>给用户的回复<textarea maxLength={2000} disabled={busy||pending} value={message} onChange={e=>setMessage(e.target.value)} placeholder="说明核实结果、处理建议或当前进展"/></label><div className="desk-actions"><button disabled={busy||pending||!message.trim()} onClick={()=>void run(()=>act('REPLY'))}>发送回复</button><button className="quiet" disabled={busy||pending||!message.trim()} onClick={()=>void run(()=>act('RESOLVE'))}>回复并标记已解决</button></div></>}
            {detail.summary.state==='RESOLVED'&&<button disabled={busy||pending} onClick={()=>void run(()=>act('CLOSE'))}>关闭已解决工单</button>}
            {detail.repair_access&&<SupportRepairPanel key={detail.summary.ticket_id} desk={desk.current} detail={detail} busy={busy} pending={pending} refresh={repairRefresh} run={run} onChanged={async()=>{setDetail(await desk.current.detail(detail.summary.ticket_id));await load();}}/>}
          </>}
          <p className="desk-footnote">工单状态只记录客服沟通进展。退款、素材纠错和重新交付须以原订单实际结果为准。</p></>}
        </section></div></>}
    {error&&<div className="desk-error" role="alert">{error}</div>}<footer>一品成片 · 柚子创作社 <span>每一份作品，都值得被认真对待。</span></footer></main>;
}
createRoot(document.getElementById('root')!).render(<SupportConsole/>);

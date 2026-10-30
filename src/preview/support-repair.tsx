import React,{useEffect,useRef,useState} from 'react';
import type {DTO} from '../shared/contracts/types';
import type {SupportDeskClient} from '../shared/client/support-desk';
import './support-repair.css';

type Kind=DTO<'RevisionRequest'>['kind'];
const kinds:Record<Kind,string>={COVER:'更换封面',ALLOWED_ORDER:'调整展示顺序',DISPLAY_TEXT:'更正文案文件',IMAGE_TEXT:'图片加字'};
const states:Record<DTO<'Revision'>['state'],string>={REQUESTED:'已受理，等待制作',PROCESSING:'制作与核验中',COMPLETED:'更正素材已交付',FAILED:'本次更正未完成'};
const reasons:Record<string,string>={PLATFORM_REPAIR_ALREADY_LINKED:'本工单已有关联纠错，请查看原请求进展。',PLATFORM_REPAIR_TICKET_INVALID:'只有正在处理的商品、生成或其他问题工单可以提交纠错。',
  REVISION_POLICY_UNAVAILABLE:'该素材方案暂不支持此类纠错。',REVISION_WINDOW_EXPIRED:'原订单的售后时间已结束。',CODEX_NOT_CONFIGURED:'制作服务暂不可用，请稍后核对。',
  REVISION_IN_PROGRESS:'原订单有其他更正在进行，请先等待原任务。',REVISION_COST_UNRESOLVED:'原任务费用尚未确认，请先核对原任务。',CODEX_ROLE_INFERENCE_LIMIT:'原订单的售后核验次数已用完。',
  REVISION_BUDGET_OR_DEADLINE_EXCEEDED:'原订单的售后额度已用完。'};
export function SupportRepairPanel({desk,detail,busy,pending,refresh,run,onChanged}:{desk:SupportDeskClient;detail:DTO<'ManagedSupportDetail'>;busy:boolean;pending:boolean;refresh:number;run:(work:()=>Promise<void>)=>Promise<void>;onChanged:()=>Promise<void>}){
  const live=useRef(true),requested=useRef(false);const [context,setContext]=useState<DTO<'SupportRepairContext'>>(),[kind,setKind]=useState<Kind>('COVER'),[cover,setCover]=useState('');
  const [order,setOrder]=useState<string[]>([]),[text,setText]=useState(''),[image,setImage]=useState(''),[confirmed,setConfirmed]=useState(false);
  const [imageTarget,setImageTarget]=useState(''),[title,setTitle]=useState('');
  const ticketId=detail.summary.ticket_id;
  useEffect(()=>()=>{live.current=false;},[]);
  async function read(){
    requested.current=true;setContext(undefined);setImage('');setConfirmed(false);setText('');setTitle('');setImageTarget('');setOrder([]);setCover('');
    const value=await desk.repairContext(ticketId);if(!live.current)return;setContext(value);setCover(value.manifest?.cover_deliverable_id??'');setImageTarget(value.manifest?.items.find(i=>i.kind==='image')?.deliverable_id??'');
    if(!value.allowed_changes.includes(kind))setKind(value.allowed_changes[0]??'COVER');
    setOrder(value.manifest?.items.map(i=>i.deliverable_id)??[]);setText(value.manifest?.items.find(i=>i.kind==='copy')?.text??'');
  }
  // Refresh the existing linked request; never reconstruct or resubmit a write.
  useEffect(()=>{if(requested.current)void run(read);},[refresh]);
  const pack=context?.manifest,profile=context?.product_profile,locked=busy||pending;
  const items=pack?.items??[],changed=kind==='IMAGE_TEXT'?Boolean(imageTarget&&title.trim()&&Array.from(title.trim()).length<=28):kind==='COVER'?cover!==pack?.cover_deliverable_id:kind==='DISPLAY_TEXT'?!!text.trim()&&text.trim()!==items.find(i=>i.kind==='copy')?.text:order.join('|')!==items.map(i=>i.deliverable_id).join('|');
  const facts=profile?[...profile.observations,...profile.label_texts].filter(i=>['OBSERVED','OCR','USER_CORRECTED'].includes(i.status)):[];
  function move(index:number,delta:number){const next=[...order];[next[index],next[index+delta]]=[next[index+delta]!,next[index]!];setOrder(next);setConfirmed(false);}
  async function submit(){
    if(!context?.can_submit||!pack||!confirmed||!changed)return;
    const change:DTO<'RevisionRequest'>={kind,manifest_revision:pack.manifest_revision,...(kind==='COVER'?{cover_deliverable_id:cover}:kind==='DISPLAY_TEXT'?{display_text:text.trim()}:kind==='IMAGE_TEXT'?{image_text:{deliverable_id:imageTarget,text:title.trim()}}:{ordered_deliverable_ids:order})};
    await desk.repair(context.ticket.order_id,ticketId,{ticket_id:ticketId,expected_ticket_revision:context.ticket.revision,change});
    if(!live.current)return;setConfirmed(false);await read();await onChanged();
  }
  return <section className="repair-panel" aria-label="素材纠错工作区"><div className="repair-heading"><div><span className="repair-eyebrow">认真改好，再交到手上</span><h3>核对原素材，发起免费更正</h3></div><span className="repair-badge">平台纠错</span></div>
    <p className="repair-intro">沿用原商品资料和制作方案，更正封面、展示顺序、配套文案或已支持的图片标题。每条工单关联一次更正，不占用用户修改次数。</p>
    <button className="quiet" disabled={locked} onClick={()=>void run(read)}>{context?'刷新更正进展':'核对原商品与素材'}</button>
    {context&&<>
      {context.repair&&<div className={`repair-result ${context.repair.state==='COMPLETED'?'complete':''}`} role="status"><strong>{states[context.repair.state]}</strong>
        <p>{context.repair.state==='COMPLETED'?`原订单已更新到素材版本 ${context.repair.result_manifest_revision}，用户可回到领取页查看。`:context.repair.state==='FAILED'?'原素材包继续有效，请根据原请求记录核对失败原因。':'已关联原工单。点击“刷新更正进展”查看制作与核验结果。'}</p>
        <small>更正编号：{context.repair.revision_id}</small></div>}
      {profile&&<div className="repair-profile"><h4>原商品档案</h4><p>{profile.summary}</p>{facts.length>0&&<dl>{facts.map((fact,index)=><div key={index}><dt>{fact.feature}</dt><dd>{fact.value}</dd></div>)}</dl>}
        {(profile.unknowns.length>0||profile.conflicts.length>0)&&<p className="repair-muted">资料中还有 {profile.unknowns.length} 项待确认、{profile.conflicts.length} 项冲突。更正内容仍需依据原实拍资料核验。</p>}</div>}
      {pack&&<div className="repair-assets"><h4>当前素材 · 版本 {pack.manifest_revision}</h4><p className="repair-muted">领取有效期：{new Date(pack.expires_at).toLocaleString()}</p>
        {items.map((item,index)=><div className="repair-asset" key={item.deliverable_id}><span className="repair-number">{String(index+1).padStart(2,'0')}</span><div><strong>{item.file_name}</strong><small>{item.kind==='image'?'图片':item.kind==='video'?'视频':'文案'}{item.deliverable_id===pack.cover_deliverable_id?' · 当前封面':''}</small></div>
          {item.kind==='image'&&<button className="quiet" disabled={locked} onClick={()=>void run(async()=>{setImage('');const proof=await desk.repairImage(ticketId,pack.manifest_revision,item.deliverable_id,item.sha256);if(live.current)setImage(`data:image/png;base64,${proof.bytes_base64}`);})}>查看原图 {index+1}</button>}</div>)}
        {image&&<figure><img src={image} alt="当前原订单实际交付图片"/><button className="quiet" onClick={()=>setImage('')}>收起原图</button></figure>}
        {items.find(i=>i.kind==='copy')?.text&&<details><summary>查看当前配套文案</summary><p className="desk-message">{items.find(i=>i.kind==='copy')?.text}</p></details>}</div>}
      {!context.can_submit&&<div className="repair-unavailable">{context.reason_codes.filter(c=>c!=='PLATFORM_REPAIR_ALREADY_LINKED').map(code=><p key={code}>{reasons[code]??'原素材目前不可发起更正，请核对原订单与授权状态。'}</p>)}</div>}
      {context.can_submit&&pack&&<div className="repair-editor"><h4>选择要更正的内容</h4><div className="repair-tabs" role="group" aria-label="更正类型">{context.allowed_changes.map(k=><button aria-pressed={kind===k} disabled={locked} className={kind===k?'active':'quiet'} key={k} onClick={()=>{setKind(k);setConfirmed(false);}}>{kinds[k]}</button>)}</div>
        {kind==='COVER'&&<label>新封面<select aria-label="新封面" disabled={locked} value={cover} onChange={e=>{setCover(e.target.value);setConfirmed(false);}}>{items.filter(i=>i.kind==='image').map(i=><option key={i.deliverable_id} value={i.deliverable_id}>{i.file_name}{i.deliverable_id===pack.cover_deliverable_id?'（当前）':''}</option>)}</select></label>}
        {kind==='IMAGE_TEXT'&&<><label>加字图片<select aria-label="加字图片" disabled={locked} value={imageTarget} onChange={e=>{setImageTarget(e.target.value);setConfirmed(false);}}>{items.filter(i=>i.kind==='image').map(i=><option key={i.deliverable_id} value={i.deliverable_id}>{i.file_name}</option>)}</select></label>
          <label>图片短标题<textarea aria-label="图片短标题" disabled={locked} maxLength={28} value={title} onChange={e=>{setTitle(e.target.value);setConfirmed(false);}}/><span className="repair-muted">最多28字。保留完整画面，在下方留白区加字；请以原商品资料为依据。</span></label></>}
        {kind==='DISPLAY_TEXT'&&<label>更正后的配套文案<textarea aria-label="更正后的配套文案" disabled={locked} maxLength={2000} value={text} onChange={e=>{setText(e.target.value);setConfirmed(false);}}/><span className="repair-muted">更正独立文案文件；请写入原实拍资料可支持的内容。</span></label>}
        {kind==='ALLOWED_ORDER'&&<ol className="repair-order">{order.map((id,index)=><li key={id}><span>{items.find(i=>i.deliverable_id===id)?.file_name}</span><div><button className="quiet" aria-label={`将第 ${index+1} 项上移`} disabled={locked||index===0} onClick={()=>move(index,-1)}>上移</button><button className="quiet" aria-label={`将第 ${index+1} 项下移`} disabled={locked||index===order.length-1} onClick={()=>move(index,1)}>下移</button></div></li>)}</ol>}
        <label className="repair-confirm"><input type="checkbox" disabled={locked||!changed} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>已核对原商品资料，确认按以上内容发起更正。</span></label>
        <p className="repair-muted">提交后进入制作与交叉核验；通过后更新原订单素材包。售后额度和领取有效期沿用原订单。</p>
        <button className="repair-submit" disabled={locked||!confirmed||!changed} onClick={()=>void run(submit)}>提交免费更正</button></div>}
    </>}
  </section>;
}

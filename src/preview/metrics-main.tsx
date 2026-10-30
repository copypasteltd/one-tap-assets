import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {DTO} from '../shared/contracts/types';
import {MetricsClient,metricsRange} from '../shared/client/metrics';
import {MetricsInsights,trafficNames} from './metrics-insights';
import './support-console.css';
import './metrics.css';

const localTime=(date:Date)=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
const recent=(days:number)=>{const end=new Date();end.setSeconds(0,0);return {start:localTime(new Date(end.getTime()-days*86400000)),end:localTime(end)};};
const clock=(s:string)=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(s));
const number=(n:number)=>new Intl.NumberFormat('zh-CN').format(n);
const money=(n:number)=>new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:6}).format(n/1000000);
const engineNames:Record<string,string>={PHOTO_LAYOUT:'原图展示',PER_SHOT_AI:'逐镜 AI',REFERENCE_FILM:'连续短片'};
export function MetricsConsole(){
  const desk=useRef(new MetricsClient()),epoch=useRef(0),initial=useRef(recent(7));
  const [token,setToken]=useState(''),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [start,setStart]=useState(initial.current.start),[end,setEnd]=useState(initial.current.end),[data,setData]=useState<DTO<'MetricsSummary'>>();
  const [readAt,setReadAt]=useState('');
  const [insights,setInsights]=useState<DTO<'ProductInsights'>>(),[traffic,setTraffic]=useState<DTO<'ProductInsights'>['traffic_group']>('ALL');
  function disconnect(){epoch.current++;desk.current.disconnect();setToken('');setConnected(false);setBusy(false);setData(undefined);setInsights(undefined);setError('');setReadAt('');}
  useEffect(()=>{window.addEventListener('pagehide',disconnect);return()=>{window.removeEventListener('pagehide',disconnect);epoch.current++;desk.current.disconnect();};},[]);
  async function load(from=start,to=end,group=traffic){const current=++epoch.current;setBusy(true);setError('');setData(undefined);setInsights(undefined);setReadAt('');
    try{const range=metricsRange(from,to);const result=await desk.current.read(range.window_start,range.window_end);if(current!==epoch.current)return;setData(result);setReadAt(new Date().toISOString());
      const detail=await desk.current.readInsights(range.window_start,range.window_end,group);if(current!==epoch.current)return;setInsights(detail);setReadAt(new Date().toISOString());}
    catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'统计未能读取，请重试原时间窗口');}finally{if(current===epoch.current)setBusy(false);}}
  function changeRange(from:string,to:string){setStart(from);setEnd(to);setData(undefined);setInsights(undefined);setReadAt('');setError('');}
  const ratio=data?.automatic_pack_success_ratio;
  return <main className="desk metrics-desk"><header><a className="desk-brand" href="/ops/metrics">柚子创作社 <span>一品成片 · 运营</span></a><div><span className="desk-kicker">制作与履约</span><h1>把每一单，<br/>看清楚。</h1><p>按同一个时间窗口，核对付款、交付与待处理事项。</p></div><nav className="metrics-nav"><a href="/ops/support">客服工作台 ↗</a><a href="/ops/review">社区审核 ↗</a></nav></header>
    {!connected?<section className="desk-login"><h2>连接运营账户</h2><p>使用有统计查看权限的独立管理令牌。令牌只保留在当前连接中，断开后清除。</p><form onSubmit={e=>{e.preventDefault();try{desk.current.connect(token);setToken('');setConnected(true);void load();}catch(e){setError(e instanceof Error?e.message:'请检查令牌');}}}><label>运营访问令牌<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="输入分配给你的运营令牌"/></label><button disabled={!token.trim()}>连接运营看板</button></form></section>:<>
      <section className="metrics-window" aria-label="统计时间窗口"><div className="metrics-window-title"><span>查询窗口</span><button className="quiet" onClick={disconnect}>断开连接</button></div><form onSubmit={e=>{e.preventDefault();void load();}}><label>开始时间<input type="datetime-local" required disabled={busy} value={start} onChange={e=>changeRange(e.target.value,end)}/></label><span className="metrics-to">至</span><label>结束时间<input type="datetime-local" required disabled={busy} value={end} onChange={e=>changeRange(start,e.target.value)}/></label><button disabled={busy||!start||!end}>{busy?'正在读取…':'读取统计'}</button></form><div className="metrics-presets">{[1,7,30].map(days=><button className="quiet" key={days} disabled={busy} onClick={()=>{const next=recent(days);changeRange(next.start,next.end);void load(next.start,next.end);}}>近{days}天</button>)}<span>按当前设备时区输入；单次最多90天。</span></div></section>
      <section className="metrics-window metrics-cohort"><label>下方运营明细的流量分组<select disabled={busy} value={traffic} onChange={e=>{const group=e.target.value as DTO<'ProductInsights'>['traffic_group'];setTraffic(group);void load(start,end,group);}}>{Object.entries(trafficNames).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><p className="metrics-note">分组由有独立标记权限的运营人员维护。外部标记不代表已验证真人客户；未分类不会自动当作外部。原履约总览始终展示全部流量。</p></section>
      {busy&&<p className="metrics-loading" role="status">正在读取这个窗口的统计记录…</p>}
      {insights&&<MetricsInsights data={insights}/>}
      {data&&<><div className="metrics-asof"><p>{clock(data.window_start)} — {clock(data.window_end)}</p><span>读取于 {clock(readAt)}</span></div><section className="metrics-flow" aria-label="付款与交付"><div><span className="metrics-label">已付款订单</span><strong data-testid="metrics-paid">{number(data.paid_orders)}</strong><small>窗口内创建，当前已确认付款</small></div><span className="metrics-arrow" aria-hidden="true">→</span><div><span className="metrics-label">已完整交付</span><strong data-testid="metrics-delivered">{number(data.delivered_orders)}</strong><small>同批已付款订单，有首版交付记录</small></div><div className="metrics-ratio"><span className="metrics-label">当前完整交付比例</span><strong>{ratio==null?'—':`${new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(ratio*100)}%`}</strong><small>{ratio==null?'暂无已付款订单':'包含制作中订单，后续可能变化'}</small></div></section>
      {data.paid_orders===0&&<p className="metrics-empty">这个窗口暂无已付款订单。可扩大时间范围；空数据不代表服务质量已经通过。</p>}
      <div className="metrics-columns"><section className="metrics-sheet"><div className="metrics-section-head"><h2>待处理事项</h2><span>各记录按创建时间入窗</span></div><dl className="metrics-issues"><div><dt>供应商结果待查</dt><dd>{number(data.unknown_submissions)}</dd></div><div><dt>退款待确认</dt><dd>{number(data.refunds_pending)}</dd></div><div><dt>超时任务</dt><dd>{number(data.hard_deadline_failures)}</dd></div></dl><p className="metrics-note">待查结果沿用原任务核对。同一任务的多个超时阶段只计一次，统计读取不重试或重新购买制作。</p><a className="metrics-link" href="/ops/support">前往客服工作台处理 ↗</a></section>
      <section className="metrics-sheet"><h2>这批订单的已结算制作费用</h2><p className="metrics-cost"><span>¥</span> {money(data.cost_micro_total)}</p><p className="metrics-note">按订单累计已结算费用汇总，包含失败订单；不把预留额度视为已发生费用。不包含平台免费识别、样例等费用，不代表平台总成本。</p></section></div>
      <section className="metrics-sheet metrics-routes"><div className="metrics-section-head"><h2>首版履约用时</h2><span>95%的有效记录不超过这个时长</span></div><table><caption>按原冻结制作路线统计，从履约开始到首版交付；售后版本不重复计算。</caption><thead><tr><th scope="col">制作路线</th><th scope="col">P95 用时</th></tr></thead><tbody>{Object.entries(data.route_p95_seconds).map(([engine,seconds])=><tr key={engine}><th scope="row">{engineNames[engine]}</th><td>{seconds==null?<span className="metrics-missing">暂无完整记录</span>:`${number(seconds)} 秒`}</td></tr>)}</tbody></table></section>
      <p className="desk-footnote">上方原履约总览始终包含全部流量；运营明细按所选分组读取。各统计反映原窗口记录的当前状态和当前服务端分组，不是历史时点快照。推荐曝光、识别准确率、完整自助成功率及人工成本尚未取得独立测量，均不作为已有成绩。</p></>}
    </>}
    {error&&<div className="desk-error" role="alert">{error}{connected&&<button className="quiet" disabled={busy} onClick={()=>void load()}>重试原时间窗口</button>}</div>}
    <footer>一品成片 · 运营看板<span>把异常留在眼前，让制作继续向前。</span></footer></main>;
}
createRoot(document.getElementById('root')!).render(<MetricsConsole/>);

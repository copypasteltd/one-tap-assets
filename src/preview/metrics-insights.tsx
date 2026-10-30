import React from 'react';
import type {DTO} from '../shared/contracts/types';
const number=(n:number)=>new Intl.NumberFormat('zh-CN').format(n);
const money=(n:number)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:6}).format(n/1000000);
export const trafficNames={ALL:'全部流量（包含测试）',EXTERNAL:'已标记外部',INTERNAL_TEST:'内部测试',UNCLASSIFIED:'尚未分类'};
export function MetricsInsights({data}:{data:DTO<'ProductInsights'>}){
  const r=data.recognition,rows:[string,string][]=[['识别任务 / 原始调用尝试',`${number(r.jobs)} / ${number(r.attempts)}`],
    ['已完成 / 需补拍或受阻 / 失败',`${number(r.ready_jobs)} / ${number(r.blocked_jobs)} / ${number(r.failed_jobs)}`],
    ['机器原始档案 / 有观察证据的档案',`${number(r.machine_profiles)} / ${number(r.profiles_with_observed_fields)}`],
    ['可见观察 / 标签文字',`${number(r.observed_fields)} / ${number(r.ocr_fields)}`],['推测 / 未知 / 冲突',`${number(r.hypothesis_fields)} / ${number(r.unknown_fields)} / ${number(r.conflicted_fields)}`],
    ['字段证据占比',r.evidenced_field_share===null?'暂无可计算字段':`${new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(r.evidenced_field_share*100)}%`],['识别准确率','未测量']];
  return <div className="metrics-insights" data-testid="product-insights"><div className="metrics-section-head"><h2>从照片到使用 · {trafficNames[data.traffic_group]}</h2><span>来自已入库记录，按各项所述时间入窗</span></div>
    <div className="metrics-columns"><section className="metrics-sheet"><h2>照片识别</h2><dl className="metrics-issues">{rows.map(([title,value])=><div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl><p className="metrics-note">只读识别任务生成的原始档案；用户改正和推测不算观察事实。字段占比反映结构覆盖，不能替代有标准答案的准确率评测。</p></section>
    <section className="metrics-sheet"><h2>方案与交付</h2><dl className="metrics-issues"><div><dt>去重商品预设选择</dt><dd>{number(data.funnel.selected_product_presets)}</dd></div><div><dt>付款订单 / 付款账户</dt><dd>{number(data.funnel.paid_orders)} / {number(data.funnel.paid_buyers)}</dd></div><div><dt>首版已交付</dt><dd>{number(data.funnel.first_deliveries)}</dd></div><div><dt>推荐曝光 / 点击</dt><dd>未采集</dd></div><div><dt>完整自助成功率</dt><dd>未测量</dd></div></dl><p className="metrics-note">订单按创建时间入窗，完整交付须有首版清单。未独立证明全程无人工参与；账户付款记录也不等于赛事有效付费用户。</p></section></div>
    <div className="metrics-columns"><section className="metrics-sheet"><h2>相册与自愿反馈</h2><dl className="metrics-issues"><div><dt>确认保存文件 / 订单</dt><dd>{number(data.album.saved_files)} / {number(data.album.saved_orders)}</dd></div><div><dt>历史无服务器时间的保存项</dt><dd>{number(data.album.unwindowed_receipts)}</dd></div><div><dt>准备使用 / 已经用上 / 需调整</dt><dd>{number(data.feedback.planned_use)} / {number(data.feedback.used)} / {number(data.feedback.needs_adjustment)}</dd></div><div><dt>当前已撤回</dt><dd>{number(data.feedback.withdrawn)}</dd></div></dl><p className="metrics-note">同一订单文件跨重试、跨设备只计一次，按首次服务器确认保存时间入窗；历史缺时项单列。自愿反馈按最后更新入窗，只保留当前选择。两者均不能证明实际发布或投放。</p></section>
    <section className="metrics-sheet"><h2>社区有效动作</h2><dl className="metrics-issues"><div><dt>已公开的社区版本</dt><dd>{number(data.community.published_versions)}</dd></div><div><dt>付费已交付的去重复用</dt><dd>{number(data.community.effective_reuses)}</dd></div></dl><p className="metrics-note">公开版本按发布申请创建时间入窗，须保持已发布和样例已公开。复用按订单创建时间，排除作者自用，同一账户、商品和预设版本只计一次；收藏、重复下单不累加。全部流量仍包含测试。</p></section></div>
    <section className="metrics-sheet"><h2>已经记录的费用</h2><dl className="metrics-issues"><div><dt>订单制作费用（订单创建窗口）</dt><dd>¥ {money(data.costs.order_settled_micro)}</dd></div><div><dt>平台免费调用费用（预留创建窗口）</dt><dd>¥ {money(data.costs.platform_settled_micro)}</dd></div><div><dt>平台费用待结算项 / 无法归属账户项</dt><dd>{number(data.costs.platform_unresolved_reservations)} / {number(data.costs.platform_unclassified_reservations)}</dd></div><div><dt>人工审核与支持成本 / 完整总成本</dt><dd>未记账 / 未计算</dd></div></dl><p className="metrics-note">平台费用覆盖已使用平台账本的识别、免费尝试、样例等调用，实际金额以原回执结算。两个窗口口径不同，不相加充当期间总成本；未接入的人工成本不按零元处理。</p></section>
  </div>;
}

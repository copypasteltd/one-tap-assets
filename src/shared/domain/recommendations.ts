import type { DTO } from '../contracts/types.js';

export const RECOMMENDATION_POLICY = 'profile-evidence-1.0';
export interface StyleMatch { score: number; reason: string }

/** Routing hints only: hypotheses, OCR and unsupported product claims never earn a score. */
export function matchProductStyles(profile: DTO<'Profile'>, assetIds: readonly string[]): Record<string, StyleMatch> {
  const matches: Record<string, StyleMatch> = {
    'minimal-clean': { score: 40, reason: '通用留白风格，突出商品本身，适合先做一套基础素材。' },
    'portrait-social': { score: 20, reason: '竖版大图与短标题，适合在手机上浏览和分享。' },
    'launch-story': { score: 15, reason: '用连续章节整理同一件商品的整体与细节。' },
  };
  const category = profile.category ?? '';
  const categories: [RegExp, string, string][] = [
    [/箱包|手作|手工|编织|bag|craft/i, 'warm-handmade', '当前商品类别适合暖色纸感与自然质感的呈现。'],
    [/饰品|首饰|珠宝|配件|项链|耳环|戒指|jewel|accessor/i, 'quiet-luxury', '当前商品类别适合深色衬底与克制排版。'],
    [/烘焙|餐饮|食品|饮品|蛋糕|面包|咖啡|甜点|food|bakery|drink/i, 'appetite-flash', '当前商品类别适合用暖色近景呈现实拍层次。'],
    [/家居|摆件|家具|灯具|花瓶|home|furniture/i, 'home-calm', '当前商品类别适合空间留白与自然色调。'],
    [/日用|生活|杯|洗护|清洁|文具|护肤|daily|cup|bottle/i, 'fresh-daily', '当前商品类别适合明亮轻盈的日常风格。'],
  ];
  for (const [pattern, id, reason] of categories) if (pattern.test(category)) matches[id] = { score: 90, reason };
  const assets = new Set(assetIds);
  const evidence = new Map(profile.evidence.filter(e => assets.has(e.asset_id)).map(e => [e.evidence_id, e]));
  const observed = profile.observations.filter(o => o.status === 'OBSERVED' && o.source_asset_ids.length > 0
    && o.source_asset_ids.every(id => assets.has(id)) && o.evidence_ids.length > 0
    && o.evidence_ids.every(id => { const e = evidence.get(id); return e?.kind === 'OBSERVATION' && o.source_asset_ids.includes(e.asset_id); }));
  if (observed.some(o => /颜色|配色|色彩|colour|color/i.test(o.feature)))
    matches['color-pop'] = { score: 60, reason: '照片已确认可见配色，可以用色块突出商品原色。' };
  if (observed.some(o => /结构|部件|细节|structure|detail/i.test(o.feature)))
    matches['feature-cards'] = { score: 70, reason: '照片已确认结构细节，适合用信息卡片逐项展示。' };
  return matches;
}

export const RECOMMENDATION_MEASUREMENT = 'recommendation-visible-v1';
export const IMPRESSION_MIN_RATIO = 0.5;
export const IMPRESSION_DWELL_MS = 500;
export const MEASUREMENT_TTL_MS = 15 * 60 * 1000;

/** Lifecycle/viewport changes cancel a dwell; rendering or short visits do not count. */
export function visibleDwell(report: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined, sent = false;
  const stop = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  return {
    ratio(value: number) {
      if (!Number.isFinite(value) || value < IMPRESSION_MIN_RATIO) { stop(); return; }
      if (sent || timer !== undefined) return;
      timer = setTimeout(() => { timer = undefined; sent = true; report(); }, IMPRESSION_DWELL_MS);
    }, stop
  };
}

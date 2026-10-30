/** Preserve the user-initiated copy action on LAN HTTP origins. */
export async function copyBrowserText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Try the focused selection below. */ }
  }
  const previous = document.activeElement;
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.append(field);
  try {
    field.focus({ preventScroll: true });
    field.select();
    if (!document.execCommand('copy')) throw new Error('复制失败，请选中文案手动复制');
  } finally {
    field.remove();
    if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
  }
}

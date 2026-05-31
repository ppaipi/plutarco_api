// ─── utils.js ─────────────────────────────────────────────────────────────────

export function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}

export function capitalize(t) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function sortByOrden(a, b) {
  const oa = Number.isInteger(a.Orden) ? a.Orden : Infinity;
  const ob = Number.isInteger(b.Orden) ? b.Orden : Infinity;
  if (oa !== ob) return oa - ob;
  return a.Nombre.localeCompare(b.Nombre, 'es');
}

export function Ocultar(el) {
  if (el) { el.classList.add('oculto'); el.classList.remove('visible'); }
}

export function Mostrar(el) {
  if (el) { el.classList.remove('oculto'); el.classList.add('visible'); }
}
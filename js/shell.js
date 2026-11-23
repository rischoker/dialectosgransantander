/* Navegación tipo Encarta: una unidad a la vez, barra lateral, teclado,
   modo exposición y enlaces cruzados entre subzonas, laboratorio, videos y léxico. */
(function () {
  const units = Array.from(document.querySelectorAll('.unit'));
  if (!units.length) return;
  const keys = units.map(u => u.dataset.unit);
  const links = Array.from(document.querySelectorAll('[data-goto]'));
  const progress = document.getElementById('unit-progress');
  const mTitle = document.getElementById('mobile-unit-title');
  let current = null;

  /* ---------- Pie de cada unidad: anterior / siguiente ---------- */
  units.forEach((u, i) => {
    const prev = units[i - 1], next = units[i + 1];
    const nav = document.createElement('div');
    nav.className = 'unit-pager max-w-7xl mx-auto px-6 md:px-12 py-10 grid grid-cols-2 gap-4';
    const card = (x, dir) => !x ? '<span></span>' : `
      <a href="#/${x.dataset.unit}" data-goto="${x.dataset.unit}" class="group block rounded-2xl border border-tarjeta-borde bg-white hover:border-terracota hover:shadow-md transition-all p-4 ${dir === 'next' ? 'text-right' : ''}">
        <span class="block text-[10px] font-mono uppercase tracking-widest text-pizarra-light mb-1">${dir === 'next' ? 'Siguiente' : 'Anterior'} · ${keys.indexOf(x.dataset.unit)} de ${units.length - 1}</span>
        <span class="font-serif font-bold text-pizarra group-hover:text-terracota"><i class="fa-solid ${x.dataset.icon} mr-2 text-terracota"></i>${x.dataset.title}</span>
        <i class="fa-solid ${dir === 'next' ? 'fa-arrow-right ml-2' : 'fa-arrow-left mr-2'} text-pizarra-light group-hover:text-terracota"></i>
      </a>`;
    nav.innerHTML = card(prev, 'prev') + card(next, 'next');
    // la portada lleva su propio botón de entrada
    if (u.dataset.unit !== 'portada') u.appendChild(nav);
  });

  /* ---------- Cambio de unidad ---------- */
  function show(key, opts = {}) {
    const u = document.getElementById('u-' + key);
    if (!u) return;
    if (current !== u) {
      units.forEach(x => x.classList.toggle('is-active', x === u));
      current = u;
      document.querySelectorAll('.unit-link').forEach(a => a.classList.toggle('is-active', a.dataset.goto === key));
      const i = keys.indexOf(key);
      if (progress) progress.style.width = `${(i / (units.length - 1)) * 100}%`;
      if (mTitle) mTitle.textContent = u.dataset.title;
      document.title = (key === 'portada' ? '' : u.dataset.title + ' · ') + 'Voces del Oriente Colombiano';
      if (!opts.keepScroll) window.scrollTo(0, 0);
      // los lienzos (globo, espectrogramas) se miden al mostrarse
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      if (!opts.noHash) history.replaceState(null, '', '#/' + key);
    }
    closeSidebar();
  }
  const unitOf = (el) => el && el.closest && el.closest('.unit');

  // Cualquier código que haga scrollIntoView sobre algo de otra unidad abre esa unidad primero
  const nativeScroll = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (arg) {
    const u = unitOf(this);
    if (u && u !== current) {
      show(u.dataset.unit, { keepScroll: true });
      const el = this;
      requestAnimationFrame(() => nativeScroll.call(el, arg));
      return;
    }
    return nativeScroll.call(this, arg);
  };

  // Enlaces internos (#/unidad o #id-de-sección)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const h = a.getAttribute('href');
    e.preventDefault();
    go(h);
  });
  function go(hash) {
    if (!hash || hash === '#') return;
    if (hash.startsWith('#/')) { show(hash.slice(2)); return; }
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    const u = unitOf(el);
    if (u) show(u.dataset.unit, { keepScroll: true });
    requestAnimationFrame(() => {
      if (el.tagName === 'SECTION' && el.parentElement === u && u.firstElementChild === el) window.scrollTo(0, 0);
      else nativeScroll.call(el, { behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------- Teclado y control remoto de presentaciones ---------- */
  const step = (d) => { const i = keys.indexOf(current.dataset.unit) + d; if (i >= 0 && i < keys.length) show(keys[i]); };
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const atTop = window.scrollY <= 2;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'PageDown' && atBottom) { e.preventDefault(); step(1); }
    else if (e.key === 'PageUp' && atTop) { e.preventDefault(); step(-1); }
  });

  /* ---------- Modo exposición (pantalla completa) ---------- */
  const pb = document.getElementById('present-btn');
  if (pb) pb.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    if (pb) pb.querySelector('span').textContent = document.fullscreenElement ? 'Salir de la exposición' : 'Modo exposición';
    if (pb) pb.querySelector('i').className = 'fa-solid ' + (document.fullscreenElement ? 'fa-compress' : 'fa-expand');
  });

  /* ---------- Barra lateral en celular ---------- */
  const scrim = document.getElementById('sidebar-scrim');
  function closeSidebar() { document.body.classList.remove('sidebar-open'); if (scrim) scrim.classList.add('hidden'); }
  const ob = document.getElementById('sidebar-open');
  if (ob) ob.addEventListener('click', () => { document.body.classList.add('sidebar-open'); scrim.classList.remove('hidden'); });
  if (scrim) scrim.addEventListener('click', closeSidebar);

  /* ---------- Enlaces cruzados (fichas conectadas) ---------- */
  const COLORS = { 1: '#F43F5E', 2: '#F97316', 3: '#10B981', 4: '#F59E0B', 5: '#14B8A6' };
  const LEX_KEY = { 1: 'Santander Interior', 2: 'Vélez', 4: 'Cúcuta', 5: 'Ocaña' };
  const MU = (window.MUESTRAS && window.MUESTRAS.muestras) || [];
  const VI = (window.MUESTRAS && window.MUESTRAS.videos) || {};

  window.irAMuestra = (id) => { show('laboratorio'); setTimeout(() => window.cargarMuestra && window.cargarMuestra(id), 250); const lab = document.getElementById('entonacion'); if (lab) setTimeout(() => nativeScroll.call(lab, { behavior: 'smooth', block: 'start' }), 120); };
  window.irAVideo = (z) => { show('corpus'); setTimeout(() => window.playVideoFragment ? window.playVideoFragment(z) : window.loadVideoSubzone(z), 250); };
  window.irALexico = (z) => {
    show('lexico');
    const inp = document.getElementById('lexicon-search');
    if (inp && LEX_KEY[z]) { inp.value = LEX_KEY[z]; inp.dispatchEvent(new Event('input')); }
  };
  window.irASubzona = (zoneText) => {
    const t = (zoneText || '').toLowerCase();
    const z = t.includes('ocaña') ? 5 : t.includes('cúcuta') || t.includes('pamplona') ? 4 : t.includes('vélez') || t.includes('málaga') ? 2 : t.includes('magdalena') || t.includes('barranca') ? 3 : 1;
    show('subzonas');
    if (typeof selectSubzone === 'function') selectSubzone(z);
  };

  function addZoneLinks(id) {
    const box = document.getElementById('subzone-details');
    if (!box) return;
    const old = box.querySelector('.zone-links'); if (old) old.remove();
    const m = MU.find(x => x.zona === id);
    const btn = (icon, label, fn) => `<button type="button" onclick="${fn}" class="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold transition-colors"><i class="fa-solid ${icon}" style="color:${COLORS[id]}"></i>${label}</button>`;
    const parts = [];
    if (m) parts.push(btn('fa-wave-square', 'Escuchar y analizar', `irAMuestra('${m.id}')`));
    if (VI[id]) parts.push(btn('fa-film', 'Ver el video', `irAVideo(${id})`));
    if (LEX_KEY[id]) parts.push(btn('fa-book-open', 'Palabras de la zona', `irALexico(${id})`));
    if (!parts.length) return;
    const div = document.createElement('div');
    div.className = 'zone-links mt-5 pt-4 border-t border-white/10';
    div.innerHTML = `<div class="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">Explorar esta subzona en el atlas</div><div class="flex flex-wrap gap-2">${parts.join('')}</div>`;
    box.appendChild(div);
  }
  if (typeof window.selectSubzone === 'function') {
    const orig = window.selectSubzone;
    window.selectSubzone = function (id) { orig(id); addZoneLinks(id); };
  }

  /* ---------- Inicio ---------- */
  window.irAUnidad = show;
  const start = () => {
    const h = location.hash;
    if (h.startsWith('#/') && keys.includes(h.slice(2))) show(h.slice(2), { noHash: true });
    else if (h && document.getElementById(h.slice(1))) { show('portada', { noHash: true }); go(h); }
    else show('portada', { noHash: true });
    if (typeof selectSubzone === 'function') addZoneLinks(1);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0));
  else start();
})();

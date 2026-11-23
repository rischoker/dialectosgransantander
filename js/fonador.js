/* Aparato fonador animado (corte sagital).
   Muestra cómo se articula cada sonido del AFI: posición de la lengua, labios,
   velo del paladar (aire por la boca o por la nariz) y cuerdas vocales.
   Es un esquema a partir de la transcripción, no un registro de la boca real. */
(function () {
  const host = document.getElementById('fonador-svg');
  if (!host) return;
  const info = document.getElementById('fonador-info');
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------- Lugares de articulación (punto de constricción) ---------- */
  const PLACE = {
    bilabial: [68, 205], labiodental: [82, 205], dental: [96, 199], interdental: [90, 205],
    alveolar: [107, 190], postalveolar: [118, 183], palatal: [165, 170], velar: [245, 174],
    labiovelar: [245, 176], glotal: [297, 318]
  };

  /* ---------- Posturas de la lengua: punta, lámina, dorso, raíz ---------- */
  const TONGUE = {
    reposo: [[102, 222], [140, 214], [200, 206], [258, 232]],
    alveolar: [[106, 191], [136, 201], [195, 207], [258, 232]],
    alveolarFric: [[106, 195], [137, 202], [195, 207], [258, 232]],
    dental: [[97, 200], [134, 203], [195, 207], [258, 232]],
    interdental: [[89, 205], [128, 206], [195, 208], [258, 232]],
    postalveolar: [[113, 188], [140, 182], [195, 199], [258, 230]],
    palatal: [[101, 218], [132, 192], [167, 172], [250, 222]],
    palatalFric: [[101, 218], [132, 194], [167, 176], [250, 222]],
    velar: [[102, 222], [152, 214], [244, 175], [268, 214]],
    velarFric: [[102, 222], [152, 214], [244, 180], [268, 216]],
    velarAprox: [[102, 222], [152, 214], [242, 185], [268, 218]],
    i: [[100, 216], [130, 190], [170, 177], [250, 222]],
    e: [[100, 218], [134, 198], [185, 189], [252, 226]],
    a: [[102, 228], [142, 226], [205, 218], [255, 240]],
    o: [[106, 226], [150, 220], [225, 196], [262, 214]],
    u: [[108, 226], [155, 220], [238, 183], [266, 206]]
  };

  /* ---------- Inventario ---------- */
  // m: modo, l: lugar, v: sonora, lab: labios, vel: velo bajado, t: postura de lengua
  const PH = {
    p: { m: 'oclusiva', l: 'bilabial', v: false, lab: 'cerrados', t: 'reposo' },
    b: { m: 'oclusiva', l: 'bilabial', v: true, lab: 'cerrados', t: 'reposo' },
    β: { m: 'aproximante', l: 'bilabial', v: true, lab: 'casi', t: 'reposo' },
    m: { m: 'nasal', l: 'bilabial', v: true, lab: 'cerrados', t: 'reposo', vel: 1 },
    f: { m: 'fricativa', l: 'labiodental', v: false, lab: 'labiodental', t: 'reposo' },
    t: { m: 'oclusiva', l: 'dental', v: false, t: 'dental' },
    d: { m: 'oclusiva', l: 'dental', v: true, t: 'dental' },
    ð: { m: 'aproximante', l: 'interdental', v: true, t: 'interdental' },
    θ: { m: 'fricativa', l: 'interdental', v: false, t: 'interdental' },
    s: { m: 'fricativa', l: 'alveolar', v: false, t: 'alveolarFric', sib: true },
    z: { m: 'fricativa', l: 'alveolar', v: true, t: 'alveolarFric', sib: true },
    n: { m: 'nasal', l: 'alveolar', v: true, t: 'alveolar', vel: 1 },
    l: { m: 'lateral', l: 'alveolar', v: true, t: 'alveolar' },
    ɾ: { m: 'vibrante simple', l: 'alveolar', v: true, t: 'alveolar' },
    r: { m: 'vibrante múltiple', l: 'alveolar', v: true, t: 'alveolar', trill: true },
    tʃ: { m: 'africada', l: 'postalveolar', v: false, t: 'postalveolar' },
    ʝ: { m: 'fricativa', l: 'palatal', v: true, t: 'palatalFric' },
    ɲ: { m: 'nasal', l: 'palatal', v: true, t: 'palatal', vel: 1 },
    j: { m: 'aproximante (semivocal)', l: 'palatal', v: true, t: 'i' },
    k: { m: 'oclusiva', l: 'velar', v: false, t: 'velar' },
    g: { m: 'oclusiva', l: 'velar', v: true, t: 'velar' },
    ɣ: { m: 'aproximante', l: 'velar', v: true, t: 'velarAprox' },
    x: { m: 'fricativa', l: 'velar', v: false, t: 'velarFric' },
    ŋ: { m: 'nasal', l: 'velar', v: true, t: 'velar', vel: 1 },
    w: { m: 'aproximante (semivocal)', l: 'labiovelar', v: true, t: 'u', lab: 'redondeados' },
    h: { m: 'fricativa (aspiración)', l: 'glotal', v: false, t: 'reposo' },
    a: { m: 'vocal', l: 'central abierta', v: true, t: 'a', jaw: 7 },
    e: { m: 'vocal', l: 'anterior media', v: true, t: 'e', jaw: 3 },
    i: { m: 'vocal', l: 'anterior cerrada', v: true, t: 'i', jaw: 1 },
    o: { m: 'vocal', l: 'posterior media', v: true, t: 'o', lab: 'redondeados', jaw: 4 },
    u: { m: 'vocal', l: 'posterior cerrada', v: true, t: 'u', lab: 'redondeados', jaw: 1 },
    '·': { m: 'reposo', l: '', v: false, t: 'reposo', rest: true }
  };

  /* ---------- Dibujo estático ---------- */
  host.innerHTML = `
  <svg viewBox="0 0 400 340" class="w-full h-auto select-none" style="max-height:38vh;display:block;margin:0 auto" role="img" aria-label="Corte sagital del aparato fonador">
    <defs>
      <marker id="fz-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#0EA5E9"/></marker>
      <radialGradient id="fz-skin" cx="35%" cy="40%" r="80%"><stop offset="0" stop-color="#FBEDE0"/><stop offset="1" stop-color="#F1D9C3"/></radialGradient>
      <linearGradient id="fz-tongue-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8707A"/><stop offset="1" stop-color="#C2414F"/></linearGradient>
    </defs>
    <!-- cabeza -->
    <path d="M128,6 C104,20 92,46 94,80 L84,96 C70,108 52,124 46,140 C42,150 50,157 62,158 L66,168 C60,176 57,186 60,194 L64,205 L60,214 C58,226 64,236 72,240 C66,256 72,280 94,290 C128,300 152,306 166,320 L174,340 L400,340 L400,6 Z"
      fill="url(#fz-skin)" stroke="#C9A58A" stroke-width="1.5"/>
    <!-- cavidad nasal -->
    <path d="M60,160 C70,146 92,134 130,130 C180,126 240,128 288,146 L296,170 C270,164 240,160 200,158 C160,158 128,166 104,180 C90,172 74,166 60,160 Z"
      fill="#FBE3D9" stroke="#D8A992" stroke-width="1.2"/>
    <!-- cavidad oral y faringe -->
    <path d="M64,200 L92,198 C98,192 102,188 106,187 C130,174 175,163 238,166 C262,168 282,176 296,186 L302,318 L296,330 L270,326 C262,300 250,282 230,270 C182,252 130,248 100,238 L92,214 L64,210 Z"
      fill="#FFF7EE" stroke="#D8A992" stroke-width="1.2"/>
    <!-- paladar duro (hueso) -->
    <path d="M104,186 C130,172 175,161 238,165" fill="none" stroke="#E2B796" stroke-width="7" stroke-linecap="round"/>
    <!-- flujo de aire -->
    <path id="fz-air-oral" d="M296,318 C298,260 296,214 286,196 C262,190 200,196 150,204 C120,208 92,206 34,206" fill="none" stroke="#0EA5E9" stroke-width="2.5" stroke-dasharray="6 6" marker-end="url(#fz-arrow)" opacity="0"/>
    <path id="fz-air-nasal" d="M296,318 C298,250 296,200 292,168 C270,150 200,140 130,142 C96,146 72,154 40,166" fill="none" stroke="#0EA5E9" stroke-width="2.5" stroke-dasharray="6 6" marker-end="url(#fz-arrow)" opacity="0"/>
    <!-- lengua -->
    <path id="fz-tongue" fill="url(#fz-tongue-grad)" stroke="#A8323F" stroke-width="1.2"/>
    <!-- velo del paladar -->
    <path id="fz-velum" fill="none" stroke="#E7A291" stroke-width="10" stroke-linecap="round"/>
    <!-- dientes -->
    <path d="M85,184 L97,184 L96,201 L90,204 L86,200 Z" fill="#FFFFFF" stroke="#BFB5A6" stroke-width="1"/>
    <g id="fz-jaw">
      <path d="M88,213 L95,210 L99,227 L91,229 Z" fill="#FFFFFF" stroke="#BFB5A6" stroke-width="1"/>
      <path id="fz-lip-low" fill="#D98C84" stroke="#B5675F" stroke-width="1"/>
    </g>
    <path id="fz-lip-up" fill="#D98C84" stroke="#B5675F" stroke-width="1"/>
    <!-- constricción -->
    <g id="fz-mark" opacity="0"></g>
    <!-- glotis (vista superior) -->
    <g transform="translate(348,286)">
      <circle r="27" fill="#FFF7EE" stroke="#D8A992"/>
      <path id="fz-fold-l" stroke="#C2414F" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path id="fz-fold-r" stroke="#C2414F" stroke-width="5" stroke-linecap="round" fill="none"/>
      <text y="40" text-anchor="middle" font-size="9" font-family="JetBrains Mono, monospace" fill="#546062">cuerdas vocales</text>
    </g>
    <path d="M300,320 L322,296" stroke="#D8A992" stroke-dasharray="3 3"/>
    <!-- nombres -->
    <g id="fz-labels" font-size="9" font-family="JetBrains Mono, monospace" fill="#3E4A4B">
      ${[['labios', 30, 236, 62, 212], ['dientes', 36, 182, 88, 190], ['alvéolos', 112, 222, 106, 190], ['paladar duro', 205, 116, 190, 163],
         ['velo del paladar', 290, 128, 270, 176], ['cavidad nasal', 112, 112, 140, 138], ['lengua', 170, 238, 180, 214], ['faringe', 318, 216, 300, 230]]
        .map(([t, x, y, x2, y2]) => `<line x1="${x}" y1="${y + 2}" x2="${x2}" y2="${y2}" stroke="#94A3B8" stroke-width="0.8"/><text x="${x}" y="${y}" text-anchor="middle" paint-order="stroke" stroke="#FFF7EE" stroke-width="3">${t}</text>`).join('')}
    </g>
  </svg>`;
  const $ = (id) => host.querySelector('#' + id);
  const tongueEl = $('fz-tongue'), velEl = $('fz-velum'), lipUp = $('fz-lip-up'), lipLow = $('fz-lip-low');
  const jawEl = $('fz-jaw'), mark = $('fz-mark'), airO = $('fz-air-oral'), airN = $('fz-air-nasal');
  const foldL = $('fz-fold-l'), foldR = $('fz-fold-r'), labels = $('fz-labels');

  /* ---------- Geometría animable ---------- */
  const R0 = [268, 322];
  function catmull(pts) {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }
  function render(st) {
    const [T, B, D, K] = st.tongue;
    const top = catmull([T, B, D, K, R0]);
    tongueEl.setAttribute('d', `${top} C250,292 200,268 150,256 C122,250 104,244 ${T[0] - 4},${T[1] + 12} C${T[0] - 6},${T[1] + 6} ${T[0] - 3},${T[1] + 1} ${T[0]},${T[1]} Z`);
    // velo: 0 subido (cierra la nariz), 1 bajado
    const v = st.vel;
    const tip = [292 - 18 * v, 184 + 22 * v];
    velEl.setAttribute('d', `M238,166 Q${266 - 4 * v},${170 + 4 * v} ${tip[0]},${tip[1]}`);
    // labios: cierre (0 abierto, 1 cerrado), redondeo (0..1), mandíbula (px)
    const c = st.close, r = st.round, j = st.jaw;
    const px = -6 * r;
    lipUp.setAttribute('d', `M64,186 C${57 + px},192 ${56 + px},200 ${64 + px},${203 + 2 * c} L86,${201 + c} L86,188 Z`);
    const ly = 210 - 6 * c + j * 0.6;
    lipLow.setAttribute('d', `M${66 + px},${ly} C${57 + px},${ly + 3} ${58 + px},${ly + 14} ${66},${ly + 18} L86,${ly + 14} L86,${ly + 2} Z`);
    jawEl.setAttribute('transform', `translate(0,${j * 0.6})`);
    // labiodental: el labio inferior sube hasta los dientes de arriba
    if (st.ld > 0) lipLow.setAttribute('transform', `translate(${6 * st.ld},${-6 * st.ld})`); else lipLow.removeAttribute('transform');
    // cuerdas vocales (vista superior): abiertas en sordas, juntas en sonoras
    const o = st.open;
    foldL.setAttribute('d', `M-2,-18 L${-3 - 12 * o},16`);
    foldR.setAttribute('d', `M2,-18 L${3 + 12 * o},16`);
  }

  let cur = { tongue: TONGUE.reposo.map(p => p.slice()), vel: 0, close: 0, round: 0, jaw: 2, ld: 0, open: 1 };
  function target(ph) {
    const P = PH[ph] || PH['·'];
    const lab = P.lab;
    return {
      tongue: TONGUE[P.t].map(p => p.slice()),
      vel: P.vel ? 1 : 0,
      close: lab === 'cerrados' ? 1 : lab === 'casi' ? 0.7 : 0,
      round: lab === 'redondeados' ? 1 : 0,
      ld: lab === 'labiodental' ? 1 : 0,
      jaw: P.jaw != null ? P.jaw : 1,
      open: P.rest ? 1 : P.l === 'glotal' ? 1.3 : P.v ? 0 : 0.9
    };
  }
  let raf = null;
  function tween(to, ms) {
    cancelAnimationFrame(raf);
    const from = JSON.parse(JSON.stringify(cur));
    const t0 = performance.now();
    const step = (now) => {
      const k = ms ? Math.min(1, (now - t0) / ms) : 1;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const L = (a, b) => a + (b - a) * e;
      cur = {
        tongue: from.tongue.map((p, i) => [L(p[0], to.tongue[i][0]), L(p[1], to.tongue[i][1])]),
        vel: L(from.vel, to.vel), close: L(from.close, to.close), round: L(from.round, to.round),
        jaw: L(from.jaw, to.jaw), ld: L(from.ld, to.ld), open: L(from.open, to.open)
      };
      render(cur);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function setMarks(ph) {
    const P = PH[ph] || PH['·'];
    const pt = PLACE[P.l];
    host.classList.toggle('fz-voiced', !!P.v && !P.rest);
    host.classList.toggle('fz-trill', !!P.trill);
    airO.setAttribute('opacity', P.rest ? 0 : (P.vel ? 0.25 : 0.9));
    airN.setAttribute('opacity', P.rest ? 0 : (P.vel ? 0.9 : 0));
    mark.innerHTML = '';
    if (!pt || P.rest || P.m === 'vocal' || P.m.startsWith('aproximante')) { mark.setAttribute('opacity', 0); return; }
    const [x, y] = pt;
    let g = '';
    if (P.m.startsWith('fricativa') || P.m === 'africada') {
      const col = P.sib ? '#06B6D4' : '#10B981';
      g = [0, 1, 2].map(i => `<path class="fz-fric" d="M${x - 14 - i * 6},${y - 6 + i * 6} l4,-3 l4,3 l4,-3" stroke="${col}" stroke-width="1.6" fill="none" style="animation-delay:${i * 0.12}s"/>`).join('');
      g += `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${col}" stroke-width="2"/>`;
    }
    if (P.m === 'oclusiva' || P.m === 'nasal' || P.m === 'africada' || P.m.startsWith('vibrante') || P.m === 'lateral') {
      const col = P.m === 'nasal' ? '#8B5CF6' : P.m === 'lateral' || P.m.startsWith('vibrante') ? '#A78BFA' : '#F43F5E';
      g += `<circle class="fz-close" cx="${x}" cy="${y}" r="7" fill="${col}" fill-opacity=".25" stroke="${col}" stroke-width="2"/>`;
    }
    mark.innerHTML = g; mark.setAttribute('opacity', 1);
  }

  function describe(ph) {
    const P = PH[ph];
    if (!P || P.rest) { info.innerHTML = '<p class="text-xs text-pizarra-light">Toca un símbolo de la transcripción o una palabra del espectrograma.</p>'; return; }
    const chip = (k, v) => `<span class="inline-block mr-1.5 mb-1 px-2 py-0.5 rounded-md bg-pergamino border border-tarjeta-borde text-[11px]"><span class="text-pizarra-light">${k}:</span> <b class="text-pizarra">${v}</b></span>`;
    const name = P.m === 'vocal' ? `Vocal ${P.l}${P.lab === 'redondeados' ? ' redondeada' : ''}` : `${P.m[0].toUpperCase() + P.m.slice(1)} ${P.l} ${P.v ? 'sonora' : 'sorda'}`;
    const extra = ph === 'l' ? ' El aire sale por los lados de la lengua.' : ph === 'r' ? ' La punta de la lengua vibra varias veces.' : ph === 'ɾ' ? ' La punta toca una sola vez los alvéolos.' :
      ph === 'h' ? ' No hay contacto en la boca: el aire roza en la glotis. Es la /s/ aspirada de Ocaña y el Magdalena.' :
      ph === 's' ? ' La punta se acerca a los alvéolos sin tocarlos y el aire silba contra los dientes.' :
      ph === 'x' ? ' El dorso se acerca al velo; en Santander suena tensa y fuerte («¡juepucha!»).' :
      ph === 'ð' ? ' La punta asoma entre los dientes, sin cerrar el paso del aire.' : '';
    info.innerHTML = `<div class="flex items-baseline gap-2 mb-1"><span class="font-mono font-bold text-terracota text-xl">[${ph}]</span><span class="font-serif font-bold text-pizarra text-sm">${name}</span></div>` +
      chip('Cuerdas vocales', P.v ? 'vibran' : P.l === 'glotal' ? 'abiertas, con fricción' : 'no vibran') +
      chip('Velo', P.vel ? 'bajado (aire por la nariz)' : 'subido (aire por la boca)') +
      (P.lab ? chip('Labios', P.lab === 'labiodental' ? 'labio inferior contra dientes' : P.lab) : '') +
      (extra ? `<p class="text-[11px] text-pizarra-light leading-snug mt-0.5">${extra.trim()}</p>` : '');
  }

  let shown = '·';
  function show(ph, opts = {}) {
    if (ph === shown && !opts.force) return;
    shown = ph;
    tween(target(ph), opts.ms != null ? opts.ms : 380);
    setMarks(ph);
    if (!opts.quiet) describe(ph);
    else { const P = PH[ph]; if (P && !P.rest) describe(ph); }
  }

  /* ---------- Secuencias ---------- */
  let seqTimer = null;
  function stopSeq() { clearTimeout(seqTimer); seqTimer = null; }
  function sequence(list, stepMs) {
    stopSeq();
    let i = 0;
    const next = () => {
      if (i >= list.length) { show('·', { ms: 300 }); return; }
      show(list[i].p, { ms: Math.min(220, stepMs * 0.6), quiet: true });
      if (window.Fonetica && Fonetica.highlightPhone) Fonetica.highlightPhone(list[i].wi, list[i].pi);
      i++; seqTimer = setTimeout(next, stepMs);
    };
    next();
  }

  // Sigue la reproducción: reparte los sonidos de cada palabra dentro de su duración
  function follow(t, track, words) {
    if (!track || !words || t == null) return;
    const w = track.words || null;
    if (!w) return;
    const wi = w.findIndex(x => t >= x.ini && t <= x.fin);
    if (wi < 0) { show('·', { ms: 160, quiet: true }); return; }
    const ph = words[wi] ? words[wi].ph : [];
    if (!ph.length) return;
    const k = Math.min(ph.length - 1, Math.floor((t - w[wi].ini) / Math.max(0.01, w[wi].fin - w[wi].ini) * ph.length));
    show(ph[k].p, { ms: 90, quiet: true });
    if (window.Fonetica && Fonetica.highlightPhone) Fonetica.highlightPhone(wi, k);
  }

  // Controles
  const lb = document.getElementById('fonador-labels');
  if (lb) lb.addEventListener('click', () => {
    const on = labels.style.display !== 'none' ? false : true;
    labels.style.display = on ? '' : 'none'; lb.setAttribute('aria-pressed', on);
    lb.classList.toggle('bg-pizarra', on); lb.classList.toggle('text-white', on);
  });
  if (lb) { lb.classList.add('bg-pizarra', 'text-white'); }
  const walk = document.getElementById('fonador-walk');
  if (walk) walk.addEventListener('click', () => {
    const words = window.Fonetica && Fonetica.currentPhones ? Fonetica.currentPhones() : [];
    const list = []; words.forEach((w, wi) => w.ph.forEach((x, pi) => list.push({ p: x.p, wi, pi })));
    if (list.length) sequence(list, 650);
  });
  const slow = document.getElementById('fonador-slow');
  if (slow) slow.addEventListener('click', () => {
    stopSeq();
    if (window.entonacion && entonacion.playCurrent) entonacion.playCurrent(0.55);
  });

  render(cur); describe('·');
  window.Fonador = { show, follow, sequence, stop: stopSeq, inventory: PH };
})();

/* Líneas de entonación: extrae la curva de tono (F0) de un audio grabado o subido
   y la dibuja en semitonos respecto al tono medio de cada hablante.
   Todo se calcula en el navegador (algoritmo YIN, de Cheveigné y Kawahara, 2002). */
(function () {
  const canvas = document.getElementById('pitch-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const listEl = document.getElementById('pitch-tracks');
  const emptyEl = document.getElementById('pitch-empty');
  const busyEl = document.getElementById('pitch-busy');
  const recBtn = document.getElementById('pitch-rec');
  const alignEl = document.getElementById('pitch-align');

  const MAX_TRACKS = 3;
  const MAX_SECONDS = 20;
  const REC_SECONDS = 12;
  const FREE_COLORS = ['#FCD34D', '#7DD3FC', '#C4B5FD'];
  const ZONE = {
    1: { name: 'Bucaramanga', color: '#F43F5E' },
    2: { name: 'Vélez / Málaga', color: '#F97316' },
    3: { name: 'Magdalena Medio', color: '#10B981' },
    4: { name: 'Cúcuta / Pamplona', color: '#F59E0B' },
    5: { name: 'Ocaña', color: '#14B8A6' }
  };

  let actx = null;
  const tracks = [];
  let playing = null; // { track, src, t0 }

  const toast = (m) => (typeof showToast === 'function' ? showToast(m) : console.log(m));
  function audioCtx() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  /* ---------- Análisis ---------- */
  const SR = 16000, HOP = 160, WIN = 512, FMIN = 65, FMAX = 500;

  function toMono16k(buf) {
    const n = Math.min(buf.length, Math.floor(buf.sampleRate * MAX_SECONDS));
    const mono = new Float32Array(n);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i] += d[i] / buf.numberOfChannels;
    }
    const ratio = buf.sampleRate / SR;
    const out = new Float32Array(Math.floor(n / ratio));
    const half = Math.max(0, Math.floor(ratio / 2));
    for (let i = 0; i < out.length; i++) {
      const c = Math.floor(i * ratio);
      let s = 0, k = 0;
      for (let j = c - half; j <= c + half; j++) { if (j >= 0 && j < n) { s += mono[j]; k++; } }
      out[i] = k ? s / k : 0;
    }
    return out;
  }

  function yin(x) {
    const tauMin = Math.floor(SR / FMAX), tauMax = Math.ceil(SR / FMIN);
    const frames = Math.max(0, Math.floor((x.length - WIN - tauMax) / HOP));
    const f0 = new Float32Array(frames).fill(NaN);
    const rms = new Float32Array(frames);
    const d = new Float32Array(tauMax + 1);
    for (let f = 0; f < frames; f++) {
      const o = f * HOP;
      let e = 0;
      for (let j = 0; j < WIN; j++) e += x[o + j] * x[o + j];
      rms[f] = Math.sqrt(e / WIN);
    }
    let peak = 0; for (let f = 0; f < frames; f++) peak = Math.max(peak, rms[f]);
    const gate = peak * 0.04;
    for (let f = 0; f < frames; f++) {
      if (rms[f] < gate) continue;
      const o = f * HOP;
      d[0] = 1;
      let run = 0;
      for (let tau = 1; tau <= tauMax; tau++) {
        let s = 0;
        for (let j = 0; j < WIN; j++) { const v = x[o + j] - x[o + j + tau]; s += v * v; }
        run += s;
        d[tau] = run ? s * tau / run : 1;
      }
      let best = -1;
      for (let tau = tauMin; tau < tauMax; tau++) {
        if (d[tau] < 0.15) { while (tau + 1 < tauMax && d[tau + 1] < d[tau]) tau++; best = tau; break; }
      }
      if (best < 0) {
        let m = Infinity;
        for (let tau = tauMin; tau < tauMax; tau++) if (d[tau] < m) { m = d[tau]; best = tau; }
        if (m > 0.3) continue;
      }
      const a = d[best - 1], b = d[best], c = d[best + 1];
      const den = a + c - 2 * b;
      const t = den ? best + (a - c) / (2 * den) : best;
      f0[f] = SR / t;
    }
    return { f0, rms, peak };
  }

  const median = (arr) => { const s = arr.filter(v => !isNaN(v)).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };

  function clean(f0) {
    const n = f0.length, out = Float32Array.from(f0);
    // Corrección de saltos de octava respecto a la mediana local
    for (let i = 0; i < n; i++) {
      if (isNaN(out[i])) continue;
      const m = median(Array.from(f0.subarray(Math.max(0, i - 15), Math.min(n, i + 16))));
      if (out[i] / m > 1.75) out[i] /= 2; else if (out[i] / m < 0.6) out[i] *= 2;
    }
    // Corrección global: el habla rara vez se aleja más de ~10 semitonos del tono medio;
    // lo que se aleja casi una octava suele ser un error de octava (ruido de fondo, música).
    const gm = median(Array.from(out));
    for (let i = 0; i < n; i++) {
      if (isNaN(out[i])) continue;
      let r = 12 * Math.log2(out[i] / gm);
      if (r > 10) { out[i] /= 2; r -= 12; } else if (r < -10) { out[i] *= 2; r += 12; }
      if (Math.abs(r) > 11) out[i] = NaN;
    }
    // Filtro de mediana (5)
    const med = Float32Array.from(out);
    for (let i = 2; i < n - 2; i++) {
      if (isNaN(out[i])) continue;
      const w = [out[i - 2], out[i - 1], out[i], out[i + 1], out[i + 2]].filter(v => !isNaN(v)).sort((a, b) => a - b);
      med[i] = w[w.length >> 1];
    }
    // Quitar tramos sonoros muy cortos (< 70 ms) y rellenar huecos cortos (≤ 40 ms)
    let i = 0;
    while (i < n) {
      if (isNaN(med[i])) { i++; continue; }
      let j = i; while (j < n && !isNaN(med[j])) j++;
      if (j - i < 7) for (let k = i; k < j; k++) med[k] = NaN;
      i = j;
    }
    for (i = 1; i < n; i++) {
      if (!isNaN(med[i]) || isNaN(med[i - 1])) continue;
      let j = i; while (j < n && isNaN(med[j])) j++;
      if (j < n && j - i <= 4) for (let k = i; k < j; k++) med[k] = med[i - 1] + (med[j] - med[i - 1]) * (k - i + 1) / (j - i + 1);
      i = j;
    }
    return med;
  }

  function describe(st) {
    const v = st.filter(x => !isNaN(x)).sort((a, b) => a - b);
    const range = v.length ? v[Math.floor(v.length * 0.95)] - v[Math.floor(v.length * 0.05)] : 0;
    // Último tramo sonoro largo = final de la frase
    let end = st.length - 1; while (end > 0 && isNaN(st[end])) end--;
    let start = end; while (start > 0 && !isNaN(st[start - 1])) start--;
    const seg = Array.from(st.slice(start, end + 1));
    let shape = '—';
    if (seg.length >= 8) {
      const tail = seg.slice(Math.floor(seg.length * 0.4));
      const first = tail[0], last = tail[tail.length - 1];
      const max = Math.max(...tail), iMax = tail.indexOf(max);
      if (max - first > 1.5 && max - last > 2 && iMax > 0 && iMax < tail.length - 1) shape = 'circunfleja (sube y cae)';
      else if (last - first > 2) shape = 'ascendente';
      else if (first - last > 2) shape = 'descendente';
      else shape = 'llana';
    }
    return { range, shape };
  }

  function analyze(buffer) {
    const x = toMono16k(buffer);
    const { f0, rms, peak } = yin(x);
    if (window.__debugPitch) window.__pitchRaw = { f0, rms, peak };
    const hz = clean(f0);
    const voiced = Array.from(hz).filter(v => !isNaN(v));
    if (voiced.length < 15) return null;
    const medHz = median(voiced);
    const st = Array.from(hz, v => (isNaN(v) ? NaN : 12 * Math.log2(v / medHz)));
    let a = 0; while (a < st.length && isNaN(st[a])) a++;
    let b = st.length - 1; while (b > 0 && isNaN(st[b])) b--;
    const env = Array.from(rms, v => v / (peak || 1));
    return { st, env, a, b, medHz, hop: HOP / SR, ...describe(st) };
  }

  /* ---------- Pistas ---------- */
  function nextColor() {
    const used = tracks.map(t => t.color);
    return FREE_COLORS.find(c => !used.includes(c)) || FREE_COLORS[0];
  }

  async function addFromArrayBuffer(arr, name, color, extra) {
    busyEl.classList.remove('hidden');
    try {
      const buf = await audioCtx().decodeAudioData(arr.slice(0));
      await new Promise(r => setTimeout(r, 30));
      const res = analyze(buf);
      if (!res) { toast('No se detectó voz clara en ese audio. Prueba con una frase más cerca del micrófono.'); return; }
      if (buf.duration > MAX_SECONDS) toast(`Solo se analizan los primeros ${MAX_SECONDS} segundos del audio`);
      if (tracks.length >= MAX_TRACKS) removeTrack(tracks[0]);
      const t = { id: Math.random().toString(36).slice(2), name, color: color || nextColor(), buffer: buf, ...res, ...(extra || {}) };
      if (window.Fonetica) { try { t.fon = Fonetica.analyze(buf, res); } catch (e) { console.error(e); } }
      tracks.push(t);
      renderList(); draw();
      if (window.Fonetica && t.fon) Fonetica.select(t, tracks);
    } catch (e) {
      console.error(e);
      toast('No se pudo leer ese archivo de audio');
    } finally {
      busyEl.classList.add('hidden');
    }
  }

  function removeTrack(t) {
    if (playing && playing.track === t) stop();
    const i = tracks.indexOf(t); if (i >= 0) tracks.splice(i, 1);
    renderList(); draw(); if (typeof refreshChips === 'function') refreshChips();
    if (window.Fonetica && Fonetica.current() === t) Fonetica.select(tracks[tracks.length - 1] || null, tracks);
  }

  function renderList() {
    emptyEl.classList.toggle('hidden', tracks.length > 0);
    listEl.innerHTML = '';
    tracks.forEach(t => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-3 bg-pergamino border border-tarjeta-borde rounded-xl p-3';
      row.innerHTML = `
        <span class="w-3 h-8 rounded-full flex-none" style="background:${t.color}"></span>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm text-pizarra truncate"></div>
          <div class="text-[11px] font-mono text-pizarra-light">Rango ${t.range.toFixed(1)} st · Final ${t.shape}</div>
        </div>
        <button type="button" class="pt-eye w-8 h-8 rounded-lg bg-pergamino-dark text-pizarra hover:bg-tarjeta-borde" aria-label="Mostrar u ocultar la línea" title="Mostrar u ocultar la línea"><i class="fa-solid ${t.hidden ? 'fa-eye-slash' : 'fa-eye'} text-xs"></i></button>
        <button type="button" class="pt-play w-8 h-8 rounded-lg bg-verde-rio text-white hover:bg-verde-oscuro" aria-label="Reproducir"><i class="fa-solid fa-play text-xs"></i></button>
        <button type="button" class="pt-del w-8 h-8 rounded-lg bg-pergamino-dark text-pizarra hover:bg-tarjeta-borde" aria-label="Quitar"><i class="fa-solid fa-xmark text-xs"></i></button>`;
      row.querySelector('.truncate').textContent = t.name;
      const playBtn = row.querySelector('.pt-play');
      playBtn.addEventListener('click', () => { if (playing && playing.track === t) stop(); else play(t); });
      row.querySelector('.pt-del').addEventListener('click', () => removeTrack(t));
      row.querySelector('.pt-eye').addEventListener('click', () => { t.hidden = !t.hidden; renderList(); draw(); });
      if (t.hidden) row.style.opacity = '.55';
      t.playBtn = playBtn;
      listEl.appendChild(row);
    });
  }

  function play(t, rate) {
    stop();
    rate = rate || 1;
    const ac = audioCtx();
    const src = ac.createBufferSource();
    src.buffer = t.buffer; src.playbackRate.value = rate; src.connect(ac.destination);
    src.start();
    playing = { track: t, src, t0: ac.currentTime, rate };
    src.onended = () => { if (playing && playing.src === src) stop(); };
    t.playBtn.innerHTML = '<i class="fa-solid fa-stop text-xs"></i>';
    requestAnimationFrame(tick);
  }
  function stop() {
    if (!playing) return;
    try { playing.src.stop(); } catch (e) { /* ya terminó */ }
    if (playing.track.playBtn) playing.track.playBtn.innerHTML = '<i class="fa-solid fa-play text-xs"></i>';
    playing = null; draw();
    if (window.Fonetica && Fonetica.current()) Fonetica.drawCursor(null);
  }
  function tick() {
    if (!playing) return; draw();
    if (window.Fonetica && Fonetica.current() === playing.track) Fonetica.drawCursor((audioCtx().currentTime - playing.t0) * playing.rate);
    requestAnimationFrame(tick);
  }

  /* ---------- Dibujo ---------- */
  let W = 0, H = 0, dpr = 1;
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    draw();
  }

  function draw() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const L = 44, Rm = 14, T = 14, B = 24;
    const pw = W - L - Rm, ph = H - T - B;
    const ST = 12;
    const y = (s) => T + ph / 2 - (Math.max(-ST, Math.min(ST, s)) / ST) * (ph / 2);
    const align = alignEl ? alignEl.checked : true;
    const span = (t) => (t.b - t.a + 1) * t.hop;
    const maxSpan = Math.max(0.5, ...tracks.map(span));
    const x = (t, i) => L + (align ? (i - t.a) / Math.max(1, t.b - t.a) : ((i - t.a) * t.hop) / maxSpan) * pw;

    // Rejilla
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let s = -12; s <= 12; s += 3) {
      ctx.strokeStyle = s === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.07)';
      ctx.setLineDash(s === 0 ? [4, 4] : []);
      ctx.beginPath(); ctx.moveTo(L, y(s)); ctx.lineTo(W - Rm, y(s)); ctx.stroke();
      if (s % 6 === 0) { ctx.fillStyle = 'rgba(226,232,240,0.6)'; ctx.fillText((s > 0 ? '+' : '') + s + ' st', L - 6, y(s)); }
    }
    ctx.setLineDash([]);
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(226,232,240,0.5)';
    ctx.fillText(align ? 'inicio de la frase' : '0 s', L, H - 10);
    ctx.textAlign = 'right';
    ctx.fillText(align ? 'final' : maxSpan.toFixed(1) + ' s', W - Rm, H - 10);

    tracks.forEach(t => {
      if (t.hidden) return;
      // Energía (sombra suave)
      ctx.fillStyle = hexA(t.color, 0.10);
      ctx.beginPath(); ctx.moveTo(x(t, t.a), T + ph);
      for (let i = t.a; i <= t.b; i++) ctx.lineTo(x(t, i), T + ph - Math.sqrt(t.env[i] || 0) * ph * 0.35);
      ctx.lineTo(x(t, t.b), T + ph); ctx.closePath(); ctx.fill();

      // Curva de tono por tramos sonoros
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      [[8, 0.18], [3.2, 1]].forEach(([lw, al]) => {
        ctx.strokeStyle = hexA(t.color, al); ctx.lineWidth = lw;
        ctx.beginPath();
        let pen = false;
        for (let i = t.a; i <= t.b; i++) {
          const v = t.st[i];
          if (isNaN(v)) { pen = false; continue; }
          const px = x(t, i), py = y(v);
          if (!pen) { ctx.moveTo(px, py); pen = true; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
      });
    });

    if (playing) {
      const t = playing.track;
      const el = (audioCtx().currentTime - playing.t0) * playing.rate;
      const i = Math.min(t.b, Math.max(t.a, Math.round(el / t.hop)));
      const px = x(t, i);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px, T); ctx.lineTo(px, T + ph); ctx.stroke();
    }
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ---------- Entradas ---------- */

  /* ---------- Una voz o varias ---------- */
  let mode = 'comparar';
  function setMode(m) {
    mode = m;
    document.querySelectorAll('.pitch-mode').forEach(b => {
      const on = b.dataset.mode === m;
      b.className = 'pitch-mode px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ' + (on ? 'bg-pizarra text-white' : 'text-pizarra hover:bg-tarjeta-borde');
      b.setAttribute('aria-pressed', on);
    });
    if (m === 'una' && tracks.length > 1) {
      const keep = (window.Fonetica && Fonetica.current()) || tracks[tracks.length - 1];
      tracks.slice().forEach(t => { if (t !== keep) removeTrack(t); });
    }
    if (typeof refreshChips === 'function') refreshChips();
  }
  document.querySelectorAll('.pitch-mode').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

  /* ---------- Muestras fijas de la página (data/muestras.js) ---------- */
  const MU = (window.MUESTRAS && window.MUESTRAS.muestras) || [];
  const samplesEl = document.getElementById('pitch-samples');
  const chipFor = {};
  function refreshChips() {
    MU.forEach(m => {
      const b = chipFor[m.id]; if (!b) return;
      const on = tracks.some(t => t.sampleId === m.id);
      b.classList.toggle('ring-2', on); b.classList.toggle('ring-offset-2', on);
      b.style.opacity = on ? '1' : '.82';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  async function loadSample(m) {
    const existing = tracks.find(t => t.sampleId === m.id);
    if (existing) { existing.hidden = false; renderList(); draw(); if (window.Fonetica) Fonetica.select(existing, tracks); return; }
    if (mode === 'una') tracks.slice().forEach(t => removeTrack(t));
    const z = ZONE[m.zona];
    const r = await fetch(m.archivo);
    if (!r.ok) { toast('No se pudo cargar la muestra ' + m.id); return; }
    // dos muestras de la misma subzona: la segunda con un tono más claro para distinguirlas
    const sameZone = tracks.filter(t => t.zone === m.zona).length;
    await addFromArrayBuffer(await r.arrayBuffer(), `${m.id} · ${m.lugar}`, sameZone ? lighten(z.color) : z.color, {
      sampleId: m.id, zone: m.zona, transcript: m.texto, words: m.palabras, notes: m.notas, source: m.fuente, dialect: m.dialecto
    });
    refreshChips();
  }
  function lighten(hex) {
    const n = parseInt(hex.slice(1), 16), f = (c) => Math.round(c + (255 - c) * 0.45);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join('');
  }
  if (samplesEl) {
    MU.forEach(m => {
      const z = ZONE[m.zona];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pitch-sample text-left px-3 py-2 rounded-xl text-white shadow-sm transition-all hover:opacity-100 ring-white';
      b.style.background = z.color; b.style.opacity = '.82';
      b.style.setProperty('--tw-ring-color', z.color);
      const frag = m.texto.split(/[,.;!?]/).map(x => x.trim()).filter(x => x.split(' ').length >= 2)[0] || m.texto;
      b.innerHTML = `<span class="block font-mono text-[11px] font-bold">${m.id} · ${m.lugar}</span><span class="block text-xs leading-tight max-w-[220px] truncate">«${frag}»</span>`;
      b.addEventListener('click', () => {
        const t = tracks.find(t => t.sampleId === m.id);
        if (t && window.Fonetica && Fonetica.current() === t) { removeTrack(t); refreshChips(); }
        else loadSample(m);
      });
      chipFor[m.id] = b;
      samplesEl.appendChild(b);
    });
  }
  setMode('comparar');
  // Al llegar al laboratorio se cargan dos muestras contrastadas: interior (1a) y Ocaña (5a)
  let autoLoaded = false;
  const labIO = new IntersectionObserver(async (ents) => {
    if (autoLoaded || !ents.some(e => e.isIntersecting)) return;
    autoLoaded = true; labIO.disconnect();
    for (const id of ['5a', '1a']) { const m = MU.find(x => x.id === id); if (m) await loadSample(m); }
  }, { rootMargin: '200px 0px' });
  labIO.observe(canvas);
  window.cargarMuestra = (id) => { const m = MU.find(x => x.id === id); if (m) return loadSample(m); };

  let rec = null;
  recBtn.addEventListener('click', async () => {
    if (rec) { rec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Este navegador no permite grabar audio'); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) { toast('No hay permiso para usar el micrófono'); return; }
    audioCtx();
    const chunks = [];
    const mr = new MediaRecorder(stream);
    rec = mr;
    let secs = 0;
    const label = recBtn.querySelector('span');
    label.textContent = 'Detener (0 s)';
    recBtn.classList.add('animate-pulse');
    const timer = setInterval(() => {
      secs++; label.textContent = `Detener (${secs} s)`;
      if (secs >= REC_SECONDS && mr.state === 'recording') mr.stop();
    }, 1000);
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      clearInterval(timer); rec = null;
      stream.getTracks().forEach(t => t.stop());
      label.textContent = 'Grabar mi voz'; recBtn.classList.remove('animate-pulse');
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
      const n = tracks.filter(t => t.name.startsWith('Mi voz')).length + 1;
      await addFromArrayBuffer(await blob.arrayBuffer(), n > 1 ? `Mi voz ${n}` : 'Mi voz');
    };
    mr.start();
  });

  if (alignEl) alignEl.addEventListener('change', draw);
  window.addEventListener('resize', resize);
  resize(); renderList();

  // Para pruebas y depuración
  window.entonacion = { analyze, tracks, addFromArrayBuffer, playCurrent: (rate) => { const t = window.Fonetica && Fonetica.current(); if (t) play(t, rate); }, loadSample: (id) => window.cargarMuestra(id) };
})();

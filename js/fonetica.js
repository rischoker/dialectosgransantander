/* Análisis fonético acústico para "Líneas de entonación".
   - Espectrograma (FFT) y segmentación por modo de articulación (vocal, sonorante,
     fricativa sibilante, fricativa no sibilante, oclusiva, pausa).
   - Formantes F1/F2 por LPC para estimar la vocal y ubicarla en el trapecio vocálico.
   - Transcripción fonética (AFI) a partir del texto, con reglas del español de Colombia.
   Todo es una estimación acústica automática: sirve para mostrar y discutir, no reemplaza
   el análisis de un fonetista con Praat. */
(function () {
  /* ======================= Utilidades numéricas ======================= */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }

  function decimate(buf, target) {
    const sr = buf.sampleRate, n = Math.min(buf.length, Math.floor(sr * 20));
    const mono = new Float32Array(n);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i] += d[i] / buf.numberOfChannels;
    }
    const k = Math.max(1, Math.round(sr / target));
    const out = new Float32Array(Math.floor(n / k));
    for (let i = 0; i < out.length; i++) { let s = 0; for (let j = 0; j < k; j++) s += mono[i * k + j]; out[i] = s / k; }
    return { x: out, sr: sr / k };
  }

  // LPC (autocorrelación + Levinson-Durbin) y raíces (Durand-Kerner) -> formantes
  function lpcFormants(seg, sr, order) {
    const n = seg.length, x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = (seg[i] - (i ? 0.97 * seg[i - 1] : 0)) * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1)));
    const r = new Float64Array(order + 1);
    for (let l = 0; l <= order; l++) { let s = 0; for (let i = l; i < n; i++) s += x[i] * x[i - l]; r[l] = s; }
    if (r[0] <= 0) return null;
    r[0] *= 1.0001;
    let a = new Float64Array(order + 1); a[0] = 1; let e = r[0];
    for (let i = 1; i <= order; i++) {
      let acc = r[i]; for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
      const k = -acc / e; const na = Float64Array.from(a);
      for (let j = 1; j < i; j++) na[j] = a[j] + k * a[i - j];
      na[i] = k; a = na; e *= 1 - k * k; if (e <= 0) return null;
    }
    // raíces de z^p + a1 z^(p-1) + ... + ap
    const p = order; let zr = [], zi = [];
    for (let i = 0; i < p; i++) { const ang = 2 * Math.PI * i / p + 0.4; zr.push(0.9 * Math.cos(ang)); zi.push(0.9 * Math.sin(ang)); }
    for (let it = 0; it < 120; it++) {
      let delta = 0;
      for (let i = 0; i < p; i++) {
        // evaluar polinomio
        let pr = 1, pi = 0;
        for (let j = 1; j <= p; j++) { const t = pr * zr[i] - pi * zi[i] + a[j]; pi = pr * zi[i] + pi * zr[i]; pr = t; }
        let dr = 1, di = 0;
        for (let j = 0; j < p; j++) if (j !== i) { const ar = zr[i] - zr[j], ai = zi[i] - zi[j]; const t = dr * ar - di * ai; di = dr * ai + di * ar; dr = t; }
        const den = dr * dr + di * di || 1e-12;
        const qr = (pr * dr + pi * di) / den, qi = (pi * dr - pr * di) / den;
        zr[i] -= qr; zi[i] -= qi; delta += Math.abs(qr) + Math.abs(qi);
      }
      if (delta < 1e-9) break;
    }
    const f = [];
    for (let i = 0; i < p; i++) {
      if (zi[i] <= 0) continue;
      const mag = Math.hypot(zr[i], zi[i]);
      const freq = Math.atan2(zi[i], zr[i]) * sr / (2 * Math.PI);
      const bw = -Math.log(mag) * sr / Math.PI;
      if (freq > 180 && freq < sr / 2 - 100 && bw < 600) f.push(freq);
    }
    f.sort((u, v) => u - v);
    return f.length >= 2 ? f : null;
  }

  const median = (arr) => { const s = arr.filter(v => isFinite(v)).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };

  /* ======================= Clases y descripciones ======================= */
  const CLASSES = {
    vocal: { label: 'Vocal', color: '#F59E0B', short: 'V',
      desc: 'Sonido sonoro con el tracto abierto. La energía se concentra por debajo de 3 kHz en bandas llamadas formantes (F1 y F2), que indican qué vocal es.' },
    sonorante: { label: 'Consonante sonorante', color: '#A78BFA', short: 'N/L',
      desc: 'Sonoro pero más débil que una vocal: nasales [m n ɲ], laterales [l], vibrantes [ɾ r] o aproximantes [β ð ɣ].', ipa: ['m', 'n', 'l', 'ɾ', 'β', 'ð', 'ɣ'] },
    sibilante: { label: 'Fricativa sibilante', color: '#22D3EE', short: 'S',
      desc: 'Fricción turbulenta y aguda: el aire choca contra los dientes. La energía se concentra por encima de 4 kHz. Es la [s] alveolar plena del interior andino.', ipa: ['s', 'z'] },
    fricativa: { label: 'Fricativa no sibilante', color: '#34D399', short: 'F',
      desc: 'Fricción sin el silbido de la [s]: energía media (1–4 kHz) o difusa. Puede ser la velar [x] de «gente», la aspiración glotal [h] de la /s/ caribeña o la labiodental [f].', ipa: ['x', 'h', 'f'] },
    fricsonora: { label: 'Fricativa sonora', color: '#2DD4BF', short: 'Ʒ',
      desc: 'Vibran las cuerdas vocales y a la vez hay fricción aguda, como la palatal [ʝ] de «yo / llamar» o la [z] de «mismo».', ipa: ['ʝ', 'z'] },
    oclusiva: { label: 'Oclusiva / africada', color: '#F43F5E', short: 'P',
      desc: 'Cierre total de la boca (silencio breve) seguido de una explosión de aire: [p t k] sordas, [b d g] sonoras, o la africada [tʃ] de «chamo», que empieza como oclusiva y termina en fricción.', ipa: ['p', 't', 'k', 'tʃ'] },
    pausa: { label: 'Pausa / silencio', color: '#475569', short: '·',
      desc: 'Sin energía de habla: pausa, respiración o cierre largo.' }
  };

  const VOWELS = [
    { v: 'i', f1: 290, f2: 2300, name: 'anterior cerrada no redondeada' },
    { v: 'e', f1: 460, f2: 1950, name: 'anterior media no redondeada' },
    { v: 'a', f1: 720, f2: 1350, name: 'central abierta' },
    { v: 'o', f1: 480, f2: 950, name: 'posterior media redondeada' },
    { v: 'u', f1: 320, f2: 800, name: 'posterior cerrada redondeada' }
  ];

  /* ======================= Análisis acústico ======================= */
  function analyze(buffer, pitch) {
    const { x, sr } = decimate(buffer, 22050);
    const N = 512, hop = Math.round(sr * 0.01), frames = Math.max(0, Math.floor((x.length - N) / hop));
    const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    const bins = N / 2, hzPerBin = sr / N;
    const spec = [];           // dB por frame (para el espectrograma, hasta ~10 kHz)
    const maxBin = Math.min(bins, Math.floor(10000 / hzPerBin));
    const Ehi = new Float32Array(frames), Emid = new Float32Array(frames), hp = new Float32Array(frames);
    const E = new Float32Array(frames), hi = new Float32Array(frames), mid = new Float32Array(frames), cen = new Float32Array(frames);
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let f = 0; f < frames; f++) {
      const o = f * hop;
      for (let i = 0; i < N; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
      fft(re, im);
      const row = new Float32Array(maxBin);
      let tot = 0, h = 0, m = 0, c = 0, best = -1, bestHz = 0;
      for (let k = 1; k < maxBin; k++) {
        const pw = re[k] * re[k] + im[k] * im[k];
        row[k] = 10 * Math.log10(pw + 1e-12);
        const hz = k * hzPerBin;
        if (hz < 80) continue;
        tot += pw; c += pw * hz;
        if (hz >= 3800) h += pw; else if (hz >= 1000) m += pw;
        if (hz >= 2500 && pw > best) { best = pw; bestHz = hz; }
      }
      spec.push(row);
      E[f] = 10 * Math.log10(tot + 1e-12);
      hp[f] = bestHz; Ehi[f] = 10 * Math.log10(h + 1e-12); Emid[f] = 10 * Math.log10(m + 1e-12);
      hi[f] = tot ? h / tot : 0; mid[f] = tot ? m / tot : 0; cen[f] = tot ? c / tot : 0;
    }
    // Umbral de habla relativo al ruido de fondo
    const sortedE = Array.from(E).sort((a, b) => a - b);
    const floor = sortedE[Math.floor(frames * 0.1)] ?? -100, peak = sortedE[Math.floor(frames * 0.98)] ?? 0;
    const thr = Math.max(floor + 6, peak - 38);

    // Sonoridad a partir de la curva de tono (YIN, saltos de 10 ms a 16 kHz)
    const voiced = (f) => {
      if (!pitch || !pitch.st) return false;
      const t = (f * hop + N / 2) / sr;
      const i = Math.round((t * 16000 - 256) / 160);
      for (let d = -1; d <= 1; d++) { const v = pitch.st[i + d]; if (v !== undefined && !isNaN(v)) return true; }
      return false;
    };
    const vE = []; for (let f = 0; f < frames; f++) if (E[f] > thr && voiced(f)) vE.push(E[f]);
    vE.sort((a, b) => a - b);
    const vowelLevel = vE.length ? vE[Math.floor(vE.length * 0.85)] : peak;

    // La /s/ se busca en la banda aguda: con ruido de fondo (mercado, calle) puede quedar
    // por debajo del umbral global, pero sobresale claramente por encima de 3,8 kHz.
    const sHi = Array.from(Ehi).sort((a, b) => a - b);
    const hiFloor = sHi[Math.floor(frames * 0.2)] ?? -100;
    const D = Array.from(Ehi, (v, i) => v - Emid[i]);
    const sD = D.slice().sort((a, b) => a - b);
    const dThr = Math.min(-4, sD[Math.floor(frames * 0.9)] ?? 0);
    let lab = new Array(frames);
    for (let f = 0; f < frames; f++) {
      if ((!voiced(f) || D[f] > -3) && Ehi[f] > hiFloor + 6 && (D[f] > dThr || (hi[f] > 0.45 && cen[f] > 3800))) { lab[f] = 'sibilante'; continue; }
      if (E[f] < thr) { lab[f] = 'pausa'; continue; }
      if (voiced(f)) {
        if (hi[f] > 0.4) lab[f] = 'fricsonora';
        else lab[f] = E[f] > vowelLevel - 11 ? 'vocal' : 'sonorante';
      } else {
        const low = 1 - hi[f] - mid[f];
        if (hi[f] > 0.45 && cen[f] > 3800) lab[f] = 'sibilante';
        // Mucha energía grave sin tono detectado: casi siempre es voz (vocal/sonorante) que YIN no siguió
        else if (low > 0.6) lab[f] = E[f] > vowelLevel - 11 ? 'vocal' : 'sonorante';
        else lab[f] = 'fricativa';
      }
    }
    // Explosiones: subida brusca tras un cierre (silencio o energía baja)
    for (let f = 2; f < frames - 1; f++) {
      if (lab[f] === 'pausa' || lab[f] === 'vocal') continue;
      if (E[f] - Math.min(E[f - 1], E[f - 2]) > 9 && (lab[f - 1] === 'pausa' || E[f - 1] < thr + 3)) lab[f] = 'burst';
    }
    // Suavizado por moda (5)
    const sm = lab.slice();
    for (let f = 2; f < frames - 2; f++) {
      if (lab[f] === 'burst') continue;
      const cnt = {}; for (let d = -2; d <= 2; d++) { const l = lab[f + d] === 'burst' ? lab[f] : lab[f + d]; cnt[l] = (cnt[l] || 0) + 1; }
      sm[f] = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    }
    lab = sm;

    // Segmentos
    let segs = [];
    for (let f = 0; f < frames;) {
      let g = f; while (g < frames && lab[g] === lab[f]) g++;
      segs.push({ cls: lab[f], a: f, b: g });
      f = g;
    }
    // Oclusiva = cierre corto (≤ 180 ms) + explosión
    const merged = [];
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (s.cls === 'burst') {
        const prev = merged[merged.length - 1];
        if (prev && prev.cls === 'pausa' && prev.b - prev.a <= 18 && merged.length > 1) { prev.cls = 'oclusiva'; prev.b = s.b; }
        else merged.push({ cls: 'oclusiva', a: s.a, b: s.b });
        // la explosión puede continuar con fricción (aspiración de la oclusiva)
        const nx = segs[i + 1];
        if (nx && (nx.cls === 'fricativa') && nx.b - nx.a <= 3) { merged[merged.length - 1].b = nx.b; i++; }
      } else merged.push({ ...s });
    }
    // Absorber segmentos muy cortos (< 30 ms) en el vecino más largo
    segs = merged;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (s.b - s.a >= 3 || s.cls === 'oclusiva') continue;
        const L = segs[i - 1], R = segs[i + 1];
        const tgt = !L ? R : !R ? L : (L.b - L.a >= R.b - R.a ? L : R);
        if (!tgt) continue;
        if (tgt === L) L.b = s.b; else R.a = s.a;
        segs.splice(i, 1); i--;
      }
      const out = [];
      segs.forEach(s => { const p = out[out.length - 1]; if (p && p.cls === s.cls) p.b = s.b; else out.push(s); });
      segs = out;
    }
    // Una fricción aguda muy breve justo después de un silencio es la explosión de una
    // oclusiva [k t] o el inicio de una africada [tʃ], no una /s/.
    segs.forEach((sg, i) => {
      const prev = segs[i - 1];
      if (sg.cls === 'sibilante' && (sg.b - sg.a) <= 4 && prev && (prev.cls === 'pausa' || prev.cls === 'oclusiva')) sg.cls = 'oclusiva';
    });
    { const out = []; segs.forEach(sg => { const p = out[out.length - 1]; if (p && p.cls === sg.cls) p.b = sg.b; else out.push(sg); }); segs = out; }
    // Medidas por segmento
    const hopS = hop / sr;
    segs.forEach(s => {
      s.t0 = s.a * hopS; s.t1 = s.b * hopS; s.ms = Math.round((s.b - s.a) * hopS * 1000);
      let c = 0, k = 0, h = 0; const pk = [];
      for (let f = s.a; f < s.b; f++) { c += cen[f]; h += hi[f]; k++; pk.push(hp[f]); }
      s.centroid = k ? c / k : 0; s.hiFrac = k ? h / k : 0; s.peakHz = median(pk);
    });

    // Formantes de las vocales (LPC a ~11 kHz)
    const lp = decimate(buffer, 11025);
    const f0Hz = pitch && pitch.medHz ? pitch.medHz : 150;
    const scale = f0Hz > 170 ? 1.15 : 1;
    segs.filter(s => s.cls === 'vocal' && s.ms >= 40).forEach(s => {
      const F1 = [], F2 = [];
      const L = Math.round(lp.sr * 0.025);
      for (let t = s.t0 + 0.01; t + 0.025 <= s.t1; t += 0.01) {
        const o = Math.round(t * lp.sr);
        if (o + L > lp.x.length) break;
        const fm = lpcFormants(lp.x.subarray(o, o + L), lp.sr, 12);
        if (fm && fm[0] < 1100 && fm[1] > fm[0] + 200 && fm[1] < 3200) { F1.push(fm[0]); F2.push(fm[1]); }
      }
      if (F1.length >= 2) {
        s.f1 = median(F1); s.f2 = median(F2);
        let best = null, bd = Infinity;
        VOWELS.forEach(v => {
          const d = Math.hypot(Math.log(s.f1 / (v.f1 * scale)) * 1.4, Math.log(s.f2 / (v.f2 * scale)));
          if (d < bd) { bd = d; best = v; }
        });
        s.vowel = best; s.vowelDist = bd;
      }
    });

    // Perfil
    const speech = segs.filter(s => s.cls !== 'pausa' || s.ms < 150).reduce((a, s) => a + (s.t1 - s.t0), 0);
    const nuclei = segs.filter(s => s.cls === 'vocal' && s.ms >= 40).length;
    const sib = segs.filter(s => s.cls === 'sibilante');
    const fric = segs.filter(s => s.cls === 'fricativa');
    return {
      spec, maxBin, hzPerBin, hopS, segs, duration: frames * hopS, scale,
      profile: {
        rate: speech > 0 ? nuclei / speech : 0, nuclei, speech,
        sib: sib.length, fric: fric.length,
        sibCentroid: sib.length ? median(sib.map(s => s.peakHz)) : NaN
      }
    };
  }

  /* ======================= Transcripción (AFI) ======================= */
  const IPA = {
    p: ['Oclusiva', 'bilabial', 'sorda'], b: ['Oclusiva', 'bilabial', 'sonora'], β: ['Aproximante', 'bilabial', 'sonora'],
    t: ['Oclusiva', 'dental', 'sorda'], d: ['Oclusiva', 'dental', 'sonora'], ð: ['Aproximante', 'interdental', 'sonora'],
    k: ['Oclusiva', 'velar', 'sorda'], g: ['Oclusiva', 'velar', 'sonora'], ɣ: ['Aproximante', 'velar', 'sonora'],
    f: ['Fricativa', 'labiodental', 'sorda'], s: ['Fricativa sibilante', 'alveolar', 'sorda'], z: ['Fricativa sibilante', 'alveolar', 'sonora'],
    θ: ['Fricativa', 'interdental', 'sorda'], x: ['Fricativa', 'velar', 'sorda'], h: ['Fricativa (aspiración)', 'glotal', 'sorda'],
    ʝ: ['Fricativa', 'palatal', 'sonora'], tʃ: ['Africada', 'postalveolar', 'sorda'],
    m: ['Nasal', 'bilabial', 'sonora'], n: ['Nasal', 'alveolar', 'sonora'], ɲ: ['Nasal', 'palatal', 'sonora'], ŋ: ['Nasal', 'velar', 'sonora'],
    l: ['Lateral', 'alveolar', 'sonora'], ɾ: ['Vibrante simple', 'alveolar', 'sonora'], r: ['Vibrante múltiple', 'alveolar', 'sonora'],
    j: ['Aproximante (semivocal)', 'palatal', 'sonora'], w: ['Aproximante (semivocal)', 'labiovelar', 'sonora'],
    a: ['Vocal', 'central abierta', 'no redondeada'], e: ['Vocal', 'anterior media', 'no redondeada'], i: ['Vocal', 'anterior cerrada', 'no redondeada'],
    o: ['Vocal', 'posterior media', 'redondeada'], u: ['Vocal', 'posterior cerrada', 'redondeada'], 'Ø': ['Elisión', 'el sonido se pierde', '—']
  };
  const MANNER_COLOR = (ipa) => {
    const m = (IPA[ipa] || ['?'])[0];
    if (m === 'Vocal') return CLASSES.vocal.color;
    if (m.startsWith('Fricativa sibilante')) return CLASSES.sibilante.color;
    if (m.startsWith('Fricativa') || m === 'Africada') return CLASSES.fricativa.color;
    if (m === 'Oclusiva') return CLASSES.oclusiva.color;
    if (m === 'Elisión') return '#94A3B8';
    return CLASSES.sonorante.color;
  };

  function g2p(text, opts) {
    const VOW = 'aeiouáéíóúü';
    const isV = (c) => c && VOW.includes(c);
    const words = text.toLowerCase().replace(/[¿?¡!.,;:«»"“”()]/g, ' ').replace(/['’]/g, '').split(/\s+/).filter(Boolean);
    const out = [];
    words.forEach((w, wi) => {
      if (opts.dElision) w = w.replace(/([aeiou])d([oa]s?)$/, '$1$2');
      const ph = [];
      for (let i = 0; i < w.length; i++) {
        const c = w[i], n = w[i + 1];
        const stressed = 'áéíóú'.includes(c);
        const base = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' }[c] || c;
        if (c === 'c' && n === 'h') { ph.push('tʃ'); i++; continue; }
        if (c === 'l' && n === 'l') { ph.push('ʝ'); i++; continue; }
        if (c === 'r' && n === 'r') { ph.push('r'); i++; continue; }
        if (c === 'q' && n === 'u') { ph.push('k'); i++; continue; }
        if (c === 'g' && n === 'u' && 'eiéí'.includes(w[i + 2] || '')) { ph.push('g'); i++; continue; }
        if (c === 'g' && n === 'ü') { ph.push('g', 'w'); i++; continue; }
        if (c === 'c') { ph.push('eiéí'.includes(n || '') ? 's' : 'k'); continue; }
        if (c === 'g') { ph.push('eiéí'.includes(n || '') ? 'x' : 'g'); continue; }
        if (c === 'z') { ph.push('s'); continue; }
        if (c === 'j') { ph.push('x'); continue; }
        if (c === 'h') continue;
        if (c === 'ñ') { ph.push('ɲ'); continue; }
        if (c === 'v') { ph.push('b'); continue; }
        if (c === 'x') { ph.push('k', 's'); continue; }
        if (c === 'w') { ph.push('w'); continue; }
        if (c === 'y') { ph.push(!n || !isV(n) ? 'i' : 'ʝ'); continue; }
        if (c === 'r') { ph.push(i === 0 || 'nls'.includes(w[i - 1]) ? 'r' : 'ɾ'); continue; }
        if ((base === 'i' || base === 'u') && !stressed && c !== 'ü' && (isV(w[i - 1]) || isV(n))) { ph.push(base === 'i' ? 'j' : 'w'); continue; }
        ph.push(base);
      }
      out.push({ word: words[wi], ph });
    });
    // Procesos en la cadena (cruzan palabras)
    const flat = []; out.forEach((w, wi) => w.ph.forEach((p, pi) => flat.push({ p, wi, first: pi === 0 })));
    const vowelSet = new Set(['a', 'e', 'i', 'o', 'u']);
    const voicedC = new Set(['b', 'd', 'g', 'm', 'n', 'l', 'ɾ', 'r', 'ʝ', 'β', 'ð', 'ɣ']);
    for (let i = 0; i < flat.length; i++) {
      const cur = flat[i], prev = flat[i - 1], next = flat[i + 1];
      if (cur.p === 'n' && next) { if ('pbm'.includes(next.p)) cur.p = 'm'; else if ('kgx'.includes(next.p)) cur.p = 'ŋ'; }
      if ('bdg'.includes(cur.p) && cur.p.length === 1 && prev && !['m', 'n', 'ŋ'].includes(prev.p) && !(cur.p === 'd' && prev.p === 'l')) {
        cur.p = { b: 'β', d: 'ð', g: 'ɣ' }[cur.p];
      }
      if (cur.p === 's') {
        const implosive = !next || !vowelSet.has(next.p) && !['j', 'w'].includes(next.p);
        if (opts.aspirate && implosive) cur.p = next ? 'h' : 'h';
        else if (next && voicedC.has(next.p)) cur.p = 'z';
        cur.implosive = implosive;
      }
    }
    // reconstruir por palabra
    const res = out.map(w => ({ word: w.word, ph: [] }));
    flat.forEach(f => res[f.wi].ph.push({ p: f.p, implosive: !!f.implosive }));
    return res;
  }

  /* ======================= Interfaz ======================= */
  const panel = document.getElementById('fon-panel');
  if (!panel) return;
  const specCanvas = document.getElementById('fon-spec');
  const vowCanvas = document.getElementById('fon-vowels');
  const info = document.getElementById('fon-info');
  const prof = document.getElementById('fon-profile');
  const legend = document.getElementById('fon-legend');
  const chipsEl = document.getElementById('fon-track-chips');
  const txt = document.getElementById('fon-text');
  const dial = document.getElementById('fon-dialect');
  const dEl = document.getElementById('fon-delision');
  const ipaEl = document.getElementById('fon-ipa');
  const cmpEl = document.getElementById('fon-compare');
  let current = null, selSeg = null, selWord = null, specImg = null;

  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  function buildSpecImage(res) {
    const cols = res.spec.length, rows = res.maxBin;
    const c = document.createElement('canvas'); c.width = Math.max(1, cols); c.height = rows;
    const g = c.getContext('2d'); const img = g.createImageData(cols, rows);
    let mx = -Infinity; res.spec.forEach(r => { for (let k = 1; k < rows; k++) if (r[k] > mx) mx = r[k]; });
    const lo = mx - 70;
    for (let x = 0; x < cols; x++) {
      const r = res.spec[x];
      for (let k = 0; k < rows; k++) {
        const v = Math.max(0, Math.min(1, (r[k] - lo) / 70));
        // paleta: verde oscuro -> ocre -> crema
        const t = Math.pow(v, 1.6);
        const R = 43 + t * (250 - 43), G = 30 + t * (215 - 30) * (0.6 + 0.4 * t), B = 22 + t * (130 - 22) * (1 - t * 0.5);
        const idx = ((rows - 1 - k) * cols + x) * 4;
        img.data[idx] = R; img.data[idx + 1] = G; img.data[idx + 2] = B; img.data[idx + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  let W = 0, H = 0, dpr = 1;
  const STRIP = 30, AX = 34, BOT = 18;
  function drawSpec(cursorT) {
    if (!current) return;
    const r = specCanvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (Math.round(r.width * dpr) !== specCanvas.width || Math.round(r.height * dpr) !== specCanvas.height) {
      specCanvas.width = Math.round(r.width * dpr); specCanvas.height = Math.round(r.height * dpr);
    }
    W = r.width; H = r.height;
    const g = specCanvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const res = current.fon, pw = W - AX - 8, sh = H - STRIP - BOT - 6;
    g.imageSmoothingEnabled = true;
    g.drawImage(specImg, AX, 0, pw, sh);
    // eje de frecuencias
    g.font = '10px "JetBrains Mono", monospace'; g.fillStyle = 'rgba(226,232,240,.65)'; g.textAlign = 'right'; g.textBaseline = 'middle';
    const maxHz = res.maxBin * res.hzPerBin;
    [0, 2000, 4000, 6000, 8000].forEach(hz => { if (hz > maxHz) return; const y = sh - hz / maxHz * sh; g.fillText(hz / 1000 + 'k', AX - 4, Math.min(sh - 6, Math.max(6, y))); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(AX, y, pw, 1); g.fillStyle = 'rgba(226,232,240,.65)'; });
    // formantes de vocales
    res.segs.forEach(s => {
      if (!s.f1) return;
      const x0 = AX + s.t0 / res.duration * pw, x1 = AX + s.t1 / res.duration * pw;
      [s.f1, s.f2].forEach(f => { const y = sh - f / maxHz * sh; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); });
    });
    // tira de segmentos
    const y0 = sh + 6;
    res.segs.forEach(s => {
      const x0 = AX + s.t0 / res.duration * pw, x1 = AX + s.t1 / res.duration * pw;
      const C = CLASSES[s.cls];
      g.fillStyle = s === selSeg ? C.color : hexA(C.color, s.cls === 'pausa' ? 0.35 : 0.75);
      g.fillRect(x0 + 0.5, y0, Math.max(1, x1 - x0 - 1), STRIP);
      if (x1 - x0 > 16) {
        g.fillStyle = '#0B1513'; g.textAlign = 'center'; g.font = '700 11px "JetBrains Mono", monospace';
        const lbl = s.vowel ? s.vowel.v : (C.ipa && C.ipa.length <= 2 ? C.ipa.join('/') : C.short);
        g.fillText(s.cls === 'pausa' ? '' : (x1 - x0 > 26 ? lbl : C.short), (x0 + x1) / 2, y0 + STRIP / 2 + 1);
      }
      if (s === selSeg) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, STRIP - 2); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x0, 0, x1 - x0, sh); }
    });
    // palabras (si la muestra trae transcripción con tiempos)
    if (current.words) {
      g.fillStyle = 'rgba(11,21,19,.72)'; g.fillRect(AX, 0, pw, 22);
      g.font = '600 10.5px "Plus Jakarta Sans", sans-serif'; g.textBaseline = 'middle';
      current.words.forEach((w, wi) => {
        const x0 = AX + w.ini / res.duration * pw, x1 = AX + w.fin / res.duration * pw;
        const nx = current.words[wi + 1], lim = nx ? AX + nx.ini / res.duration * pw : W;
        const sel = w === selWord;
        g.fillStyle = sel ? 'rgba(184,74,39,.9)' : 'rgba(255,255,255,.08)';
        g.fillRect(x0, 2, Math.max(2, x1 - x0), 18);
        g.save(); g.beginPath(); g.rect(x0, 0, Math.max(2, lim - x0 - 2), 22); g.clip();
        g.fillStyle = sel ? '#fff' : '#FCD34D'; g.textAlign = 'left'; g.fillText(w.w, x0 + 2, 11);
        g.restore();
      });
    }
    g.textAlign = 'left'; g.fillStyle = 'rgba(226,232,240,.55)'; g.font = '10px "JetBrains Mono", monospace'; g.textBaseline = 'middle';
    g.fillText('0 s', AX, H - 7); g.textAlign = 'right'; g.fillText(res.duration.toFixed(1) + ' s', W - 8, H - 7);
    if (cursorT != null) { const x = AX + cursorT / res.duration * pw; g.fillStyle = '#fff'; g.fillRect(x, 0, 1.5, sh + STRIP + 6); }
  }

  function drawVowels() {
    if (!current) return;
    const r = vowCanvas.getBoundingClientRect(); const d = Math.min(window.devicePixelRatio || 1, 2);
    vowCanvas.width = Math.round(r.width * d); vowCanvas.height = Math.round(r.height * d);
    const g = vowCanvas.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
    const w = r.width, h = r.height, P = 22, sc = current.fon.scale;
    const F2min = 600 * sc, F2max = 2600 * sc, F1min = 200 * sc, F1max = 950 * sc;
    const X = (f2) => P + (1 - Math.log(f2 / F2min) / Math.log(F2max / F2min)) * (w - 2 * P);
    const Y = (f1) => P + Math.log(f1 / F1min) / Math.log(F1max / F1min) * (h - 2 * P);
    g.clearRect(0, 0, w, h);
    // trapecio
    g.strokeStyle = 'rgba(28,37,38,.25)'; g.lineWidth = 1.5; g.beginPath();
    g.moveTo(X(2500 * sc), Y(250 * sc)); g.lineTo(X(700 * sc), Y(250 * sc)); g.lineTo(X(1000 * sc), Y(850 * sc)); g.lineTo(X(1700 * sc), Y(850 * sc)); g.closePath(); g.stroke();
    g.font = '700 14px Fraunces, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    VOWELS.forEach(v => { g.fillStyle = 'rgba(28,37,38,.18)'; g.beginPath(); g.arc(X(v.f2 * sc), Y(v.f1 * sc), 16, 0, 7); g.fill(); g.fillStyle = '#2E2119'; g.fillText(v.v, X(v.f2 * sc), Y(v.f1 * sc)); });
    current.fon.segs.forEach(s => {
      if (!s.f1) return;
      const x = Math.max(P, Math.min(w - P, X(s.f2))), y = Math.max(P, Math.min(h - P, Y(s.f1)));
      g.fillStyle = s === selSeg ? '#B5532A' : 'rgba(217,119,6,.75)'; g.beginPath(); g.arc(x, y, s === selSeg ? 6 : 4, 0, 7); g.fill();
      if (s === selSeg) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
    });
    g.font = '10px "JetBrains Mono", monospace'; g.fillStyle = 'rgba(84,96,98,.9)';
    g.textAlign = 'left'; g.fillText('anterior', P, h - 6); g.textAlign = 'right'; g.fillText('posterior', w - P, h - 6);
    g.save(); g.translate(9, h / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('cerrada → abierta', 0, 0); g.restore();
  }

  function showSeg(s) {
    selSeg = s; drawSpec(); drawVowels();
    if (!s) { info.innerHTML = '<p class="text-xs text-pizarra-light">Toca un segmento de color debajo del espectrograma para ver qué tipo de sonido es.</p>'; return; }
    const C = CLASSES[s.cls];
    let head = C.label, ipa = C.ipa ? C.ipa.map(p => `[${p}]`).join(' ') : '';
    let extra = '';
    if (s.cls === 'vocal' && s.vowel) {
      head = `Vocal ${s.vowel.name}`; ipa = `[${s.vowel.v}]`;
      extra = `<div class="mt-2 font-mono text-[11px] text-pizarra-light">F1 ≈ ${Math.round(s.f1)} Hz · F2 ≈ ${Math.round(s.f2)} Hz ${s.vowelDist > 0.45 ? '· lectura dudosa' : ''}</div>`;
    }
    const ev = `${s.ms} ms · ${s.cls === 'pausa' ? 'sin voz' : (['vocal', 'sonorante', 'fricsonora'].includes(s.cls) ? 'sonora (vibran las cuerdas vocales)' : 'sorda')}${s.cls === 'sibilante' || s.cls === 'fricativa' || s.cls === 'oclusiva' ? ` · pico de fricción ≈ ${(s.peakHz / 1000).toFixed(1)} kHz` : s.cls !== 'pausa' ? ` · energía centrada en ${(s.centroid / 1000).toFixed(1)} kHz` : ''}`;
    info.innerHTML = `
      <div class="flex items-center gap-2 mb-1"><span class="w-3 h-3 rounded-full" style="background:${C.color}"></span>
        <strong class="font-serif text-base text-pizarra">${head}</strong>${ipa ? `<span class="font-mono text-sm text-terracota font-bold">${ipa}</span>` : ''}</div>
      <p class="text-xs text-pizarra-light leading-relaxed">${s.cls === 'vocal' && s.vowel ? CLASSES.vocal.desc : C.desc}</p>
      <div class="mt-2 font-mono text-[11px] text-pizarra">${ev}</div>${extra}`;
  }

  function showWord(w) {
    selWord = w; selSeg = null; drawSpec(); drawVowels();
    const ph = g2p(w.w, { aspirate: dial.value === 'caribe', dElision: dEl.checked })[0].ph;
    if (window.Fonador) { const wi = current.words.indexOf(w); Fonador.sequence(ph.map((x, pi) => ({ p: x.p, wi, pi })), 520); }
    info.innerHTML = `
      <div class="flex items-baseline gap-2 mb-2"><strong class="font-serif text-lg text-pizarra">«${w.w}»</strong>
        <span class="font-mono text-sm text-terracota font-bold">[${ph.map(x => x.p).join('')}]</span>
        <span class="text-[11px] font-mono text-pizarra-light">${Math.round((w.fin - w.ini) * 1000)} ms</span></div>
      <ul class="space-y-1">${ph.map(x => { const d = IPA[x.p] || ['—', '—', '—']; return `<li class="text-xs text-pizarra"><span class="inline-block w-8 font-mono font-bold" style="color:${MANNER_COLOR(x.p)}">[${x.p}]</span>${d[0]} ${d[1]} ${d[2]}</li>`; }).join('')}</ul>`;
  }

  function renderProfile() {
    const P = current.fon.profile, t = current;
    const rateTxt = P.rate ? P.rate.toFixed(1) : '—';
    prof.innerHTML = [
      ['Velocidad', `${rateTxt} síl/s`, P.rate > 6.5 ? 'rápida' : P.rate < 4.5 ? 'pausada' : 'media'],
      ['Rango melódico', `${t.range.toFixed(1)} st`, t.range > 8 ? 'muy marcado' : t.range > 5 ? 'marcado' : 'suave'],
      ['Final de frase', t.shape, 'contorno'],
      ['Fricción sibilante', `${P.sib} [s]`, P.sib ? `≈ ${(P.sibCentroid / 1000).toFixed(1)} kHz` : 'no detectada'],
      ['Fricción posterior', `${P.fric}`, '[x] [h] [f]'],
      ['Tono medio', `${Math.round(t.medHz)} Hz`, 'del hablante']
    ].map(([k, v, s]) => `<div class="bg-pergamino border border-tarjeta-borde rounded-xl p-3"><div class="text-[10px] font-mono uppercase tracking-wider text-pizarra-light">${k}</div><div class="font-serif font-bold text-lg text-pizarra leading-tight">${v}</div><div class="text-[11px] text-pizarra-light">${s}</div></div>`).join('');
    legend.innerHTML = Object.entries(CLASSES).map(([k, C]) => {
      const n = current.fon.segs.filter(s => s.cls === k).length;
      return `<span class="inline-flex items-center gap-1.5 text-[11px] font-mono text-pizarra"><span class="w-2.5 h-2.5 rounded-sm" style="background:${C.color}"></span>${C.label}${k !== 'pausa' ? ` (${n})` : ''}</span>`;
    }).join('');
  }

  function renderIPA() {
    const text = txt.value.trim();
    if (!text) { ipaEl.innerHTML = '<p class="text-xs text-pizarra-light">Escribe lo que dice el audio para ver su transcripción fonética.</p>'; cmpEl.textContent = ''; return; }
    const words = g2p(text, { aspirate: dial.value === 'caribe', dElision: dEl.checked });
    ipaEl.innerHTML = words.map((w, wi) => `
      <span class="inline-flex flex-col items-center mr-2 mb-2">
        <span class="inline-flex">${w.ph.map((x, pi) => `<button type="button" data-wi="${wi}" data-pi="${pi}" class="fon-ph font-mono text-base font-bold px-1 rounded hover:bg-pergamino-dark" style="color:${MANNER_COLOR(x.p)};text-shadow:0 0 0 #2E2119" data-p="${x.p}">${x.p}</button>`).join('')}</span>
        <span class="text-[10px] text-pizarra-light">${w.word}</span>
      </span>`).join('');
    ipaEl.querySelectorAll('.fon-ph').forEach(b => b.addEventListener('click', () => {
      const d = IPA[b.dataset.p] || ['—', '—', '—'];
      document.getElementById('fon-ph-card').innerHTML = `<strong class="font-mono text-terracota text-lg mr-2">[${b.dataset.p}]</strong><span class="text-sm text-pizarra"><b>${d[0]}</b> · ${d[1]} · ${d[2]}</span>`;
      if (window.Fonador) { Fonador.stop(); Fonador.show(b.dataset.p, { force: true }); }
      highlightPhone(+b.dataset.wi, +b.dataset.pi);
    }));
    // Cada /s/ del texto frente a lo que se oye (si la muestra trae tiempos por palabra)
    if (current && current.words) {
      const sib = current.fon.segs.filter(x => x.cls === 'sibilante');
      const items = current.words.map(w => {
        const ph = g2p(w.w, { aspirate: false, dElision: false })[0];
        if (!ph || !ph.ph.some(x => x.p === 's' || x.p === 'z')) return null;
        const hit = sib.some(x => x.t1 > w.ini - 0.08 && x.t0 < w.fin + 0.05);
        return `<span class="inline-flex items-center gap-1 mr-1.5 mb-1.5 px-2 py-0.5 rounded-full border text-[11px] ${hit ? 'border-cyan-400 bg-cyan-50 text-pizarra' : 'border-tarjeta-borde bg-pergamino text-pizarra-light'}">
          <b>${w.w}</b> ${hit ? '[s] con silbido claro' : 'sin silbido claro'}</span>`;
      }).filter(Boolean);
      cmpEl.innerHTML = items.length ? `<div class="text-xs text-pizarra mb-1.5"><i class="fa-solid fa-magnifying-glass-chart text-terracota mr-1"></i><b>Las /s/ de esta muestra:</b> <span class="text-pizarra-light">«sin silbido claro» puede ser una /s/ aspirada [h], perdida, o tapada por el ruido de fondo; escúchala para decidir.</span></div><div class="flex flex-wrap">${items.join('')}</div>` : '';
    } else if (current) {
      cmpEl.innerHTML = `<i class="fa-solid fa-magnifying-glass-chart text-terracota mr-1"></i> En este audio hay <b>${current.fon.profile.sib}</b> tramos con fricción sibilante clara [s].`;
    } else cmpEl.textContent = '';
  }

  function renderChips(list) {
    chipsEl.innerHTML = '';
    list.forEach(t => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold border transition-all ' + (t === current ? 'text-white border-transparent' : 'bg-white text-pizarra border-tarjeta-borde');
      if (t === current) b.style.background = '#4E6B3A';
      b.innerHTML = `<span class="inline-block w-2 h-2 rounded-full mr-1.5" style="background:${t.color}"></span>${t.name.replace(/</g, '&lt;')}`;
      b.addEventListener('click', () => select(t, list));
      chipsEl.appendChild(b);
    });
  }

  function select(t, list) {
    current = t;
    if (!t) { info.innerHTML = ''; return; }
    specImg = buildSpecImage(t.fon);
    txt.value = t.transcript || '';
    selWord = null;
    const src = document.getElementById('fon-source');
    if (src) src.innerHTML = (t.source ? `<i class="fa-solid fa-circle-info mr-1"></i>${t.source} ` : '') + (t.notes || []).map(n => `<span class="block">${n}</span>`).join('') + (t.words ? '<span class="block">Toca una palabra (franja superior del espectrograma) para ver sus sonidos.</span>' : '');
    if (t.dialect) dial.value = t.dialect;
    renderChips(list); renderProfile(); renderIPA();
    showSeg(t.fon.segs.find(s => s.cls === 'sibilante') || t.fon.segs.find(s => s.vowel) || null);
  }

  specCanvas.addEventListener('click', (e) => {
    if (!current) return;
    const r = specCanvas.getBoundingClientRect(); const x = e.clientX - r.left;
    const t = (x - AX) / (r.width - AX - 8) * current.fon.duration;
    const y = e.clientY - r.top;
    if (current.words && y < 24) {
      const w = current.words.find(w => t >= w.ini - 0.02 && t <= w.fin + 0.02);
      if (w) { showWord(w); return; }
    }
    const s = current.fon.segs.find(s => t >= s.t0 && t < s.t1);
    if (s) { selWord = null; showSeg(s); }
  });
  [txt].forEach(el => el.addEventListener('input', () => { if (current) { current.transcript = txt.value; current.userEdited = true; } renderIPA(); }));
  dial.addEventListener('change', () => { if (current) current.dialect = dial.value; renderIPA(); });
  dEl.addEventListener('change', renderIPA);
  window.addEventListener('resize', () => { if (current) { drawSpec(); drawVowels(); } });
  renderIPA();

  function highlightPhone(wi, pi) {
    ipaEl.querySelectorAll('.fon-ph.fon-on').forEach(b => { b.classList.remove('fon-on'); b.style.background = ''; });
    const b = ipaEl.querySelector(`.fon-ph[data-wi="${wi}"][data-pi="${pi}"]`);
    if (b) { b.classList.add('fon-on'); b.style.background = '#FDE68A'; }
  }
  const opts = () => ({ aspirate: dial.value === 'caribe', dElision: dEl.checked });
  function currentPhones() { return txt.value.trim() ? g2p(txt.value, opts()) : []; }
  function drawCursor(t) {
    drawSpec(t);
    if (window.Fonador && current && current.words) {
      if (t == null) { Fonador.show('·', { ms: 200, quiet: true }); highlightPhone(-1, -1); return; }
      if (!current._wordPh || current._wordPhKey !== JSON.stringify(opts())) {
        current._wordPh = current.words.map(w => g2p(w.w, opts())[0] || { ph: [] });
        current._wordPhKey = JSON.stringify(opts());
      }
      Fonador.follow(t, current, current._wordPh);
    }
  }
  window.Fonetica = { analyze, select, g2p, drawCursor, current: () => current, currentPhones, highlightPhone };
})();

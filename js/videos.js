/* Reproductor audiovisual: videos de cada subzona alojados en la página, con la
   transcripción sincronizada y enlace directo al análisis fonético de cada frase. */
(function () {
  const V = (window.MUESTRAS && window.MUESTRAS.videos) || {};
  const frame = document.getElementById('video-player-frame');
  // Las transcripciones viven en las tarjetas de diálogo de la izquierda (una por subzona)
  const listFor = (z) => document.querySelector(`.vtx[data-zone="${z}"] .vtx-list`);
  const src = document.getElementById('video-source');
  if (!frame) return;
  const COLORS = { 1: '#F43F5E', 2: '#F97316', 3: '#10B981', 4: '#F59E0B', 5: '#14B8A6' };
  let video = null, cueEls = [], current = 1;

  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function tabs(id) {
    for (let i = 1; i <= 5; i++) {
      const b = document.getElementById('vidtab-' + i);
      if (!b) continue;
      const on = i === id;
      b.className = 'vid-tab px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ' + (on ? 'text-white font-bold shadow-sm' : 'bg-white/10 text-slate-300 hover:bg-white/20');
      b.style.background = on ? COLORS[i] : '';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function analyze(id) {
    const lab = document.getElementById('entonacion');
    if (lab) lab.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.cargarMuestra) setTimeout(() => window.cargarMuestra(id), 350);
  }

  let filled = false;
  function fillTranscripts() {
    if (filled) return;
    Object.keys(V).forEach(z => {
      const lst = listFor(z); if (!lst) return;
      filled = true;
      const d = V[z];
      lst.innerHTML = d.cues.map((c, i) => `
        <div class="vid-cue flex items-start gap-2 rounded-lg px-2 py-1 cursor-pointer transition-colors hover:bg-white/10" data-i="${i}">
          <span class="font-mono text-[10px] text-slate-500 pt-0.5 w-8 flex-none">${Math.floor(c.ini / 60)}:${String(Math.floor(c.ini % 60)).padStart(2, '0')}</span>
          <span class="flex-1 text-[13px] text-slate-300 leading-snug">${esc(c.t)}</span>
          ${c.muestra ? `<button type="button" class="vid-an flex-none text-[10px] font-mono font-bold px-2 py-0.5 rounded-md text-white" style="background:${COLORS[z]}" data-m="${c.muestra}" title="Ver el análisis fonético de esta frase">Analizar ${c.muestra}</button>` : ''}
        </div>`).join('') + (d.parcial ? '<p class="text-[10px] font-mono text-slate-500 px-2 pt-1">La transcripción cubre solo una parte del video.</p>' : '');
      lst.querySelectorAll('.vid-cue').forEach(el => el.addEventListener('click', (e) => {
        const btn = e.target.closest('.vid-an');
        if (btn) { e.stopPropagation(); analyze(btn.dataset.m); return; }
        const c = d.cues[+el.dataset.i];
        if (current !== +z || !video) load(+z);
        const go = () => { video.currentTime = c.ini + 0.01; video.play().catch(() => {}); };
        if (video.readyState >= 1) go(); else video.addEventListener('loadedmetadata', go, { once: true });
        const box = frame.closest('.lg\\:col-span-5') || frame;
        if (box.getBoundingClientRect().top < 0 || box.getBoundingClientRect().bottom > innerHeight) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }));
    });
  }

  function load(id) {
    current = id; tabs(id); stopAt = null;
    if (video) { video.pause(); video = null; }
    const d = V[id];
    if (!d) {
      const sub = (typeof subzonesData !== 'undefined' ? subzonesData : {})[id];
      frame.innerHTML = `
        <div class="aspect-video flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-verde-oscuro via-black to-slate-900">
          <i class="fa-solid fa-video-slash text-2xl text-slate-500 mb-3"></i>
          <h4 class="font-serif font-bold text-white text-base mb-1">Aún no hay video de la subzona ${id}</h4>
          <p class="text-[11px] text-slate-300 max-w-xs mb-4">Mientras tanto puedes escuchar el diálogo de ejemplo con la voz del navegador.</p>
          <button onclick="speakSubzoneSpeech(${id})" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold flex items-center gap-1.5">
            <i class="fa-solid fa-volume-high"></i><span>Escuchar el diálogo (voz sintética)</span></button>
        </div>`;
      src.textContent = sub ? sub.title : '';
      return;
    }
    frame.innerHTML = `
      <video playsinline controls preload="metadata" poster="videos/subzona-${id}-frag.jpg" class="block w-full h-[62vh] min-h-[340px] max-h-[760px] bg-black object-contain">
        <source src="${d.src}" type="video/mp4">
      </video>
      <div class="vid-sub pointer-events-none absolute left-3 right-3 bottom-14 text-center"><span class="hidden"></span></div>`;
    video = frame.querySelector('video');
    const sub = frame.querySelector('.vid-sub span');
    // Videos horizontales: altura según su proporción (sin franjas negras); verticales: alto fijo
    video.addEventListener('loadedmetadata', () => {
      if (video.videoWidth > video.videoHeight) { video.style.height = 'auto'; video.style.minHeight = '0'; video.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`; }
    }, { once: true });

    fillTranscripts();
    document.querySelectorAll('.vid-cue').forEach(el => { el.style.background = ''; const t = el.querySelector('.flex-1'); if (t) t.classList.remove('text-white'); });
    cueEls = listFor(id) ? Array.from(listFor(id).querySelectorAll('.vid-cue')) : [];
    let last = -1;
    video.addEventListener('timeupdate', () => {
      const t = video.currentTime;
      const i = d.cues.findIndex(c => t >= c.ini - 0.05 && t <= c.fin + 0.25);
      if (i === last) return;
      last = i;
      cueEls.forEach((el, k) => {
        el.style.background = k === i ? 'rgba(255,255,255,0.12)' : '';
        el.querySelector('.flex-1').classList.toggle('text-white', k === i);
      });
      if (i >= 0) {
        sub.textContent = d.cues[i].t;
        sub.className = 'inline-block bg-black/75 text-white text-sm sm:text-base font-semibold px-3 py-1 rounded-lg';
        const el = cueEls[i], lst = listFor(id);
        if (lst) {
          const det = lst.closest('details'); if (det && !det.open) det.open = true;
          lst.scrollTo({ top: el.offsetTop - lst.offsetTop - 30, behavior: 'smooth' });
        }
      } else sub.className = 'hidden';
    });
    src.innerHTML = `<i class="fa-solid fa-circle-info mr-1"></i>Fuente: ${esc(d.fuente)} Transcripción automática.`;
  }

  // Reproduce solo el fragmento de la frase de muestra de la subzona y se detiene al final
  let stopAt = null;
  function playFragment(id) {
    const m = ((window.MUESTRAS && window.MUESTRAS.muestras) || []).find(x => x.zona === id);
    if (!m || !V[id]) { load(id); return; }
    if (current !== id || !video) load(id);
    const box = frame.closest('.lg\\:col-span-5') || frame;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const start = () => {
      stopAt = m.video.fin + 0.15;
      video.currentTime = Math.max(0, m.video.ini - 0.1);
      video.play().catch(() => {});
      showBadge(`Fragmento ${m.id} · ${m.lugar}`);
    };
    if (video.readyState >= 1) start(); else video.addEventListener('loadedmetadata', start, { once: true });
  }
  function showBadge(text) {
    let b = frame.querySelector('.vid-frag');
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.className = 'vid-frag absolute top-2 left-2 bg-terracota text-white font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-lg';
      b.addEventListener('click', () => { stopAt = null; b.remove(); video.play(); });
      frame.appendChild(b);
    }
    b.innerHTML = `<i class="fa-solid fa-scissors mr-1"></i>${text}`;
    b.title = 'Seguir viendo el video completo';
  }
  frame.addEventListener('timeupdate', () => {
    if (stopAt != null && video && video.currentTime >= stopAt) {
      video.pause(); stopAt = null;
      const b = frame.querySelector('.vid-frag');
      if (b) b.innerHTML = '<i class="fa-solid fa-play mr-1"></i>Seguir viendo el video completo';
    }
  }, true);
  frame.addEventListener('seeking', () => {
    if (stopAt != null && video && (video.currentTime < stopAt - 30 || video.currentTime > stopAt + 1)) stopAt = null;
  }, true);

  window.loadVideoSubzone = load;
  window.playVideoFragment = playFragment;
})();

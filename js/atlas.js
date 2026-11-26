/* Atlas: globo que se acerca al Gran Santander.
   Requiere d3 (geo), topojson-client y data/geo-santander.js (window.GEO_SANTANDER). */
(function () {
  const stage = document.getElementById('atlas-stage');
  const canvas = document.getElementById('atlas-canvas');
  const pinsLayer = document.getElementById('atlas-pins');
  const caption = document.getElementById('atlas-caption');
  if (!stage || !canvas) return;

  if (!window.d3 || !window.topojson || !window.GEO_SANTANDER) {
    const fb = document.getElementById('atlas-fallback');
    if (fb) fb.classList.remove('hidden');
    return;
  }

  const G = window.GEO_SANTANDER;
  const world = topojson.feature(G.world, G.world.objects.countries);
  // Países que tienen versión detallada (se ven de cerca): en la vista lejana se usa la versión simple
  const near = G.near || G.ven;
  const DET = new Set(near.features.map(f => f.properties.name).concat(['Colombia']));
  const isDet = (g) => DET.has(g.properties && g.properties.name);
  const worldRest = { type: 'FeatureCollection', features: world.features.filter(f => !isDet(f)) };
  const worldDet = { type: 'FeatureCollection', features: world.features.filter(f => isDet(f) && f.properties.name !== 'Colombia') };
  const borders = topojson.mesh(G.world, G.world.objects.countries, (a, b) => a !== b && !isDet(a) && !isDet(b));
  const bordersDet = topojson.mesh(G.world, G.world.objects.countries, (a, b) => a !== b && (isDet(a) || isDet(b)));
  const colombia110 = world.features.find(f => f.properties.name === 'Colombia');
  const dptos = G.dptos.features;
  const santanderes = dptos.filter(f => f.properties.name === 'SANTANDER' || f.properties.name === 'NORTE DE SANTANDER');
  const graticule = d3.geoGraticule10();
  const sphere = { type: 'Sphere' };

  // Colores tomados de la paleta de la página
  const C = {
    ocean: '#2F5C73', oceanDeep: '#1B3A4B', oceanEdge: 'rgba(190,220,230,0.35)', land: '#EADBC0', landStroke: '#BFA37E',
    colombia: '#F1D5AE', dptoStroke: '#B98E63', santander: '#B5532A', norte: '#D4923A',
    ink: '#2E2119', inkSoft: '#3E4A4B', grat: 'rgba(255,255,255,0.07)'
  };

  // Subzonas (coordenadas aproximadas de las cabeceras; colores iguales a los de la página)
  const ZONES = [
    { id: 1, name: 'Bucaramanga', sub: 'Núcleo Central', lon: -73.122, lat: 7.119, color: '#F43F5E' },
    { id: 2, name: 'Vélez', sub: 'Sur Andino', lon: -73.673, lat: 6.010, color: '#F97316' },
    { id: 2, name: 'Málaga', sub: 'Sur Andino', lon: -72.733, lat: 6.699, color: '#F97316', minor: true },
    { id: 3, name: 'Barrancabermeja', sub: 'Magdalena Medio', lon: -73.854, lat: 7.065, color: '#10B981', left: true },
    { id: 4, name: 'Cúcuta', sub: 'Frontera', lon: -72.508, lat: 7.894, color: '#F59E0B' },
    { id: 4, name: 'Pamplona', sub: 'Frontera', lon: -72.648, lat: 7.376, color: '#F59E0B', minor: true },
    { id: 5, name: 'Ocaña', sub: 'Provincia de Ocaña', lon: -73.356, lat: 8.237, color: '#14B8A6' }
  ];

  const LABELS = [
    { t: 'SANTANDER', lon: -73.45, lat: 6.45, big: true },
    { t: 'NORTE DE SANTANDER', lon: -72.85, lat: 8.95, big: true },
    { t: 'BOYACÁ', lon: -72.9, lat: 5.6 },
    { t: 'CESAR', lon: -73.75, lat: 9.35 },
    { t: 'ANTIOQUIA', lon: -74.75, lat: 6.6 },
    { t: 'BOLÍVAR', lon: -74.35, lat: 8.25 },
    { t: 'VENEZUELA', lon: -71.6, lat: 8.3 }
  ];

  const STEPS = [
    { lon: -60, lat: 8, zoom: 1, caption: '<strong>El planeta.</strong> El español es la lengua materna de casi 500 millones de personas.' },
    { lon: -73.8, lat: 4.4, zoom: 5.6, caption: '<strong>Colombia.</strong> Los Santanderes ocupan el nororiente, sobre la cordillera Oriental.' },
    { lon: -73.2, lat: 7.45, zoom: 22, caption: '<strong>Santander y Norte de Santander.</strong> Entre el valle del Magdalena (oeste) y la frontera con Venezuela (este).' },
    { lon: -73.15, lat: 7.15, zoom: 30, caption: '<strong>Las 5 subzonas.</strong> Toca un punto para ver su ficha.' }
  ];

  const ctx = canvas.getContext('2d');
  const proj = d3.geoOrthographic().clipAngle(90).precision(0.3);
  const path = d3.geoPath(proj, ctx);

  let W = 0, H = 0, R = 0, dpr = 1;
  const cam = { lon: STEPS[0].lon, lat: STEPS[0].lat, zoom: 1 };
  let step = 0, anim = null, spinning = true, lastT = 0, dragging = null;
  // El viaje del globo es el centro de la sección: se anima aunque Windows tenga desactivados
  // los "efectos de animación" (prefers-reduced-motion), que de otro modo lo hacía saltar de golpe.
  const reduceMotion = false;

  function resize() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; R = Math.min(W, H) * 0.44;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    draw();
  }

  function detail() { return Math.max(0, Math.min(1, (cam.zoom - 2.2) / 2)); }   // aparecen departamentos
  function closeUp() { return Math.max(0, Math.min(1, (cam.zoom - 14) / 7)); }    // etiquetas y ciudades

  function draw() {
    if (!W) return;
    proj.translate([W / 2, H / 2]).scale(R * cam.zoom).rotate([-cam.lon, -cam.lat]);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Halo de atmósfera (solo con el globo completo a la vista)
    const rr = R * cam.zoom;
    if (cam.zoom < 1.6) {
      const halo = ctx.createRadialGradient(W / 2, H / 2, rr * 0.96, W / 2, H / 2, rr * 1.16);
      halo.addColorStop(0, 'rgba(170,205,218,0.38)'); halo.addColorStop(1, 'rgba(170,205,218,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(W / 2, H / 2, rr * 1.16, 0, 7); ctx.fill();
    }
    // Océano con luz lateral
    ctx.beginPath(); path(sphere);
    const g = ctx.createRadialGradient(W / 2 - rr * 0.35, H / 2 - rr * 0.4, rr * 0.05, W / 2, H / 2, rr);
    g.addColorStop(0, '#4A7E92'); g.addColorStop(0.7, C.ocean); g.addColorStop(1, C.oceanDeep);
    ctx.fillStyle = cam.zoom < 3 ? g : C.ocean; ctx.fill();

    ctx.beginPath(); path(graticule); ctx.strokeStyle = C.grat; ctx.lineWidth = 0.6; ctx.stroke();

    const d = detail();
    // Países (110m)
    ctx.beginPath(); path(worldRest); ctx.fillStyle = C.land; ctx.fill();
    ctx.beginPath(); path(borders); ctx.strokeStyle = C.landStroke; ctx.lineWidth = 0.7; ctx.stroke();
    if (d < 1) {
      ctx.globalAlpha = 1 - d;
      ctx.beginPath(); path(worldDet); ctx.fillStyle = C.land; ctx.fill();
      ctx.beginPath(); path(bordersDet); ctx.strokeStyle = C.landStroke; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Colombia resaltada (vista global)
    if (d < 1) {
      ctx.globalAlpha = 1 - d;
      ctx.save(); ctx.shadowColor = 'rgba(217,119,6,0.9)'; ctx.shadowBlur = 14;
      ctx.beginPath(); path(colombia110); ctx.fillStyle = C.santander; ctx.fill(); ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Detalle: Venezuela y departamentos
    if (d > 0) {
      ctx.globalAlpha = d;
      near.features.forEach(f => { ctx.beginPath(); path(f); ctx.fillStyle = C.land; ctx.fill(); ctx.strokeStyle = C.landStroke; ctx.lineWidth = 0.8; ctx.stroke(); });
      dptos.forEach(f => {
        ctx.beginPath(); path(f);
        const n = f.properties.name;
        ctx.fillStyle = n === 'SANTANDER' ? C.santander : n === 'NORTE DE SANTANDER' ? C.norte : C.colombia;
        ctx.fill();
        ctx.strokeStyle = C.dptoStroke; ctx.lineWidth = 0.7; ctx.stroke();
      });
      ctx.save(); ctx.shadowColor = 'rgba(184,74,39,0.65)'; ctx.shadowBlur = 18;
      ctx.beginPath(); santanderes.forEach(f => path(f));
      ctx.strokeStyle = '#FFF8EE'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Borde del globo
    ctx.beginPath(); path(sphere); ctx.strokeStyle = C.oceanEdge; ctx.lineWidth = 1.2; ctx.stroke();

    // Etiquetas
    const cu = closeUp();
    if (cu > 0) {
      ctx.globalAlpha = cu;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      LABELS.forEach(l => {
        const p = proj([l.lon, l.lat]); if (!p) return;
        ctx.font = (l.big ? '700 ' : '600 ') + (l.big ? 13 : 11) + 'px "JetBrains Mono", monospace';
        ctx.lineWidth = 3; ctx.strokeStyle = l.big ? 'rgba(28,37,38,0.35)' : 'rgba(243,238,228,0.9)';
        ctx.fillStyle = l.big ? '#FFF8EE' : C.inkSoft;
        try { ctx.letterSpacing = '1.5px'; } catch (e) { /* navegadores antiguos */ }
        ctx.strokeText(l.t, p[0], p[1]); ctx.fillText(l.t, p[0], p[1]);
      });
      ctx.globalAlpha = 1;
    }
    placePins(cu);
  }

  // Pines HTML (clicables y accesibles)
  const pinEls = ZONES.map(z => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'atlas-pin' + (z.minor ? ' minor' : '') + (z.left ? ' left' : '');
    b.style.setProperty('--c', z.color);
    b.setAttribute('aria-label', `Subzona ${z.id}: ${z.name} (${z.sub}). Abrir ficha`);
    b.innerHTML = `<span class="dot">${z.minor ? '' : z.id}</span><span class="lbl">${z.name}</span>`;
    b.addEventListener('click', () => {
      if (typeof selectSubzone === 'function') selectSubzone(z.id);
      const target = document.getElementById('subzonas');
      if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    pinsLayer.appendChild(b);
    return b;
  });

  function placePins(alpha) {
    const show = alpha > 0.05;
    ZONES.forEach((z, i) => {
      const el = pinEls[i];
      const p = show ? proj([z.lon, z.lat]) : null;
      if (!p) { el.style.opacity = 0; el.style.pointerEvents = 'none'; el.tabIndex = -1; return; }
      el.style.transform = `translate(${p[0]}px, ${p[1]}px)`;
      el.style.opacity = alpha;
      el.style.pointerEvents = alpha > 0.6 ? 'auto' : 'none';
      el.tabIndex = alpha > 0.6 ? 0 : -1;
    });
  }

  function setCaption(i) { if (caption) caption.innerHTML = STEPS[i].caption; }

  function markStep(i) {
    document.querySelectorAll('.atlas-step').forEach(b => {
      const on = +b.dataset.step === i;
      b.classList.toggle('active', on);
      b.setAttribute('aria-current', on ? 'step' : 'false');
    });
    setCaption(i);
  }

  function goTo(i, opts = {}) {
    step = i; markStep(i);
    spinning = i === 0;
    const from = { lon: cam.lon, lat: cam.lat, zoom: cam.zoom };
    const narrow = W < 560 && i >= 2;
    const to = narrow ? { ...STEPS[i], zoom: STEPS[i].zoom * 0.8, lon: STEPS[i].lon - 0.2 } : STEPS[i];
    const rot = d3.geoInterpolate([from.lon, from.lat], [to.lon, to.lat]);
    const dur = reduceMotion ? 0 : (opts.duration || 2200);
    if (anim) anim.stop();
    if (!dur) { cam.lon = to.lon; cam.lat = to.lat; cam.zoom = to.zoom; draw(); return Promise.resolve(); }
    return new Promise(res => {
      anim = d3.timer(el => {
        const t = Math.min(1, el / dur);
        const e = d3.easeCubicInOut(t);
        const r = rot(e);
        cam.lon = r[0]; cam.lat = r[1];
        cam.zoom = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * e);
        draw();
        if (t >= 1) { anim.stop(); anim = null; res(); }
      });
    });
  }

  let tourId = 0;
  async function tour() {
    const my = ++tourId;
    cam.lon = 10; cam.lat = 15; cam.zoom = 1; markStep(0); spinning = false;
    await goTo(0, { duration: 1600 });
    for (const i of [1, 2, 3]) {
      if (my !== tourId) return;
      await new Promise(r => setTimeout(r, i === 1 ? 900 : 1300));
      if (my !== tourId) return;
      await goTo(i, { duration: i === 1 ? 2600 : 2000 });
    }
  }

  // Giro automático suave en la vista del planeta
  d3.timer(t => {
    const dt = t - lastT; lastT = t;
    if (spinning && !dragging && !anim && !reduceMotion && step === 0) {
      cam.lon += dt * 0.006; draw();
    }
  });

  // Arrastrar para girar (solo en vista del planeta)
  canvas.addEventListener('pointerdown', e => {
    if (step !== 0 || anim) return;
    tourId++; dragging = { x: e.clientX, y: e.clientY, lon: cam.lon, lat: cam.lat };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const k = 90 / R;
    cam.lon = dragging.lon - (e.clientX - dragging.x) * k;
    cam.lat = Math.max(-70, Math.min(70, dragging.lat + (e.clientY - dragging.y) * k));
    draw();
  });
  const endDrag = () => { dragging = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  document.querySelectorAll('.atlas-step').forEach(b => {
    b.addEventListener('click', () => { tourId++; goTo(+b.dataset.step); });
  });
  const replay = document.getElementById('atlas-replay');
  if (replay) replay.addEventListener('click', () => tour());

  window.addEventListener('resize', resize);
  resize(); markStep(0);

  // El viaje arranca solo la primera vez que el atlas entra en pantalla
  let started = false;
  const io = new IntersectionObserver(entries => {
    if (!started && entries.some(en => en.isIntersecting)) { started = true; tour(); io.disconnect(); }
  }, { threshold: 0.45 });
  io.observe(stage);

  window.atlasGoTo = goTo; // útil para depurar
})();

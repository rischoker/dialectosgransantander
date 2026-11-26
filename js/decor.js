/* Detalles visuales: íconos propios de cada unidad y marcas de agua ilustradas
   (mapa de los Santanderes, bocadillo veleño, hormiga culona, tiple, cañón, sombrero, arepa, campanario). */
(function () {
  const S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const MAP_ICON = ["M19.8,14.6L18.9,14.6L17.6,15.7L17,15.4L15.6,14.8L14.7,13.9L14.8,12.5L13.9,11L12.4,10.8L11.6,11.4L10.6,11.1L9.8,10.1L10.8,10.5L11.6,9.8L11.5,8.3L10.3,4.6L10.9,3.7L11.5,1L12.7,1L15.3,1.5L16,4.6L17.7,6.3L17.9,8.2L17.1,8.8L17.1,11.7L17.4,12.3L18.9,12.4Z", "M9.8,10.1L10.6,11.1L11.6,11.4L12.4,10.8L13.9,11L14.8,12.5L14.7,13.9L15.6,14.8L17,15.4L17.1,17L16.7,18.1L16,18.4L15.4,19.7L14.1,20.8L11.6,22.2L11.5,21.2L10.7,20.5L9.3,22.6L8.4,23L6.4,21.8L5.7,20.7L4.6,20.6L4.2,19.5L5,18.3L4.9,17.5L6.8,16.3L8.2,14.9L8,13L8.8,10.7L8.3,8L8.9,7.6Z"];
  const MAP_BIG = ["M247.9,182.6L235.9,182.3L220.6,195.8L211.9,192.9L194.6,185.2L183.9,173.4L185.2,156.8L173.2,138.1L155.5,135.3L144.7,142.3L132.8,138.2L122.7,126L134.7,131.7L145,122.3L143.8,104.1L129.1,57.6L136.1,46.5L143.6,12.3L158.8,12L191.2,18.2L199.9,56.9L220.9,78.1L224.3,102.9L213.2,110.3L213.8,146L218.1,153.6L236,154.8Z", "M122.7,126L132.8,138.2L144.7,142.3L155.5,135.3L173.2,138.1L185.2,156.8L183.9,173.4L194.6,185.2L211.9,192.9L213.3,212.9L209,226.3L199.5,229.8L192.9,246.4L176.3,259.8L145.5,277.6L143.4,264.6L133.5,256.5L116.6,282.8L104.6,288L79.5,272.1L71.1,258.5L58.1,257.2L52.1,243.3L62.4,229.2L61.5,218.5L84.7,204.2L101.9,186.7L100.4,162.1L109.7,133.3L104.3,100.4L111.5,94.4Z"];
  const ICONS = {
    portada: `<path d="M3 11.5 12 5l9 6.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M10 20v-5h4v5"/><path d="M7 13h1.5M15.5 13H17"/>`,
    atlas: `<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.5 9h17M3.5 15h17"/>`,
    geohistoria: `<path d="M12 2.5v2.5M10.5 4h3"/><path d="M8 10l4-4 4 4v11H8z"/><path d="M11 21v-4a1 1 0 0 1 2 0v4"/><circle cx="12" cy="11.5" r="1.2"/><path d="M3 21h18"/>`,
    subzonas: MAP_ICON.map(d => `<path d="${d}"/>`).join(''),
    tratamiento: `<path d="M3 5.5h11a2 2 0 0 1 2 2V12a2 2 0 0 1-2 2H8l-3 2.5V14H3a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z" transform="translate(1 0)"/><path d="M18 9h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v2.5L16.5 17H12a2 2 0 0 1-2-1.6"/>`,
    rasgos: `<path d="M20 3.5c-6.5.8-11.5 5.6-13.4 12.3L5 20l4-1.8C15.3 16.2 19.4 10.6 20 3.5z"/><path d="M6.5 17.5 13 11"/>`,
    laboratorio: `<path d="M2 12h3l2-5 3 10 3-14 3 12 2-3h4"/>`,
    lexico: `<path d="M4 9.5h16v6H4z"/><path d="M3 9.5c4-2.5 14-2.5 18 0M3 15.5c4 2.5 14 2.5 18 0"/><path d="M12 7.5v10"/>`,
    corpus: `<rect x="3" y="9" width="18" height="11" rx="1.5"/><path d="m3.5 9 1.6-4.3 15.4 2.4L20 9"/><path d="m8 5.4 1.4 3.4M13 6.2l1.4 3"/><path d="m10.5 12.3 4 2.2-4 2.2z"/>`,
    bibliografia: `<path d="M5 4h3v16H5zM9 4h3v16H9z"/><path d="m13 5 2.9-.8 4.1 15.4-2.9.8z"/><path d="M5 8h3M9 8h3M5 16h3M9 16h3"/>`
  };
  const svgIcon = (k, cls) => `<svg viewBox="0 0 24 24" class="${cls || 'w-[18px] h-[18px]'}" ${S} stroke-width="1.6" aria-hidden="true">${ICONS[k] || ''}</svg>`;
  window.UNIT_ICON = svgIcon;

  // Íconos de la barra lateral
  document.querySelectorAll('.unit-link').forEach(a => {
    const n = a.querySelector('.unit-num'); if (n && ICONS[a.dataset.goto]) n.innerHTML = svgIcon(a.dataset.goto);
  });

  /* ---------- Marcas de agua (dibujos de línea) ---------- */
  const ART = {
    mapa: `<g stroke-width="1.6">${MAP_BIG.map(d => `<path d="${d}"/>`).join('')}</g><g stroke-width="1" opacity=".7"><circle cx="150" cy="150" r="140" stroke-dasharray="2 6"/></g>`,
    bocadillo: `<g transform="rotate(-18 150 150)" stroke-width="2"><rect x="60" y="118" width="180" height="64" rx="8"/><path d="M50 120c55-30 145-30 200 0M50 180c55 30 145 30 200 0"/><path d="M90 118l18 64M126 118l18 64M162 118l18 64M198 118l14 52" opacity=".55"/><path d="M150 104v92M140 104h20"/></g>`,
    hormiga: `<g stroke-width="2"><circle cx="78" cy="150" r="16"/><ellipse cx="118" cy="150" rx="22" ry="13"/><ellipse cx="190" cy="150" rx="52" ry="36"/><path d="M190 114c-12 12-12 60 0 72M210 118c-10 12-10 52 0 64" opacity=".5"/><path d="M66 138c-12-22-26-30-40-30M72 136c-4-26-12-38-24-46"/><path d="M106 140 88 108l-16-6M118 138l-4-36 10-14M130 140l20-30 18-4M106 160l-18 32-16 6M118 162l-4 36 10 14M130 160l20 30 18 4"/></g>`,
    tiple: `<g transform="rotate(28 150 150)" stroke-width="2"><path d="M150 140c-26 0-44 18-44 42s20 46 44 46 44-22 44-46-18-42-44-42z"/><path d="M150 140c-18 0-30-12-30-30s14-32 30-32 30 14 30 32-12 30-30 30"/><circle cx="150" cy="176" r="12"/><path d="M144 78V22h12v56"/><path d="M140 22h20l-2-16h-16z"/><path d="M146 30v168M150 30v168M154 30v168" opacity=".45"/><path d="M134 206h32"/></g>`,
    canon: `<g stroke-width="2"><circle cx="232" cy="70" r="22"/><path d="M10 190l50-62 30 30 46-74 42 58 30-34 82 82"/><path d="M10 222l60-40 40 26 52-46 46 34 40-22 52 48" opacity=".6"/><path d="M14 262c48-22 92 10 140-6s92-24 136-2"/><path d="M40 278c40-10 80 6 120-2" opacity=".5"/></g>`,
    sombrero: `<g stroke-width="2"><ellipse cx="150" cy="182" rx="128" ry="30"/><path d="M84 178c2-60 30-92 66-92s64 32 66 92"/><path d="M90 160c40 12 80 12 120 0" stroke-width="5" opacity=".5"/><path d="M110 104c26-8 54-8 80 0" opacity=".5"/></g>`,
    arepa: `<g stroke-width="2"><ellipse cx="150" cy="156" rx="104" ry="92"/><ellipse cx="150" cy="150" rx="96" ry="84" opacity=".4"/><path d="M80 110l70 70M110 92l80 80M150 84l64 64M70 150l46 46" opacity=".55"/><circle cx="118" cy="140" r="3"/><circle cx="182" cy="176" r="3"/><circle cx="160" cy="118" r="2.5"/></g>`,
    torre: `<g stroke-width="2"><path d="M150 16v22M140 28h20"/><path d="M118 92l32-44 32 44"/><path d="M122 92h56v190h-56z"/><path d="M138 150a12 12 0 0 1 24 0v28h-24z"/><path d="M138 112h24" /><path d="M84 282h132"/><path d="M122 200h56M122 240h56" opacity=".45"/></g>`
  };
  const art = (k, style, extra) => `<svg viewBox="0 0 300 300" class="absolute" style="${style}" ${S} aria-hidden="true">${ART[k]}</svg>`;
  // por unidad: [motivo, estilo]
  const PLAN = {
    portada: [['canon', 'right:-30px;bottom:-40px;width:520px;opacity:.07'], ['mapa', 'left:38%;top:-60px;width:300px;opacity:.06;transform:rotate(-8deg)']],
    atlas: [['tiple', 'right:-60px;bottom:-60px;width:320px;opacity:.06']],
    geohistoria: [['torre', 'right:2%;top:40px;width:300px;opacity:.07'], ['canon', 'left:-60px;bottom:-30px;width:440px;opacity:.06']],
    subzonas: [['mapa', 'right:-40px;top:20px;width:520px;opacity:.06']],
    tratamiento: [['sombrero', 'left:-50px;top:30px;width:340px;opacity:.07;transform:rotate(-10deg)'], ['tiple', 'right:-30px;bottom:120px;width:300px;opacity:.06']],
    rasgos: [['hormiga', 'right:-20px;top:60px;width:300px;opacity:.07;transform:rotate(12deg)']],
    laboratorio: [],
    lexico: [['bocadillo', 'left:-40px;top:40px;width:320px;opacity:.08'], ['hormiga', 'right:-10px;bottom:200px;width:260px;opacity:.07;transform:rotate(-20deg)'], ['arepa', 'right:22%;top:-50px;width:230px;opacity:.06']],
    corpus: [['sombrero', 'left:-60px;bottom:120px;width:360px;opacity:.07'], ['tiple', 'right:-40px;top:20px;width:280px;opacity:.06']],
    bibliografia: [['mapa', 'left:-40px;bottom:120px;width:380px;opacity:.06'], ['bocadillo', 'right:-30px;top:30px;width:260px;opacity:.07']]
  };
  document.querySelectorAll('.unit').forEach(u => {
    const k = u.dataset.unit, list = PLAN[k] || [];
    if (!list.length) return;
    // en secciones oscuras el trazo es claro; en claras, color arcilla
    const first = u.querySelector('section');
    const dark = first && /bg-verde-oscuro/.test(first.className);
    const wm = document.createElement('div');
    wm.className = 'wm absolute inset-0 overflow-hidden pointer-events-none';
    wm.style.color = dark ? '#F3E3C6' : '#7A3B22';
    wm.innerHTML = list.map(([m, st]) => art(m, st)).join('');
    if (dark) { first.style.position = 'relative'; first.insertBefore(wm, first.firstChild); wm.style.zIndex = '0'; }
    else u.insertBefore(wm, u.firstChild);
  });
})();

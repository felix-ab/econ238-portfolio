/* The carbon cost of a home not built. Static, client-side only. */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const H = window.Homes;
  const num = (n, d = 0) => Number(n).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
  const INK = {pink: [255, 72, 176], blue: [0, 120, 191], black: [18, 18, 18]};
  const load = u => fetch(u).then(r => { if (!r.ok) throw Error(u); return r.json(); });
  const [topo, raw, F, pins] = await Promise.all([load('data/shed.topo.json'), load('data/tracts.json'), load('data/factors.json'), load('data/pins.json').catch(() => [])]);
  const screenImg = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'assets/print/riso-screen.png'; });

  /* ---------- data: columnar tract table joined to geometry by GEOID ---------- */
  const tractsGeo = topojson.feature(topo, topo.objects.tracts).features;
  const counties = topojson.feature(topo, topo.objects.counties).features;
  const countyMesh = topojson.mesh(topo, topo.objects.counties, (a, b) => a !== b);
  const stateMesh = topojson.mesh(topo, topo.objects.states, (a, b) => a !== b);
  const idx = new Map(raw.geoid.map((g, i) => [g, i]));
  const n = raw.geoid.length, geomOf = new Array(n).fill(null);
  for (const f of tractsGeo) { const i = idx.get(f.properties.GEOID); if (i !== undefined) geomOf[i] = f; }
  const T = {n, county: raw.county, nyc: raw.nyc, hh: raw.hh, workers: raw.workers, jobs: raw.jobs, young: raw.young, low: raw.low,
    km: raw.km, transit: raw.transit, drive: raw.drive, vmt: raw.vmt, ft: raw.ft, fh: raw.fh, land: raw.land, newUnits: raw.newUnits || null};
  const D = {tracts: T, factors: F};
  const countyName = raw.countyNames || {};

  let state = H.fromQuery(location.search), result, q0 = new URLSearchParams(location.search).get('view'), view = q0 === 'shed' ? 'shed' : 'city';
  let preset = Object.keys(H.PRESETS).find(k => H.toQuery(H.PRESETS[k].state) === H.toQuery(state)) || null;

  /* ---------- riso master ---------- */
  const SN = 512, screen = new Uint8Array(SN * SN);
  if (screenImg) { const c = document.createElement('canvas'); c.width = c.height = SN; const g = c.getContext('2d'); g.drawImage(screenImg, 0, 0); const d = g.getImageData(0, 0, SN, SN).data; for (let i = 0; i < SN * SN; i++) screen[i] = d[i * 4]; }

  /* ---------- the press ---------- */
  const stage = $('#map'), platesEl = $('#plates'), canvases = {};
  for (const name of ['black', 'blue', 'pink']) { const c = document.createElement('canvas'); c.className = 'p-' + name; platesEl.appendChild(c); canvases[name] = c; }
  const cov = document.createElement('canvas'), covG = cov.getContext('2d', {willReadFrequently: true});
  let P = null;
  function layout() {
    const rect = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(rect.width), ch = Math.round(rect.height), DW = Math.round(cw * dpr), DH = Math.round(ch * dpr);
    const top = Math.min(ch * .27, 220), side = cw < 700 ? 10 : 30;
    const proj = d3.geoConicConformal().parallels([40, 42]).rotate([74, 0]);
    const target = view === 'city' ? {type: 'FeatureCollection', features: counties.filter(c => F.nycCounties.includes(c.properties.co))} : topojson.feature(topo, topo.objects.states);
    proj.fitExtent([[side, top], [cw - side, ch - (cw < 700 ? 56 : 70)]], target);
    const path = d3.geoPath(proj);
    const paths = geomOf.map(f => f ? new Path2D(path(f) || '') : null);
    cov.width = DW; cov.height = DH;
    for (const c of Object.values(canvases)) { c.width = DW; c.height = DH; }
    P = {proj, dpr, DW, DH, cw, ch, paths, borders: new Path2D(path(countyMesh) || ''), states: new Path2D(path(stateMesh) || '')};
    printBlack(); if (GLASS) buildGlass(cw, ch); placePins();
  }
  // Rasterise one value per tract (0..1) into the coverage buffer, then screen it like a riso drum.
  function coverage(values, extra) {
    covG.setTransform(1, 0, 0, 1, 0, 0); covG.clearRect(0, 0, P.DW, P.DH);
    covG.setTransform(P.dpr, 0, 0, P.dpr, 0, 0); covG.fillStyle = '#000';
    for (let i = 0; i < n; i++) { const v = values[i]; if (v > 0 && P.paths[i]) { covG.globalAlpha = Math.min(1, v); covG.fill(P.paths[i]); } }
    if (extra) extra(covG);
    covG.globalAlpha = 1;
    return covG.getImageData(0, 0, P.DW, P.DH).data;
  }
  function screenOut(name, a) {
    const {DW, DH} = P, g = canvases[name].getContext('2d'), img = g.createImageData(DW, DH), px = new Uint32Array(img.data.buffer);
    const [r, gg, b] = INK[name], off = {black: [0, 0], pink: [173, 91], blue: [311, 397]}[name];
    for (let y = 0; y < DH; y++) {
      const row = ((y + off[1]) & 511) << 9, row2 = ((y + 211) & 511) << 9;
      for (let x = 0; x < DW; x++) {
        const v = a[(y * DW + x) * 4 + 3]; if (!v) continue;
        if (v > screen[row + ((x + off[0]) & 511)]) px[y * DW + x] = ((214 + (screen[row2 + ((x + 377) & 511)] >> 3)) << 24) | (b << 16) | (gg << 8) | r;
      }
    }
    g.putImageData(img, 0, 0);
  }
  function printBlack() {
    const land = new Float32Array(n).fill(.06);
    screenOut('black', coverage(land, g => {
      g.globalAlpha = .55; g.lineWidth = .8; g.strokeStyle = '#000'; g.stroke(P.borders);
      g.globalAlpha = 1; g.lineWidth = 1.6; g.stroke(P.states);
    }));
  }
  // Fixed reference so the pink fades as homes get built: 97th percentile of baseline extra CO2 per km².
  const base = H.calculate({...H.DEFAULT, homes: 0}, D), baseCap = H.origins({...H.DEFAULT, who: 'all'}, D);
  const dens = []; for (let i = 0; i < n; i++) { const e = baseCap[i] * Math.max(0, T.ft[i] + T.fh[i] - base.dest.total) / Math.max(T.land[i], .01); if (e > 0) dens.push(e); }
  dens.sort((a, b) => a - b); const E97 = dens[Math.floor(dens.length * .96)] || 1;
  let pending = 0;
  function printData() {
    if (!P) return;
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      const r = result, pink = new Float32Array(n), blue = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const left = Math.max(0, baseCap[i] - r.n[i]), e = left * Math.max(0, T.ft[i] + T.fh[i] - r.dest.total) / Math.max(T.land[i], .01);
        pink[i] = Math.min(.86, Math.sqrt(e / E97) * .86);
        if (r.added[i] && T.hh[i]) blue[i] = Math.min(.9, Math.sqrt(r.added[i] / T.hh[i]) * 2.4);
      }
      screenOut('pink', coverage(pink)); screenOut('blue', coverage(blue));
    });
  }

  /* ---------- glass (same filter as FOOD-55) ---------- */
  let glassGen = 0;
  const ua = navigator.userAgent, GLASS = (!!window.chrome && !/CriOS/.test(ua)) || /Firefox\//.test(ua);
  if (GLASS) document.documentElement.classList.add('glass-on');
  function buildGlass(cw, ch) {
    const k = 2, w = Math.ceil(cw / k), h = Math.ceil(ch / k), rad = 20 / k, band = Math.max(46, Math.min(130, Math.min(cw, ch) * .13)) / k;
    const dc = document.createElement('canvas'), mc = document.createElement('canvas'); dc.width = mc.width = w; dc.height = mc.height = h;
    const di = dc.getContext('2d').createImageData(w, h), mi = mc.getContext('2d').createImageData(w, h);
    const hx = w / 2 - rad, hy = h / 2 - rad, ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x + .5 - w / 2, py = y + .5 - h / 2, qx = Math.abs(px) - hx, qy = Math.abs(py) - hy;
      let d, nx, ny;
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; d = rad - l; nx = -Math.sign(px) * qx / l; ny = -Math.sign(py) * qy / l; }
      else if (qx > qy) { d = rad - qx; nx = -Math.sign(px); ny = 0; } else { d = rad - qy; nx = 0; ny = -Math.sign(py); }
      const t = Math.max(0, Math.min(1, 1 - d / band)), mag = t * t, i = (y * w + x) * 4;
      di.data[i] = 128 + 127 * nx * mag; di.data[i + 1] = 128 + 127 * ny * mag; di.data[i + 2] = 128; di.data[i + 3] = 255;
      mi.data[i] = 255 * ss(.05, .4, t); mi.data[i + 1] = 255 * ss(.35, .72, t); mi.data[i + 2] = 255 * ss(.66, 1, t); mi.data[i + 3] = 255;
    }
    dc.getContext('2d').putImageData(di, 0, 0); mc.getContext('2d').putImageData(mi, 0, 0);
    const f = document.querySelector('.glass-defs filter'); f.setAttribute('width', cw); f.setAttribute('height', ch);
    for (const [id, c] of [['glass-disp', dc], ['glass-mask', mc]]) { const el = document.getElementById(id); el.setAttribute('width', cw); el.setAttribute('height', ch); el.setAttribute('href', c.toDataURL()); }
    f.id = 'glass-' + (++glassGen); platesEl.style.filter = `url(#${f.id})`;
  }

  /* ---------- pins ---------- */
  const pinsEl = $('#pins'), factoid = $('#factoid');
  const pinEls = pins.map((p, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pin'; b.setAttribute('aria-label', p.title + ', ' + p.place); b.setAttribute('aria-expanded', 'false');
    b.addEventListener('mouseenter', () => openPin(i)); b.addEventListener('focus', () => openPin(i)); b.addEventListener('click', () => openPin(i, true));
    pinsEl.appendChild(b); return b;
  });
  let sticky = false;
  function openPin(i, stick) {
    const p = pins[i], el = pinEls[i];
    pinEls.forEach((e, j) => e.setAttribute('aria-expanded', String(j === i)));
    factoid.innerHTML = `<span class="place">${p.place}</span><h3>${p.title}</h3><p>${p.text}</p>${p.source_url ? `<a href="${p.source_url}" target="_blank" rel="noopener">${p.source_label} ↗</a>` : `<span class="src-note">${p.source_label}</span>`}`;
    factoid.hidden = false;
    const x = parseFloat(el.style.left), y = parseFloat(el.style.top), fw = factoid.offsetWidth, fh = factoid.offsetHeight;
    factoid.style.left = Math.max(12, Math.min(P.cw - fw - 12, x + 22)) + 'px'; factoid.style.top = Math.max(12, Math.min(P.ch - fh - 12, y - fh / 2 - 20)) + 'px';
    sticky = !!stick;
  }
  function closePin() { factoid.hidden = true; pinEls.forEach(e => e.setAttribute('aria-expanded', 'false')); sticky = false; }
  pinsEl.addEventListener('mouseleave', e => { if (!sticky && !factoid.contains(e.relatedTarget)) closePin(); });
  factoid.addEventListener('mouseleave', e => { if (!sticky && !(e.relatedTarget && e.relatedTarget.classList.contains('pin'))) closePin(); });
  stage.addEventListener('click', e => { if (!e.target.closest('.pin,.factoid')) closePin(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePin(); });
  function placePins() {
    pins.forEach((p, i) => {
      const xy = P.proj([p.lon, p.lat]), el = pinEls[i], inside = (p.views || ['shed', 'city']).includes(view) && xy && xy[0] > 8 && xy[0] < P.cw - 8 && xy[1] > 60 && xy[1] < P.ch - 60;
      el.hidden = !inside; if (inside) { el.style.left = xy[0] + 'px'; el.style.top = xy[1] + 'px'; }
    });
    closePin();
  }

  /* ---------- readout ---------- */
  let shown = null;
  function setFigure(v) {
    const el = $('#total'), from = shown ?? v, t0 = performance.now(); shown = v;
    const sig = x => { const a = Math.abs(x), [d, w] = a >= 1e6 ? [1e6, 'million'] : a >= 1e3 ? [1e3, 'thousand'] : [1, '']; const y = x / d; return [num(y, Math.abs(y) >= 100 ? 0 : Math.abs(y) >= 10 ? 1 : 2), w]; };
    const step = t => { const k = Math.min(1, (t - t0) / 320), e = 1 - (1 - k) ** 3, [a, w] = sig(from + (v - from) * e); el.textContent = a; $('#mag').textContent = w; if (k < 1) requestAnimationFrame(step); };
    // first paint writes the figure directly, so it is right even before animation frames run
    if (from === v) { const [a, w] = sig(v); el.textContent = a; $('#mag').textContent = w; } else requestAnimationFrame(step);
  }

  /* ---------- the instrument: household CO2 against commute distance ---------- */
  const svg = d3.select('#fp-chart'), cw2 = 320, ch2 = 210, m = {l: 34, r: 10, t: 12, b: 30};
  const xS = d3.scaleLinear().domain([0, 150]).range([m.l, cw2 - m.r]);
  const bins = []; for (let b = 0; b < 30; b++) bins.push({x0: b * 5, w: 0, f: 0});
  for (let i = 0; i < n; i++) if (baseCap[i] && T.km[i] < 150) { const b = bins[Math.floor(T.km[i] / 5)]; b.w += baseCap[i]; b.f += baseCap[i] * (T.ft[i] + T.fh[i]); }
  const pts = bins.filter(b => b.w > 30).map(b => ({x: b.x0 + 2.5, y: b.f / b.w, w: b.w}));
  const yMax = Math.ceil(Math.max(...pts.map(p => p.y), 1) * 1.15), yS = d3.scaleLinear().domain([0, yMax]).range([ch2 - m.b, m.t]);
  const rS = d3.scaleSqrt().domain([0, d3.max(pts, p => p.w)]).range([1.5, 9]);
  svg.append('line').attr('class', 'ax').attr('x1', m.l).attr('x2', cw2 - m.r).attr('y1', ch2 - m.b).attr('y2', ch2 - m.b);
  svg.append('line').attr('class', 'ax').attr('x1', m.l).attr('x2', m.l).attr('y1', m.t).attr('y2', ch2 - m.b);
  for (const t of [0, 50, 100, 150]) svg.append('text').attr('x', xS(t)).attr('y', ch2 - m.b + 14).attr('text-anchor', 'middle').text(t + (t === 150 ? ' km' : ''));
  for (const t of yS.ticks(4)) svg.append('text').attr('x', m.l - 6).attr('y', yS(t) + 3).attr('text-anchor', 'end').text(t + (t === yS.ticks(4).slice(-1)[0] ? ' t' : ''));
  const gap = svg.append('path').attr('class', 'gap');
  svg.selectAll('circle.pt').data(pts).join('circle').attr('class', 'pt').attr('cx', p => xS(p.x)).attr('cy', p => yS(p.y)).attr('r', p => rS(p.w));
  const destLine = svg.append('line').attr('class', 'dest'), destLbl = svg.append('text').attr('class', 'dest-lbl').attr('text-anchor', 'end');
  const cut = svg.append('g').attr('class', 'cut');
  cut.append('line').attr('y1', m.t).attr('y2', ch2 - m.b); cut.append('rect').attr('class', 'cut-hit').attr('y', m.t).attr('height', ch2 - m.b - m.t).attr('x', -10).attr('width', 20);
  const cutLbl = cut.append('text').attr('y', m.t + 8).attr('x', 5);
  cut.call(d3.drag().on('drag', e => { state.who = 'long'; state.cutoff = Math.round(Math.max(5, Math.min(120, xS.invert(e.x)))); preset = null; update(); }));
  function drawChart(r) {
    const y = yS(Math.min(yMax, r.dest.total));
    destLine.attr('x1', m.l).attr('x2', cw2 - m.r).attr('y1', y).attr('y2', y);
    destLbl.attr('x', cw2 - m.r).attr('y', y - 5).text('new city home ' + num(r.dest.total, 1) + ' t');
    gap.attr('d', d3.area().x(p => xS(p.x)).y0(() => y).y1(p => yS(Math.max(p.y, r.dest.total))).curve(d3.curveMonotoneX)(pts));
    cut.attr('transform', `translate(${xS(state.cutoff)},0)`).classed('on', state.who === 'long'); cutLbl.text(state.who === 'long' ? state.cutoff + ' km +' : 'drag');
    $('#fp-read').innerHTML = `Each dot is commuters at that distance. The shaded gap is the CO₂ a household sheds by moving into a <b>${{core: 'car-light core', built: 'typical new', staten: 'Staten Island-style'}[state.where]}</b> city home.`;
  }

  /* ---------- sheets ---------- */
  function sheets(r) {
    let w = 0, ft = 0, fh = 0, vm = 0;
    for (let i = 0; i < n; i++) if (r.n[i]) { w += r.n[i]; ft += r.n[i] * T.ft[i]; fh += r.n[i] * T.fh[i]; vm += r.n[i] * T.vmt[i]; }
    const o = w ? {ft: ft / w, fh: fh / w, vmt: vm / w} : {ft: 0, fh: 0, vmt: 0}, d = r.dest;
    const rows = [['Driving', 't CO₂ a year', o.ft, d.transport, v => num(v, 1) + ' t'], ['Home energy', 't CO₂ a year', o.fh, d.home, v => num(v, 1) + ' t'],
      ['Total', 't CO₂ a year', o.ft + o.fh, d.total, v => num(v, 1) + ' t'], ['Miles driven', 'a year', o.vmt, d.vmt, v => num(v)]];
    $('#hh-bars').innerHTML = rows.map(([l, s, a, b, f]) => { const mx = Math.max(a, b) * 1.06 || 1;
      return `<div class="row"><span class="lbl">${l}<small>${s}</small></span><span class="tr"><b class="b beef" style="width:${a / mx * 100}%"></b><b class="b swap" style="width:${b / mx * 100}%"></b></span><span class="v"><span>${f(a)}</span><br><span>${f(b)}</span></span></div>`; }).join('');
    const byC = new Map(); for (let i = 0; i < n; i++) if (baseCap[i]) { const c = T.county[i], e = byC.get(c) || {hh: 0, f: 0}; e.hh += baseCap[i]; e.f += baseCap[i] * (T.ft[i] + T.fh[i]); byC.set(c, e); }
    const top = [...byC].sort((a, b) => b[1].hh - a[1].hh).slice(0, 8), mx = top[0][1].hh;
    $('#origins').innerHTML = top.map(([c, e]) => `<div class="row"><span class="lbl">${countyName[c] || c}<small>${num(e.f / e.hh, 1)} t CO₂ per household</small></span><span class="tr"><b class="b beef" style="width:${e.hh / mx * 100}%"></b></span><span class="v">${num(e.hh)}<br>households</span></div>`).join('');
  }

  /* ---------- state ---------- */
  function sync() {
    $('#homes').value = state.homes; $('#homes-out').textContent = num(state.homes);
    $$('[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === preset)));
    $$('[data-who]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.who === state.who)));
    $$('[data-where]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.where === state.where)));
    $$('[data-unit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.unit === state.unit)));
    $$('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  }
  function update(write = true) {
    state = H.sanitize(state); result = H.calculate(state, D); sync();
    const r = result, cars = state.unit === 'cars';
    setFigure(cars ? r.tons / F.carTonsPerYear : r.tons);
    $('#total-cap').textContent = r.moved === 0 ? 'Build some homes to see what changes.' : cars
      ? `cars’ worth of CO₂ a year disappear if ${num(r.moved)} commuting households live in new city homes.`
      : `tons of CO₂ a year disappear if ${num(r.moved)} commuting households live in new city homes.`;
    $('#delta').textContent = r.moved ? `${num(r.perHome, 1)} t per home` + (r.moved < state.homes ? ` · only ${num(r.pool)} fit this group` : '') : '';
    $('#r-vmt').textContent = num(r.vmt / 1e6, 0) + ' million miles a year';
    $('#r-usd').textContent = '$' + num(r.dollars / 1e6, 1) + ' million a year';
    $('#r-acres').textContent = r.moved ? num(r.acres / r.moved, 2) + ' acres' : '—';
    $('#r-worse').textContent = r.moved ? num(r.worse / r.moved * 100) + '%' : '—';
    for (const k of ['core', 'built', 'staten']) $('#dest-' + k).textContent = num(H.destination({...state, where: k}, D).total, 1) + ' t a household';
    for (const k of ['all', 'young', 'low', 'long']) { const c = H.origins({...state, who: k}, D); let s = 0; for (let i = 0; i < n; i++) s += c[i]; $('#pool-' + k).textContent = num(s / 1000, 0) + 'k households'; }
    drawChart(r); sheets(r); printData();
    $('#status').textContent = '';
    if (write) history.replaceState(null, '', location.pathname + '?' + H.toQuery(state) + (view === 'shed' ? '&view=shed' : '') + location.hash);
  }
  const on = (sel, ev, fn) => $$(sel).forEach(el => el.addEventListener(ev, fn));
  on('#homes', 'input', e => { state.homes = +e.target.value; preset = null; update(); });
  on('[data-preset]', 'click', e => { preset = e.currentTarget.dataset.preset; state = {...H.PRESETS[preset].state, unit: state.unit}; update(); });
  on('[data-who]', 'click', e => { state.who = e.currentTarget.dataset.who; preset = null; update(); });
  on('[data-where]', 'click', e => { state.where = e.currentTarget.dataset.where; preset = null; update(); });
  on('[data-unit]', 'click', e => { state.unit = e.currentTarget.dataset.unit; update(); });
  on('[data-view]', 'click', e => { view = e.currentTarget.dataset.view; sync(); layout(); printData(); update(); });
  $('#ticks').innerHTML = (F.ticks || []).map(t => `<span style="left:${t.homes / 5000}%">${t.label}</span>`).join('');
  $('#share').addEventListener('click', async () => {
    const url = location.origin + location.pathname + '?' + H.toQuery(state) + (view === 'shed' ? '&view=shed' : '');
    try { await navigator.clipboard.writeText(url); $('#status').textContent = 'Link copied.'; } catch { $('#status').textContent = url; }
  });
  $('#export').addEventListener('click', () => {
    const r = result, rows = []; for (let i = 0; i < n; i++) if (r.n[i] || r.added[i]) rows.push({geoid: raw.geoid[i], movedOut: r.n[i], newHomes: r.added[i], hhCO2: T.ft[i] + T.fh[i]});
    const data = {scenario: state, tonsPerYear: r.tons, perHome: r.perHome, milesPerYear: r.vmt, destination: r.dest && {transport: r.dest.transport, home: r.dest.home}, factors: F, tracts: rows};
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'})); a.download = 'nyc-homes-scenario.json'; a.click();
    $('#status').textContent = 'Scenario exported with every input.';
  });
  // Method, limits and sources come from factors.json, so the page states exactly what the model used.
  $('#steps').innerHTML = (F.method || []).map(s => `<li><b>${s.title}</b> ${s.text}</li>`).join('');
  $('#limits').innerHTML = (F.limits || []).map(s => `<li>${s}</li>`).join('');
  $('#src').innerHTML = (F.sources || []).map(s => `<li><a href="${s.url}">${s.label}</a><span>${s.note}</span></li>`).join('');
  let rt = 0; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { layout(); printData(); }, 120); }).observe(stage);
  update(false); layout(); printData();
  document.documentElement.dataset.ready = 'true';
})();

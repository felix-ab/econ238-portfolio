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
  const press = document.createElement('div'); press.className = 'press'; platesEl.appendChild(press);
  for (const name of ['black', 'blue', 'pink']) { const c = document.createElement('canvas'); c.className = 'p-' + name; press.appendChild(c); canvases[name] = c; }
  let zoomK = 1, zoomCenter = null; // zoom over the fitted view; the lon/lat held at the stage centre
  const cov = document.createElement('canvas'), covG = cov.getContext('2d', {willReadFrequently: true});
  let P = null;
  function layout() {
    const rect = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(rect.width), ch = Math.round(rect.height), DW = Math.round(cw * dpr), DH = Math.round(ch * dpr);
    // Mercator over the whole stage. The shed covers it edge to edge; the five boroughs fit below the figure,
    // with New Jersey and Long Island filling the rest.
    const proj = d3.geoMercator();
    if (view === 'city') {
      const nyc = {type: 'FeatureCollection', features: counties.filter(c => F.nycCounties.includes(c.properties.co))};
      const top = Math.min(ch * .3, 230), key = $('.key');
      // on narrow stages the key spans most of the bottom edge, so the boroughs fit above it
      const bottom = cw < 560 && key && key.offsetParent ? Math.min(ch - 16, key.offsetTop - 8) : ch - 16;
      proj.fitExtent([[16, top], [cw - 16, bottom]], nyc);
    } else {
      const shed = topojson.feature(topo, topo.objects.states);
      proj.fitSize([cw, ch], shed);
      const b = d3.geoPath(proj).bounds(shed), k = Math.max(cw / (b[1][0] - b[0][0]), ch / (b[1][1] - b[0][1]));
      const c = proj.invert([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]);
      proj.scale(proj.scale() * k); const pc = proj(c), t = proj.translate(); proj.translate([t[0] + cw / 2 - pc[0], t[1] + ch / 2 - pc[1]]);
    }
    if (zoomK !== 1 || zoomCenter) {
      const c0 = zoomCenter || proj.invert([cw / 2, ch / 2]);
      proj.scale(proj.scale() * zoomK);
      const p = proj(c0), t = proj.translate(); proj.translate([t[0] + cw / 2 - p[0], t[1] + ch / 2 - p[1]]);
    }
    const path = d3.geoPath(proj);
    const paths = geomOf.map(f => f ? new Path2D(path(f) || '') : null);
    cov.width = DW; cov.height = DH;
    for (const c of Object.values(canvases)) { c.width = DW; c.height = DH; }
    P = {proj, dpr, DW, DH, cw, ch, paths, borders: new Path2D(path(countyMesh) || ''), states: new Path2D(path(stateMesh) || '')};
    printBlack();
    const ro = $('.readout').getBoundingClientRect(); stage.style.setProperty('--veil-h', Math.round(ro.bottom - rect.top + 56) + 'px');
    placePins();
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

  /* ---------- pins ---------- */
  const pinsEl = $('#pins'), factoid = $('#factoid');
  const pinEls = pins.map((p, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pin'; b.setAttribute('aria-label', p.title + ', ' + p.place); b.setAttribute('aria-expanded', 'false'); b.innerHTML = '<i class="sq"></i><b></b>';
    b.addEventListener('mouseenter', () => openPin(i)); b.addEventListener('focus', () => openPin(i)); b.addEventListener('click', () => openPin(i, true));
    pinsEl.appendChild(b); return b;
  });
  let sticky = false;
  function openPin(i, stick) {
    const p = pins[i], el = pinEls[i];
    pinEls.forEach((e, j) => e.setAttribute('aria-expanded', String(j === i)));
    factoid.innerHTML = `<span class="place"><b>${el.dataset.n || ''}</b>${p.place}</span><h3>${p.title}</h3><p>${p.text}</p>${p.source_url ? `<a href="${p.source_url}" target="_blank" rel="noopener">${p.source_label} ↗</a>` : `<span class="src-note">${p.source_label}</span>`}`;
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
  // Rings sit up-right of their square; if one would overlap a ring already placed, it tries the other corners.
  const RING = [[20, -20], [-20, -20], [20, 20], [-20, 20]];
  function placePins() {
    let k = 0; const rings = [], so = stage.getBoundingClientRect();
    const blocked = ['.readout .figure', '.readout .figure-cap', '.readout .delta', '.units', '.key', '.zoom'].map(q => document.querySelector(q)).filter(e => e && e.offsetParent)
      .map(e => { const r = e.getBoundingClientRect(); return [r.left - so.left, r.top - so.top, r.right - so.left, r.bottom - so.top]; });
    const pos = pins.map(p => {
      const xy = P.proj([p.lon, p.lat]);
      const under = blocked.some(([l, t, r, b]) => xy && xy[0] > l - 40 && xy[0] < r + 40 && xy[1] > t - 40 && xy[1] < b + 44);
      return (p.views || ['shed', 'city']).includes(view) && xy && !under && xy[0] > 24 && xy[0] < P.cw - 24 && xy[1] > 44 && xy[1] < P.ch - 24 ? xy : null;
    });
    pins.forEach((p, i) => {
      const xy = pos[i], el = pinEls[i];
      el.hidden = !xy; if (!xy) return;
      el.dataset.n = ++k; el.querySelector('b').textContent = k;
      // a ring must stay inside the stage and clear every other ring and every pin's square
      const ok = ([dx, dy]) => { const x = xy[0] + dx, y = xy[1] + dy;
        return x > 18 && x < P.cw - 18 && y > 18 && y < P.ch - 18 && rings.every(([a, b]) => Math.hypot(x - a, y - b) > 32)
          && pos.every((q, j) => !q || j === i || Math.hypot(x - q[0], y - q[1]) > 20); };
      const ring = RING.find(ok) || RING.find(([dx, dy]) => xy[0] + dx > 18 && xy[0] + dx < P.cw - 18 && xy[1] + dy > 18) || RING[0];
      rings.push([xy[0] + ring[0], xy[1] + ring[1]]);
      el.style.setProperty('--rx', ring[0] + 'px'); el.style.setProperty('--ry', ring[1] + 'px');
      el.style.left = xy[0] + 'px'; el.style.top = xy[1] + 'px';
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
    $('#fp-read').innerHTML = `New home: <b>${{core: 'car-light core', built: 'where NYC builds', staten: 'Staten Island-style'}[state.where]}</b>, ${num(r.dest.total, 1)} t a year.`;
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
    $('#homes').value = state.homes; $('#homes-out').textContent = num(state.homes); $('#homes').style.setProperty('--p', state.homes / 5000 + '%');
    $$('[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === preset)));
    $$('[data-who]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.who === state.who)));
    $$('[data-where]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.where === state.where)));
    $$('[data-unit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.unit === state.unit)));
    $$('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    if ($('#zoom-out')) { $('#zoom-out').disabled = zoomK <= 1; $('#zoom-fit').disabled = zoomK === 1 && !zoomCenter; }
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
  on('[data-view]', 'click', e => { view = e.currentTarget.dataset.view; zoomK = 1; zoomCenter = null; sync(); layout(); printData(); update(); });
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
  /* ---------- zoom and pan: each move reprints the drums at the new scale ---------- */
  function refit() { layout(); printData(); sync(); }
  function zoomBy(f, at) {
    const pt = at || [P.cw / 2, P.ch / 2], ll = P.proj.invert(pt), c = P.proj.invert([P.cw / 2, P.ch / 2]);
    const k = Math.max(1, Math.min(10, zoomK * f)); if (k === zoomK) return;
    if (at && ll && c) { const s2 = 1 - zoomK / k; zoomCenter = [c[0] + (ll[0] - c[0]) * s2, c[1] + (ll[1] - c[1]) * s2]; }
    else zoomCenter = zoomCenter || c;
    zoomK = k; if (zoomK === 1) zoomCenter = null; refit();
  }
  if ($('#zoom-in')) {
    $('#zoom-in').addEventListener('click', () => zoomBy(1.6));
    $('#zoom-out').addEventListener('click', () => zoomBy(1 / 1.6));
    $('#zoom-fit').addEventListener('click', () => { zoomK = 1; zoomCenter = null; refit(); });
  }
  const isControl = el => el.closest('.pin,.factoid,.key,.zoom,.units,button,a,[popover]');
  stage.addEventListener('dblclick', e => { if (isControl(e.target)) return; const r = stage.getBoundingClientRect(); zoomBy(1.6, [e.clientX - r.left, e.clientY - r.top]); });
  stage.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); const r = stage.getBoundingClientRect(); zoomBy(e.deltaY < 0 ? 1.25 : 0.8, [e.clientX - r.left, e.clientY - r.top]); }, {passive: false});
  let pan = null;
  stage.addEventListener('pointerdown', e => { if (isControl(e.target) || e.button) return; pan = {x: e.clientX, y: e.clientY, dx: 0, dy: 0, id: e.pointerId}; });
  stage.addEventListener('pointermove', e => {
    if (!pan || e.pointerId !== pan.id) return;
    pan.dx = e.clientX - pan.x; pan.dy = e.clientY - pan.y;
    if (!pan.on && Math.hypot(pan.dx, pan.dy) > 4) { pan.on = true; stage.setPointerCapture(e.pointerId); stage.classList.add('dragging'); closePin(); }
    if (pan.on) press.style.transform = pinsEl.style.transform = `translate(${pan.dx}px,${pan.dy}px)`;
  });
  const endDrag = () => {
    if (!pan) return; const d = pan; pan = null; stage.classList.remove('dragging');
    if (!d.on) return;
    const c = P.proj.invert([P.cw / 2 - d.dx, P.ch / 2 - d.dy]);
    if (c) { zoomCenter = c; if (zoomK === 1) zoomK = 1.0001; }
    refit(); press.style.transform = pinsEl.style.transform = '';
  };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
  /* ---------- popouts: native popovers, placed beside their info button ---------- */
  const closePops = () => { const o = document.querySelector('.pop:popover-open'); if (o) o.hidePopover(); };
  $('.panel').addEventListener('scroll', closePops, {passive: true}); addEventListener('scroll', closePops, {passive: true});
  $$('.pop').forEach(pop => pop.addEventListener('toggle', e => {
    const btn = document.querySelector(`[popovertarget="${pop.id}"]`); if (!btn) return;
    btn.classList.toggle('open', e.newState === 'open'); if (e.newState !== 'open') return;
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, vw = innerWidth, vh = innerHeight;
    let x = r.left - w - 12, y = r.top - 8;
    if (x < 12) { x = Math.min(vw - w - 12, Math.max(12, r.left)); y = r.bottom + 10; }
    if (y + h > vh - 12) y = Math.max(12, (x === r.left - w - 12 ? r.bottom : r.top - 10) - h);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }));
  let rt = 0; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { layout(); printData(); }, 120); }).observe(stage);
  update(false); layout(); printData();
  document.documentElement.dataset.ready = 'true';
})();

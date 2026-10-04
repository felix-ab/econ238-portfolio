/* FOOD-55 instrument. Static, client-side only. */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const M = window.Food55;
  const num = (n, d = 0) => Number(n).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
  const UNIT = {acres: 'acres', mi2: 'square miles', km2: 'square kilometres'};
  const INK = {pink: [255, 72, 176], blue: [0, 120, 191], yellow: [255, 232, 0], black: [18, 18, 18]};

  const load = u => fetch(u).then(r => { if (!r.ok) throw Error(u); return r.json(); });
  const [inputs, foods, grid, topo, pins] = await Promise.all([
    load('data/model-inputs.json'), load('data/foods.json'), load('data/grid.json'),
    load('data/land-110m.json'), load('data/pins.json').catch(() => [])
  ]);
  const screenImg = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'assets/print/riso-screen.png'; });

  let state = M.fromQuery(location.search), result, view = new URLSearchParams(location.search).get('view') === 'us' ? 'us' : 'world';
  let preset = Object.keys(M.PRESETS).find(k => M.toQuery(M.PRESETS[k].state) === M.toQuery(state)) || null;

  /* ---------- riso master: 512² threshold map made in Photoshop ---------- */
  const SN = 512, screen = new Uint8Array(SN * SN);
  if (screenImg) {
    const c = document.createElement('canvas'); c.width = c.height = SN;
    const g = c.getContext('2d'); g.drawImage(screenImg, 0, 0, SN, SN);
    const d = g.getImageData(0, 0, SN, SN).data;
    for (let i = 0; i < SN * SN; i++) screen[i] = d[i * 4];
  } else { for (let i = 0; i < SN * SN; i++) screen[i] = (i * 2654435761 >>> 24); }

  /* ---------- data rasters on the 0.5° grid ---------- */
  const W = 720, H = 360, cellKm2 = lat => (0.5 * 111.195) ** 2 * Math.cos(lat * Math.PI / 180);
  const R = {pasture: new Float32Array(W * H), feed: new Float32Array(W * H), soy: new Float32Array(W * H), pulse: new Float32Array(W * H), feedcrop: new Float32Array(W * H)};
  const tot = {ct: 0, mz: 0, sy: 0, pu: 0};
  for (const c of grid.us) { tot.ct += c[2]; tot.mz += c[3]; tot.sy += c[4]; tot.pu += c[5]; }
  for (const [lon, lat, ct, mz, sy, pu] of grid.us) {
    const i = Math.floor((90 - lat) * 2) * W + Math.floor((lon + 180) * 2), a = cellKm2(lat);
    // share of the national total in this cell, per km² of cell: coverage = total km² × value
    R.pasture[i] = ct / tot.ct / a; R.feed[i] = mz / tot.mz / a; R.soy[i] = sy / tot.sy / a;
    R.pulse[i] = pu / tot.pu / a; R.feedcrop[i] = (mz + sy) / (tot.mz + tot.sy) / a;
  }
  const cattle = new Float32Array(360 * 180); // head per km², 1° grid, outside the US
  for (const [lon, lat, head] of grid.world) cattle[Math.floor(90 - lat) * 360 + Math.floor(lon + 180)] = head / ((111.195 ** 2) * Math.cos(lat * Math.PI / 180));
  for (const [lon, lat, ct] of grid.us) { const i = Math.floor(90 - lat) * 360 + Math.floor(lon + 180); cattle[i] += ct / ((111.195 ** 2) * Math.cos(lat * Math.PI / 180)) / 4; }
  function bilinear(arr, w, h, fx, fy) {
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : arr[y * w + x];
    return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
  }

  /* ---------- the press ---------- */
  const stage = $('#map'), platesEl = $('#plates');
  const plateNames = ['black', 'yellow', 'blue', 'pink'];
  const canvases = {};
  for (const n of plateNames) { const c = document.createElement('canvas'); c.className = 'p-' + n; platesEl.appendChild(c); canvases[n] = c; }
  const land = topojson.feature(topo, topo.objects.land);
  const usPoints = {type: 'MultiPoint', coordinates: grid.us.filter(c => c[0] > -130).map(c => [c[0], c[1]])};
  let P = null; // per-view precomputation

  function layout() {
    const rect = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(rect.width), ch = Math.round(rect.height), DW = Math.round(cw * dpr), DH = Math.round(ch * dpr);
    const topPad = Math.min(ch * .3, 240), side = cw < 700 ? 10 : 28, bottom = cw < 700 ? 64 : 64;
    const proj = d3.geoEqualEarth();
    if (view === 'world') proj.fitExtent([[side, cw < 700 ? topPad * .8 : topPad * .55], [cw - side, ch - bottom]], {type: 'Sphere'});
    else proj.fitExtent([[side + 20, topPad], [cw - side - 20, ch - 74]], usPoints);
    // land mask at device resolution
    const mc = document.createElement('canvas'); mc.width = DW; mc.height = DH;
    const mg = mc.getContext('2d'); mg.scale(dpr, dpr); mg.fillStyle = '#000'; mg.beginPath(); d3.geoPath(proj, mg)(land); mg.fill();
    const md = mg.getImageData(0, 0, DW, DH).data, mask = new Uint8Array(DW * DH);
    for (let i = 0; i < mask.length; i++) mask[i] = md[i * 4 + 3];
    // coarse lattice (every S device px): sampled data values
    const S = 3, GW = Math.ceil(DW / S) + 2, GH = Math.ceil(DH / S) + 2, n = GW * GH;
    const L = {pasture: new Float32Array(n), feed: new Float32Array(n), soy: new Float32Array(n), pulse: new Float32Array(n), feedcrop: new Float32Array(n), cattle: new Float32Array(n)};
    let bx0 = GW, bx1 = 0, by0 = GH, by1 = 0;
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const ll = proj.invert([gx * S / dpr, gy * S / dpr]);
      if (!ll || !isFinite(ll[0]) || Math.abs(ll[0]) > 180 || Math.abs(ll[1]) > 90) continue;
      const k = gy * GW + gx, fx = (ll[0] + 180) * 2 - .5, fy = (90 - ll[1]) * 2 - .5;
      if (ll[0] < -60 && ll[0] > -180 && ll[1] > 15 && ll[1] < 72) {
        for (const key of ['pasture', 'feed', 'soy', 'pulse', 'feedcrop']) L[key][k] = bilinear(R[key], W, H, fx, fy);
        if (L.pasture[k] || L.feed[k] || L.soy[k] || L.pulse[k]) { bx0 = Math.min(bx0, gx); bx1 = Math.max(bx1, gx); by0 = Math.min(by0, gy); by1 = Math.max(by1, gy); }
      }
      L.cattle[k] = bilinear(cattle, 360, 180, ll[0] + 180 - .5, 90 - ll[1] - .5);
    }
    for (const c of Object.values(canvases)) { c.width = DW; c.height = DH; }
    P = {proj, dpr, DW, DH, S, GW, GH, L, mask, box: [Math.max(0, (bx0 - 1) * S), Math.max(0, (by0 - 1) * S), Math.min(DW, (bx1 + 2) * S), Math.min(DH, (by1 + 2) * S)], cw, ch};
    printBlack();
    placePins();
  }

  // Screen one drum: ink where coverage beats the master. Each drum reads the master at its own offset,
  // the way each riso master is cut separately. A second read varies ink density slightly (uneven inking).
  function print(name, coverageAt, box) {
    const {DW, DH, S, GW} = P, c = canvases[name], g = c.getContext('2d');
    const [x0, y0, x1, y1] = box || [0, 0, DW, DH];
    const img = g.createImageData(DW, DH), px = new Uint32Array(img.data.buffer);
    const [r, gg, b] = INK[name], off = {black: [0, 0], pink: [173, 91], blue: [311, 397], yellow: [59, 241]}[name];
    for (let y = y0; y < y1; y++) {
      const gy = y / S, iy = Math.floor(gy), ty = gy - iy, row = ((y + off[1]) & 511) << 9, row2 = ((y + 211) & 511) << 9;
      for (let x = x0; x < x1; x++) {
        const gx = x / S, ix = Math.floor(gx), tx = gx - ix, k = iy * GW + ix;
        const v = (coverageAt(k) * (1 - tx) + coverageAt(k + 1) * tx) * (1 - ty) + (coverageAt(k + GW) * (1 - tx) + coverageAt(k + GW + 1) * tx) * ty;
        if (v <= 0) continue;
        if (v * 255 > screen[row + ((x + off[0]) & 511)]) {
          const a = 214 + (screen[row2 + ((x + 377) & 511)] >> 3);
          px[y * DW + x] = (a << 24) | (b << 16) | (gg << 8) | r;
        }
      }
    }
    g.putImageData(img, 0, 0);
  }
  // Black drum: a light tint for land, deepened by cattle density worldwide.
  function printBlack() {
    const {mask, L, DW, DH, S, GW} = P;
    const c = canvases.black, g = c.getContext('2d'), img = g.createImageData(DW, DH), px = new Uint32Array(img.data.buffer);
    const [r, gg, b] = INK.black;
    for (let y = 0; y < DH; y++) {
      const row = ((y + 29) & 511) << 9, iy = Math.floor(y / S);
      for (let x = 0; x < DW; x++) {
        const m = mask[y * DW + x]; if (!m) continue;
        const cat = L.cattle[iy * GW + Math.floor(x / S)];
        const v = (.085 + Math.min(.17, Math.sqrt(cat) * .03)) * m / 255;
        if (v * 255 > screen[row + ((x + 401) & 511)]) px[y * DW + x] = (238 << 24) | (b << 16) | (gg << 8) | r;
      }
    }
    g.putImageData(img, 0, 0);
  }
  let pending = 0;
  function printData() {
    if (!P) return;
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      const r = result, L = P.L, parts = r.plate.parts, where = {tofu: 'soy', beans: 'pulse', lentils: 'pulse', chicken: 'feedcrop', eggs: 'feedcrop'};
      const rep = {soy: 0, pulse: 0, feedcrop: 0};
      for (const [k, p] of Object.entries(parts)) rep[where[k]] += r.plate.land > 0 ? r.replacement * p.land / r.plate.land : 0;
      print('pink', k => Math.min(1, r.pasture * L.pasture[k]), P.box);
      print('blue', k => Math.min(1, r.feed * L.feed[k]), P.box);
      print('yellow', k => Math.min(1, rep.soy * L.soy[k] + rep.pulse * L.pulse[k] + rep.feedcrop * L.feedcrop[k]), P.box);
    });
  }

  /* ---------- pins ---------- */
  const pinsEl = $('#pins'), factoid = $('#factoid');
  const pinArt = await new Promise(res => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = 'assets/print/pin.png'; });
  const pinEls = pins.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pin' + (pinArt ? '' : ' no-art'); b.setAttribute('aria-label', p.title + ', ' + p.place); b.setAttribute('aria-expanded', 'false');
    b.addEventListener('mouseenter', () => openPin(i)); b.addEventListener('focus', () => openPin(i));
    b.addEventListener('click', () => openPin(i, true));
    pinsEl.appendChild(b); return b;
  });
  let openIdx = -1, sticky = false;
  function openPin(i, stick) {
    const p = pins[i], el = pinEls[i];
    pinEls.forEach((e, j) => e.setAttribute('aria-expanded', String(j === i)));
    factoid.innerHTML = `<span class="place">${p.place}</span><h3>${p.title}</h3><p>${p.text}</p><a href="${p.source_url}" target="_blank" rel="noopener">${p.source_label} ↗</a>`;
    factoid.hidden = false;
    const x = parseFloat(el.style.left), y = parseFloat(el.style.top), fw = factoid.offsetWidth, fh = factoid.offsetHeight;
    factoid.style.left = Math.max(12, Math.min(P.cw - fw - 12, x + 22)) + 'px';
    factoid.style.top = Math.max(12, Math.min(P.ch - fh - 12, y - fh / 2 - 20)) + 'px';
    openIdx = i; sticky = !!stick;
  }
  function closePin() { factoid.hidden = true; pinEls.forEach(e => e.setAttribute('aria-expanded', 'false')); openIdx = -1; sticky = false; }
  pinsEl.addEventListener('mouseleave', e => { if (!sticky && !factoid.contains(e.relatedTarget)) closePin(); });
  factoid.addEventListener('mouseleave', e => { if (!sticky && !(e.relatedTarget && e.relatedTarget.classList.contains('pin'))) closePin(); });
  stage.addEventListener('click', e => { if (!e.target.closest('.pin,.factoid')) closePin(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePin(); });
  function placePins() {
    pins.forEach((p, i) => {
      const xy = P.proj([p.lon, p.lat]), el = pinEls[i];
      const inside = (p.views || ['world', 'us']).includes(view) && xy && xy[0] > 8 && xy[0] < P.cw - 8 && xy[1] > 48 && xy[1] < P.ch - 70;
      el.hidden = !inside; if (!inside) return;
      el.style.left = xy[0] + 'px'; el.style.top = xy[1] + 'px';
    });
    closePin();
  }

  /* ---------- readout ---------- */
  let shown = null;
  function setFigure(target) {
    const el = $('#total'), from = shown ?? target, t0 = performance.now();
    shown = target;
    // three significant figures: the inputs are estimates, so the figure shouldn't claim more
    const sig = v => { const [d, word] = v >= 1e9 ? [1e9, 'billion'] : v >= 1e6 ? [1e6, 'million'] : [1e3, 'thousand']; const x = v / d; return [num(x, x >= 100 ? 0 : x >= 10 ? 1 : 2), word]; };
    const step = t => { const k = Math.min(1, (t - t0) / 320), e = 1 - (1 - k) ** 3, [a, w] = sig(from + (target - from) * e); el.textContent = a; $('#mag').textContent = w; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---------- panel ---------- */
  const FOOD_ORDER = ['mixed', 'plants', 'tofu', 'beans', 'lentils', 'chicken', 'eggs'];
  const leuPer100 = key => { const parts = M.PLATES[key].parts; let l = 0, g = 0; for (const [f, s] of Object.entries(parts)) { l += s * foods[f].per100g.leucine; g += s; } return l / g; };
  $('#foods').innerHTML = FOOD_ORDER.map(k => `<button type="button" class="cell" data-food="${k}" aria-pressed="false">${M.PLATES[k].label}<small>${num(leuPer100(k), 2)} g leu/100 g</small></button>`).join('');
  const WHO = [['adolescent', '14–18'], ['adult', '19–50'], ['older', '51–70'], ['oldest', '71+'], ['pregnancy', 'Pregnant'], ['lactation', 'Breastfeeding']];
  $('#who').innerHTML = '<span class="colh">Age</span><span class="colh">Female</span><span class="colh">Male</span>' + WHO.map(([k, l]) =>
    `<span class="rowh">${l}</span><button type="button" class="cell" data-profile="${k}" data-sex="female" aria-pressed="false">F</button><button type="button" class="cell" data-profile="${k}" data-sex="male" aria-pressed="false" ${k === 'pregnancy' || k === 'lactation' ? 'disabled aria-label="Not applicable"' : ''}>M</button>`).join('');

  // Leucine instrument: leucine against plate weight. The swap moves along a straight segment from the
  // appetite plate (same weight as the beef) to the muscle plate (reaches the target). Drag to set the mix.
  const svg = d3.select('#leu-chart'), cw = 320, chh = 196, m = {l: 34, r: 12, t: 12, b: 30};
  const xS = d3.scaleLinear().domain([0, 450]).range([m.l, cw - m.r]), yS = d3.scaleLinear().domain([0, 3.6]).range([chh - m.b, m.t]);
  svg.append('line').attr('class', 'ax').attr('x1', m.l).attr('x2', cw - m.r).attr('y1', chh - m.b).attr('y2', chh - m.b);
  svg.append('line').attr('class', 'ax').attr('x1', m.l).attr('x2', m.l).attr('y1', m.t).attr('y2', chh - m.b);
  for (const t of [0, 100, 200, 300, 400]) svg.append('text').attr('x', xS(t)).attr('y', chh - m.b + 14).attr('text-anchor', 'middle').text(t + (t === 400 ? ' g' : ''));
  for (const t of [0, 1, 2, 3]) svg.append('text').attr('x', m.l - 6).attr('y', yS(t) + 3).attr('text-anchor', 'end').text(t + (t === 3 ? ' g' : ''));
  const tgt = svg.append('line').attr('class', 'tgt'), tgtLbl = svg.append('text').attr('text-anchor', 'end');
  const beefDot = svg.append('circle').attr('class', 'beef').attr('r', 7), beefLbl = svg.append('text').text('beef');
  const seg = svg.append('line').attr('class', 'seg');
  const endA = svg.append('circle').attr('class', 'end').attr('r', 4), endB = svg.append('circle').attr('class', 'end').attr('r', 4);
  const halo = svg.append('circle').attr('class', 'halo').attr('r', 16), handle = svg.append('circle').attr('class', 'handle').attr('r', 7);
  let segPts = null;
  function drawLeu(r) {
    const a = M.swap({...state, lane: 'appetite'}, inputs, foods).plate, b = M.swap({...state, lane: 'planned'}, inputs, foods).plate;
    segPts = [[a.grams, a.leucine], [b.grams, b.leucine]];
    const t = r.dri.leucineMeal;
    tgt.attr('x1', m.l).attr('x2', cw - m.r).attr('y1', yS(t)).attr('y2', yS(t));
    tgtLbl.attr('x', cw - m.r).attr('y', yS(t) - 5).text('target ' + t + ' g');
    beefDot.attr('cx', xS(r.beef.grams)).attr('cy', yS(r.beef.leucine)); beefLbl.attr('x', xS(r.beef.grams) + 10).attr('y', yS(r.beef.leucine) + 14);
    seg.attr('x1', xS(a.grams)).attr('y1', yS(a.leucine)).attr('x2', xS(Math.min(450, b.grams))).attr('y2', yS(b.leucine));
    endA.attr('cx', xS(a.grams)).attr('cy', yS(a.leucine)); endB.attr('cx', xS(Math.min(450, b.grams))).attr('cy', yS(b.leucine));
    handle.attr('cx', xS(Math.min(450, r.plate.grams))).attr('cy', yS(r.plate.leucine)); halo.attr('cx', xS(Math.min(450, r.plate.grams))).attr('cy', yS(r.plate.leucine));
    $('#leu-g').textContent = num(r.plate.leucine, 2) + ' g'; $('#leu-plate').textContent = num(r.plate.grams) + ' g';
    $('#leu-kcal').textContent = num(r.plate.kcal) + ' kcal (beef ' + num(r.beef.kcal) + ')';
  }
  const drag = d3.drag().on('drag', e => {
    if (!segPts) return;
    const [[ax, ay], [bx, by]] = segPts, px = xS.invert(e.x), py = yS.invert(e.y);
    const dx = bx - ax, dy = by - ay, sx = 1 / 450, sy = 1 / 3.6; // project in normalised chart space
    let p = ((px - ax) * dx * sx * sx + (py - ay) * dy * sy * sy) / (dx * dx * sx * sx + dy * dy * sy * sy);
    p = Math.max(0, Math.min(1, p));
    state.lane = p < .02 ? 'appetite' : p > .98 ? 'planned' : 'mixed'; state.plannedShare = Math.round(p * 100); preset = null; update();
  });
  halo.call(drag); handle.call(drag);

  function dumbbells(r) {
    const d = r.dri, b = r.beef, p = r.plate;
    const rows = [['Vitamin B12', b.b12 / d.b12, p.b12 / d.b12], ['Zinc', b.zinc / d.zinc, p.zinc / d.zinc], ['Iron', b.iron / d.iron, p.iron / d.iron],
      ['Copper', b.copper / d.copper, p.copper / d.copper], ['Selenium', b.selenium / d.selenium, p.selenium / d.selenium], ['Protein', b.protein / d.protein, p.protein / d.protein]];
    const x = v => Math.min(100, v / 1.5 * 100);
    $('#micro').innerHTML = rows.map(([l, bv, sv]) => `<div class="dumb"><span>${l}</span><span class="track"><b class="bar" style="left:${Math.min(x(bv), x(sv))}%;width:${Math.abs(x(bv) - x(sv))}%"></b><i class="dot pink" style="left:${x(bv)}%"></i><i class="dot blue" style="left:${x(sv)}%"></i></span><em>${num(sv * 100)}%</em></div>`).join('');
  }

  /* ---------- the meal sheet ---------- */
  function mealSheet(r) {
    const b = r.beef, p = r.plate, d = r.dri, g1 = v => num(v, 1) + ' g';
    $('#meal-name').textContent = num(p.grams) + ' g of ' + M.PLATES[state.replacement].label.toLowerCase();
    const rows = [['Leucine', 'target ' + d.leucineMeal + ' g', b.leucine, p.leucine, d.leucineMeal, v => num(v, 2) + ' g'],
      ['Protein', '', b.protein, p.protein, 0, g1], ['Calories', '', b.kcal, p.kcal, 0, v => num(v) + ' kcal'], ['Fiber', '', b.fiber, p.fiber, 0, g1], ['On the plate', '', b.grams, p.grams, 0, v => num(v) + ' g']];
    $('#meal-bars').innerHTML = rows.map(([l, s, bv, sv, t, f]) => { const mx = Math.max(bv, sv, t) * 1.06 || 1, w = v => v / mx * 100;
      return `<div class="row${t && sv < t ? ' short' : ''}"><span class="lbl">${l}${s ? `<small>${s}</small>` : ''}</span><span class="tr"><b class="b beef" style="width:${w(bv)}%"></b><b class="b swap" style="width:${w(sv)}%"></b>${t ? `<i class="t" style="left:${w(t)}%"></i>` : ''}</span><span class="v"><span>${f(bv)}</span><br><span>${f(sv)}</span></span></div>`; }).join('');
    const eaa = ['leucine', 'isoleucine', 'valine', 'lysine', 'methionine', 'phenylalanine', 'threonine', 'tryptophan', 'histidine'];
    $('#eaa').innerHTML = eaa.map(k => { const v = p[k] / b[k] * 100; return `<div class="col${v < 100 ? ' short' : ''}"><em>${num(v)}%</em><div class="bar" style="height:${Math.min(v, 200) / 2 * .62}%"></div><span>${k}</span></div>`; }).join('');
    const low = eaa.map(k => [k, p[k] / b[k]]).sort((x, y) => x[1] - y[1])[0];
    $('#eaa-note').textContent = `The scarcest is ${low[0]}, at ${num(low[1] * 100)}% of the beef. Muscle is built only as far as the scarcest essential amino acid allows. Hatched bars fall short of the beef.`;
  }

  /* ---------- state ---------- */
  function sync() {
    $('#reduction').value = state.reduction; $('#coverage').value = state.coverage;
    $('#reduction-out').textContent = state.reduction + '%'; $('#coverage-out').textContent = state.coverage + '%';
    $$('[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === preset)));
    $$('[data-food]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.food === state.replacement)));
    $$('#who .cell').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.profile === state.profile && b.dataset.sex === state.sex)));
    $$('[data-lane]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lane === state.lane)));
    $$('[data-unit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.unit === state.unit)));
    $$('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  }
  function update(write = true) {
    state = M.sanitize(state); result = M.calculate(state, inputs, foods); sync();
    const r = result;
    setFigure(M.convert(r.total, state.unit));
    $('#total-cap').textContent = r.shift === 0 ? `of land feed America’s beef each year.` : `of land feed America’s beef and what replaces it.`;
    $('#delta').textContent = r.shift === 0 ? '' : `${r.changePercent > 0 ? '+' : '−'}${num(Math.abs(r.changePercent), 1)}% · ${num(r.freed / inputs.compare.km2, 1)} Texases freed`;
    drawLeu(r); dumbbells(r); mealSheet(r); printData();
    $('#status').textContent = '';
    if (write) history.replaceState(null, '', location.pathname + '?' + M.toQuery(state) + (view === 'us' ? '&view=us' : '') + location.hash);
  }
  const on = (sel, ev, fn) => $$(sel).forEach(el => el.addEventListener(ev, fn));
  on('#reduction,#coverage', 'input', e => { state[e.target.id] = +e.target.value; preset = null; update(); });
  on('[data-preset]', 'click', e => { preset = e.currentTarget.dataset.preset; state = {...M.PRESETS[preset].state, unit: state.unit, profile: state.profile, sex: state.sex}; update(); });
  on('[data-food]', 'click', e => { state.replacement = e.currentTarget.dataset.food; preset = null; update(); });
  on('#who .cell', 'click', e => { state.profile = e.currentTarget.dataset.profile; state.sex = e.currentTarget.dataset.sex; update(); });
  on('[data-lane]', 'click', e => { state.lane = e.currentTarget.dataset.lane; state.plannedShare = state.lane === 'mixed' ? 50 : state.plannedShare; preset = null; update(); });
  on('[data-unit]', 'click', e => { state.unit = e.currentTarget.dataset.unit; update(); });
  on('[data-view]', 'click', e => { view = e.currentTarget.dataset.view; sync(); layout(); printData(); update(); document.getElementById('map').scrollIntoView({block: 'nearest'}); });
  $('#share').addEventListener('click', async () => {
    const url = location.origin + location.pathname + '?' + M.toQuery(state) + (view === 'us' ? '&view=us' : '');
    try { await navigator.clipboard.writeText(url); $('#status').textContent = 'Link copied.'; } catch { $('#status').textContent = url; }
  });
  $('#export').addEventListener('click', () => {
    const {beef, plate} = result, {parts, ...plateOut} = plate;
    const data = {scenario: state, landKm2: {pasture: result.pasture, feed: result.feed, replacement: result.replacement, total: result.total, freed: result.freed}, perMeal: {beef, replacement: plateOut}, inputs, foods};
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'})); a.download = 'food-55-scenario.json'; a.click();
    $('#status').textContent = 'Scenario exported with every input.';
  });
  let rt = 0;
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { layout(); printData(); }, 120); }).observe(stage);
  update(false);
  layout(); printData();
  document.documentElement.dataset.ready = 'true';
})();

/* The carbon cost of a home not built. Pure accounting over census tracts; every input is in data/.
   A tract row: households, workers, NYC-bound jobs (all, under 30, lower earners), mean commute km,
   transit share, annual household driving, household CO2 (driving + home energy), land area. */
(function (root) {
  'use strict';
  // homes: homes the rules block. share: % of them that would have housed a household now priced out to
  // somewhere with a bigger footprint (the rest go to people already in the city, newcomers, or suburb-choosers).
  const DEFAULT = Object.freeze({homes: 80000, share: 25, who: 'all', where: 'core', cutoff: 30, unit: 'tons'});
  const PRESETS = Object.freeze({
    yes: {label: 'City of Yes', state: {...DEFAULT, homes: 80000, where: 'built'}},
    goal: {label: '500,000 homes', state: {...DEFAULT, homes: 500000, where: 'built'}},
    young: {label: 'Young workers move in', state: {...DEFAULT, who: 'young'}},
    staten: {label: 'Build it like Staten Island', state: {...DEFAULT, where: 'staten'}}
  });
  const clamp = (n, a, b, f) => Number.isFinite(Number(n)) ? Math.max(a, Math.min(b, Number(n))) : f;
  function sanitize(v = {}) {
    const s = {...DEFAULT};
    s.homes = Math.round(clamp(v.homes ?? s.homes, 0, 500000, s.homes) / 1000) * 1000;
    s.cutoff = clamp(v.cutoff ?? s.cutoff, 5, 120, s.cutoff);
    s.share = Math.round(clamp(v.share ?? s.share, 0, 100, s.share));
    if (['all', 'young', 'low', 'long'].includes(v.who)) s.who = v.who;
    if (['core', 'built', 'staten'].includes(v.where)) s.where = v.where;
    if (['tons', 'cars'].includes(v.unit)) s.unit = v.unit;
    return s;
  }
  // Where a new home goes. Core: NYC tracts where under a fifth of workers drive. Built: where NYC has
  // actually added homes. Staten: Richmond County. New homes are apartments unless built like Staten Island.
  function destination(s, D) {
    const T = D.tracts, F = D.factors, w = new Float64Array(T.n);
    for (let i = 0; i < T.n; i++) {
      if (!T.nyc[i] || !T.hh[i]) continue;
      if (s.where === 'core') w[i] = T.drive[i] <= F.coreDriveMax ? T.hh[i] : 0;
      else if (s.where === 'built') w[i] = T.newUnits ? T.newUnits[i] : T.hh[i];
      else w[i] = T.county[i] === '36085' ? T.hh[i] : 0;
    }
    let sw = 0, ft = 0, fh = 0, vmt = 0, land = 0;
    for (let i = 0; i < T.n; i++) if (w[i]) { sw += w[i]; ft += w[i] * T.ft[i]; fh += w[i] * T.fh[i]; vmt += w[i] * T.vmt[i]; land += w[i] * T.land[i] / T.hh[i]; }
    const home = s.where === 'staten' ? fh / sw : F.newApartmentHomeCO2;
    return {w, sw, transport: ft / sw, home, total: ft / sw + home, vmt: vmt / sw, landPerHh: land / sw};
  }
  // Households who could move in: commuters to NYC jobs living outside the city, or in parts of it
  // where at least 35% of workers drive. Jobs become households by dividing by workers per household in that tract.
  function origins(s, D) {
    const T = D.tracts, F = D.factors, cap = new Float64Array(T.n);
    for (let i = 0; i < T.n; i++) {
      if (!T.hh[i] || (T.nyc[i] && T.drive[i] < F.cityOriginDriveMin)) continue;
      const jobs = s.who === 'young' ? T.young[i] : s.who === 'low' ? T.low[i] : s.who === 'long' ? (T.km[i] >= s.cutoff ? T.jobs[i] : 0) : T.jobs[i];
      const wph = Math.max(1, T.workers[i] / T.hh[i]);
      cap[i] = Math.min(T.hh[i], jobs / wph);
    }
    return cap;
  }
  function calculate(state, D) {
    const s = sanitize(state), T = D.tracts, dest = destination(s, D), cap = origins(s, D);
    let pool = 0; for (let i = 0; i < T.n; i++) pool += cap[i];
    const moved = Math.min(s.homes * s.share / 100, pool), share = pool ? moved / pool : 0, n = new Float64Array(T.n);
    let tons = 0, vmt = 0, km2 = 0, gain = 0, loss = 0;
    for (let i = 0; i < T.n; i++) {
      if (!cap[i]) continue;
      n[i] = cap[i] * share;
      const d = T.ft[i] + T.fh[i] - dest.total;
      tons += n[i] * d; vmt += n[i] * (T.vmt[i] - dest.vmt); km2 += n[i] * (T.land[i] / T.hh[i] - dest.landPerHh);
      if (d > 0) gain += n[i]; else loss += n[i];
    }
    const added = new Float64Array(T.n);
    for (let i = 0; i < T.n; i++) if (dest.w[i]) added[i] = moved * dest.w[i] / dest.sw;
    return {s, dest, cap, pool, moved, n, added, tons, perHome: moved ? tons / moved : 0, vmt, acres: km2 * 247.105, worse: loss, better: gain, dollars: tons * D.factors.ll97PricePerTon};
  }
  function fromQuery(q) { return sanitize(Object.fromEntries(new URLSearchParams(q))); }
  function toQuery(s) { return new URLSearchParams(Object.entries(sanitize(s)).map(([k, v]) => [k, String(v)])).toString(); }
  const api = {DEFAULT, PRESETS, sanitize, destination, origins, calculate, fromQuery, toQuery};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Homes = api;
})(typeof window !== 'undefined' ? window : globalThis);

# The Carbon Cost of NYC’s ‘Green’ Rules

[Open the exhibit](https://felix-ab.github.io/econ238-portfolio/nyc-homes/) · [topic claim](https://github.com/RochesterRizzo/Rizzo-Hours/issues/146) · [SHOW ME Museum entry](https://github.com/RochesterRizzo/Rizzo-Hours/issues/148)

Rules sold on environmental grounds, such as environmental review and zoning limits, block homes in New York City. When a home isn't built, a household that would have lived there may end up farther out in the metro area, driving more and heating a bigger house. The exhibit counts only priced-out households:

CO₂ cost = homes blocked × priced-out share × (household CO₂ where it lives now − CO₂ in a new NYC apartment)

Default: 80,000 homes (the city's City of Yes estimate) × 25% priced out (range 10–40%, from moving-chain research: Mast 2023; Bratu et al. 2023) ≈ 122,000 t of CO₂ a year, about $33 million at NYC's Local Law 97 price of $268 a ton.

- `model.js`: pure accounting. Homes blocked, priced-out share, who is priced out (lane), where the blocked home would have been (lane), household CO₂ before and after.
- `js/app.js`: the riso press (tract polygons screened against a Photoshop-made master), zoom and pan, numbered pins, the CO₂-by-commute instrument.
- `data/tracts.json`: 7,150 census tracts within 150 km of Times Square. Fields: NYC-bound jobs by age and earnings (LODES 2023), households, workers, commute mode and housing type (ACS 2020–24), annual household driving (BTS LATCH 2017), and household CO₂ from driving and home energy (EIA RECS 2020, eGRID 2023, EPA).
- `data/factors.json`: constants plus the method, limits and sources shown on the page.
- `data/pins.json`: county facts computed from the same data.
- `data/shed.topo.json`: Census 2023 cartographic tract outlines.

The build script that produces `data/` from the raw sources is `tools/make_site_data.py`.

Preview: `python3 -m http.server 8765` from the portfolio root, then open `http://localhost:8765/nyc-homes/`.

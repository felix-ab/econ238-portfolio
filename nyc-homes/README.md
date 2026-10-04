# The Carbon Cost of a Home Not Built

[Open the exhibit](https://felix-ab.github.io/econ238-portfolio/nyc-homes/)

1.23 million New York City jobs are held by people who live outside the city, and many more by people in its car-dependent edges. If the city built homes for some of those households, how much driving and CO₂ would disappear?

- `model.js`: pure accounting. Who moves (lane), where the home goes (lane), household CO₂ before and after.
- `js/app.js`: the riso press (tract polygons screened against a Photoshop-made master), glass edge, pins, the CO₂-by-commute instrument.
- `data/tracts.json`: 7,150 census tracts within 150 km of Times Square. Fields: NYC-bound jobs by age and earnings (LODES 2023), households, workers, commute mode and housing type (ACS 2020–24), annual household driving (BTS LATCH 2017), and household CO₂ from driving and home energy (EIA RECS 2020, eGRID 2023, EPA).
- `data/factors.json`: constants plus the method, limits and sources shown on the page.
- `data/pins.json`: county facts computed from the same data.
- `data/shed.topo.json`: Census 2023 cartographic tract outlines.

The build script that produces `data/` from the raw sources is `tools/make_site_data.py`.

Preview: `python3 -m http.server 8765` from the portfolio root, then open `http://localhost:8765/nyc-homes/`.

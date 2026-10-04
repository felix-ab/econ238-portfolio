# FOOD-55 · The land on our plates

[Open the exhibit](https://felix-ab.github.io/econ238-portfolio/food-55/)

How much US land does beef use, and how much would swapping it out free, once the replacement has to hit the same per-meal leucine target and cover the same micronutrients?

Static HTML, CSS, SVG and client-side JavaScript. No server.

- `model.js`: pure accounting (per-serving nutrients and land, national scaling).
- `js/app.js`: the live riso press (map), pins, leucine instrument and controls. `css/site.css`: the whole visual system.
- `data/model-inputs.json`: US beef land baseline (Eshel et al. 2014), DRIs by age, sex and life stage (NIH ODS), and leucine targets.
- `data/foods.json`: USDA FoodData Central nutrients (FDC IDs inside) plus Poore & Nemecek 2018 land per 100 g protein.
- `data/grid.json`: half-degree US cells with cattle head (FAO GLW 2010) and maize, soy and pulse physical area (MapSPAM 2010), plus 1° non-US cattle.
- `data/pins.json`: verified factoids for the map pins.
- `assets/print/`: Photoshop-made riso master, paper and pins (see `docs/ASSETS.md`).
- `docs/BUILD-NOTES.md`: method, derivations and limits.

Preview: `python3 -m http.server 8765` from the portfolio root, then open `http://localhost:8765/food-55/`.

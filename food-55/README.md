# FOOD 55 Beef land use dashboard

[Open the interactive design prototype](https://felix-ab.github.io/econ238-portfolio/food-55/)

Static HTML, CSS, SVG and client-side JavaScript. No server or database is required. All assets are local. This is an explicitly labelled design prototype with arbitrary index fixtures, not measured land-use or nutritional findings.

Start with `index.html`, `tokens.css` and `style.css`. Pure scenario arithmetic lives in `model.js`; UI and map rendering in `app.js`. `data/scenario-inputs.json` records every illustrative coefficient. Methods and current limitations appear on the public page.

Read [build notes and open questions](docs/BUILD-NOTES.md) before connecting research data. [Asset provenance](docs/ASSETS.md) and `data/asset-manifest.json` retain licenses, upstream URLs and checksums.

To preview from the portfolio directory:

```sh
python3 -m http.server 8765
```

Visit `http://localhost:8765/food-55/`. JavaScript fetches local JSON, so serve over HTTP rather than opening `index.html` as a file.

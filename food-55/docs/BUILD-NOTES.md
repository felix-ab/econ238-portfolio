# FOOD 55 dashboard build notes

## Current state

A standalone static client-side JavaScript dashboard, inside the existing ECON 238 Pages portfolio at `/food-55/`. It has locally bundled assets, design tokens, an Equal Earth map, procedural ink layers, population/diet sliders, presets, behavior lanes, layer toggles, comparison outlines, zoom, area-unit handling, scenario links, JSON export, an accessible numeric ledger, methodological notes and responsive layout.

This is a **public design prototype**, not a completed research exhibit or empirical result. Its numeric coefficients are arbitrary fixtures. The default “Today / reference” is an index reference, not a measured estimate of current beef acreage. No nutrient adequacy or long-term muscle growth is calculated. The world canvas does not establish a global study scope; the worksheet's initial research population is U.S. consumers.

## First model boundary

Start with agricultural land occupation: beef pasture plus feed cropland, compared with corresponding land for replacement recipes. Treat processing plants, distribution/retail facilities and other infrastructure as a later boundary sensitivity. Include all foods consistently and check the factors' existing boundaries to prevent double counting. Land occupation, emissions, nutrient adequacy and potential restoration remain separate outcomes.

## Geographic honesty

Coastlines use real Natural Earth data; color locations are schematic. Printed patch size is not calibrated acreage. The equal-area projection supports a future geographic data layer, but cannot make conceptual masks into measured land. Never present the current colored cells as ranch locations or actual land released.

For genuine mapped acreage: choose a spatial pasture/crop dataset, attribution of feed land to beef, a reference year, consumption-to-production/import allocation, counterfactual spatial assignment and uncertainty. If only aggregate factors are available, switch to a clearly labelled area-equivalence display or retain the illustrative map with a separate empirical ledger.

The yellow layer means gross avoided *demand*, not restored land. Cyan replacement demand can overprint yellow to explain scenario comparisons; this is not an assertion that replacement crops will be grown on that physical site. Legend layers control display only and never alter the accounting.

## Data integration contract

`model.js` is pure accounting; `app.js` handles controls and drawing. `data/scenario-inputs.json` is the fixture contract. Its status is `illustrative`, `baselineAreaKm2` and time period are null. `areaValue` refuses acres/mi²/km² without a verified baseline. The app intentionally rejects unsupported new input status: research integration must replace the demo accounting, labels and geographic rendering together, rather than simply flip a flag.

Research build inputs need:

1. Geography, consumer population, time period, baseline intake and observed weights.
2. Exact food record IDs, recipes, cooked edible amounts, background day and complete nutrient matrix, including source/form-specific units.
3. Explicit protein/amino-acid and micronutrient constraints by age/life stage/reference sex, realistic energy and serving bounds, bioavailability sensitivity and missing-data flags.
4. Separate appetite/convenience and planned-feasible recipes; no invented prevalence or default equivalence between a population share and a share of beef intake.
5. Environmental factor source/version, production unit, food yield/loss conversion, pasture/cropland distinction and compatible boundaries.
6. Spatial data if used, otherwise a declared non-geographic visualization.
7. Results with reproducible equations, constraint/binding-nutrient diagnostics, uncertainty and provenance.

The illustrative planned-portion multiplier is **not** a nutrition solver. The energy slider affects only replacement portions, not a full-day calorie response. Profile selectors store the requested reference profile but intentionally have no invented numerical effect.

## Design tokens

`tokens.css` centralizes font families, paper/ocean/land colors, ink palette, rules, shadows, spacing and sidebar size. Display and body use Pretendard, an open-source Korean font family; labels use a system monospaced stack. Squared controls, ruled sections, print marks and oversized typography form the original visual language. CSS multiply blending and SVG halftone/grain provide overlapping ink. A flat-ink option, reduced-motion handling, numeric ledger and text descriptions supplement the color display.

## Open questions for Felix

1. **Population:** keep U.S. consumers first (recommended from the worksheet) or expand to a global dietary shift? Decide consumption vs production geography before choosing datasets.
2. **Baseline:** which actual cooked beef meal/cut and background day? The 100 g cooked reference is a comparison unit, not everyone’s daily beef intake.
3. **Replacement recipes:** which tofu/soy product, legume–grain recipe and chicken preparation? Fortification/coagulants and cooking matter.
4. **Nutrient profiles:** which first few comparisons fit a short exhibit? Recommend one adult example plus one relevant older-adult or pregnancy/lactation contrast after appropriate baselines exist.
5. **Map meaning:** actual spatial ranch/feed layers, or an honestly labelled aggregate area comparison if the research only yields totals?
6. **Avoided land:** keep land-use change unspecified first; restoration, rewilding and crop reuse require separate scenarios.
7. **Infrastructure:** retain farm land as primary boundary (recommended), then add consistent processing/retail sensitivity if compatible evidence supports it.
8. **Behavior weights:** use selected sensitivity scenarios until observed population shares and beef-intake distributions are available.

## Publication

Existing repository: `felix-ab/econ238-portfolio`; existing GitHub Pages source: `main`, repository root. No new server, database, paid service or credentials are embedded. Deploy only this exhibit and its portfolio link, not private worksheets, course downloads or scratch outputs. This prototype is not a Museum registration or Blackboard submission.

# FOOD-55 build notes

Research version (2026-10-04). This replaces the earlier design prototype, whose coefficients were placeholders.

## Model

Shift = beef cut x share of Americans taking part.

Baseline beef land = 3,256,000 km². Eshel et al. 2014 (PNAS, doi:10.1073/pnas.1402183111) put US animal-product land at about 3.7 million km². Beef takes about 88% of it: pasture 79 points, processed roughage 7, concentrates 2. Pasture is therefore 79/88 = 89.8% of beef land. The data are 2000–2010 USDA averages, corrected for trade. Cross-check: USDA ERS Major Land Uses 2022 counts 784.1 million acres (3.17 million km²) of grazing land for all livestock.

Per-serving land = protein grams x Poore & Nemecek 2018 global mean land per 100 g protein (OWID series, which matches Data S2 "Mean"). Beef herd 163.6; poultry 7.06; eggs 5.65; other pulses 7.27; tofu 2.20. The P&N medians are about half the means for beef (85.4), so ratios are rough. Beef stays more than 10x any alternative under either figure.

Replacement land = baseline x shift x (plate land / beef-serving land). P&N's beef mean x 2025 US retail beef disappearance (9.18 Mt) gives about 3.0 million km², close to Eshel, so the ratio transfers.

Plate size:
- Appetite lane: same 113 g as the beef. People eat a steady weight of food, not steady calories (Bell, Rolls et al. 1998, AJCN, doi:10.1093/ajcn/67.3.412).
- Muscle lane: each food sized to reach the profile's per-meal leucine target.
- Mix lane: a linear blend of the two.

Leucine targets: 2.5 g for ages up to 50; 3.0 g for 51+.
- Moore et al. 2015 (doi:10.1093/gerona/glu103): 0.40 vs 0.24 g/kg per meal, older vs young.
- Katsanos et al. 2006 (doi:10.1152/ajpendo.00488.2005): about 1.7 g failed in the elderly; about 2.8 g worked.
- Treat 2.5 g as a consensus figure; do not quote it from Norton & Layman.

DRIs: NIH ODS RDAs for protein, iron, zinc, copper, selenium and B12, by age band, sex, pregnancy and lactation. Cobalt has no RDA; people use it only inside B12.

## Map

Equal Earth (equal-area). Dot area = km² x (sphere px² / 510,072,000 km²), so dots are true scale.

How national totals are spread across US 0.5° cells (US mask from Natural Earth 50m):
- Pasture: by cattle head (FAO GLW3 2010, doi:10.7910/DVN/GIVQ75).
- Feed: by maize area.
- Tofu: by soybean area.
- Beans and lentils: by pulse area.
- Chicken and eggs: by maize + soy area.

Crop areas are MapSPAM 2010 physical area (doi:10.7910/DVN/PRFF8V). Grid sanity checks: US cattle 93.5 M, maize 32.9 Mha, soy 30.1 Mha. These match 2010 USDA figures.

Non-US cattle are drawn by head count only, as context. They make no land claim.

## Known limits

- GLW cattle include dairy and feedlot animals. Pasture is therefore over-allocated to feedlot areas.
- About 19% of US beef disappearance (carcass weight) is imported, and its land is abroad.
- Western range is mostly arid. Freed acres are not all farmable acres.
- Processing plants are excluded for every food (small land, and a symmetric boundary).
- The model is single meal, not whole day. DIAAS digestibility is not modelled.

## Open questions for Felix

1. Should we add a beef-factor toggle (P&N mean vs median vs Eshel-implied)?
2. Should we add dairy-herd beef as a separate, lower-land source?
3. Should we weight the appetite and muscle lanes with survey data (e.g. NHANES protein-supplement users)?

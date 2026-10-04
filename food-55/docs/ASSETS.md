# Assets

- **Type.** One typeface: SUIT by Sun-young Sunn (github.com/sun-typeface/SUIT), SIL Open Font License, Reserved Font Name "SUIT". It is served as the unmodified variable file (`assets/fonts/SUIT-Variable.woff2`, licence alongside) on a fluid six-step type scale (`css/site.css`).
- **Design reference.** The layout grammar follows a public style reference for 큰그림컴퍼니 (Bigpicture Company, Seoul), from the DESIGN.md library at github.com/MichelKerkmeester/skilled-agent-harness_spec-driven-loops (`styles/library/bundles/style-eafe33bf`): one press ink, oversized grotesk, bracketed mono captions, 1px hairlines, 20 px cards and a 40 px pill. No studio assets are used, and there is no claim of association.
- **Print assets** (`assets/print/`), all made in Adobe Photoshop 2026 and exported with Photoshop:
  - **`riso-screen.png`**, the riso master: a 512² seamless stochastic threshold map. It combines fine grain, slight clumping, a paper-tooth displace and drift, and is equalized to a uniform histogram.
  - **`paper.webp` and `paper-tooth.png`**, seamless uncoated stock. The source is the ambientCG Paper001 scan (CC0).
  - Map pins were replaced by typographic numbered callouts in the reference pass (below).
- **How the riso print works.** Each data layer is a drum: Fluorescent Pink #FF48B0, Blue #0078BF, Yellow #FFE800 and Black. Coverage is screened at device resolution against the master, and each drum reads it at its own offset. The drums overprint in Multiply over the paper, each nudged a fraction of a pixel off register.
  - **Why Multiply.** Riso ink is translucent, so stacked inks filter light: transmittances multiply (Beer–Lambert). Overlaps darken and gaps show paper. Darken, Linear Burn and Screen don't model overlapping translucent inks.
- **Map data.** Natural Earth coastlines (world-atlas, ISC), FAO GLW3 cattle 2010 and IFPRI MapSPAM 2010 physical area. D3 and topojson-client are ISC-licensed.
- **Scrim.** The figure sits on a light grey top-down scrim, one colour at falling opacity, sized to the readout. An earlier SVG glass edge was removed for speed.
- **Reference pass.** The site stays monochrome; pink, blue and yellow appear only as data ink. Neutral tints are regular halftone dot screens, never greys:
  - the sea, the remainder in sliders and nutrient bars, and the freed land in the stacked bar
  - after an OPEN CALL festival poster and a set of halftone percentage bars
  - shapes take firm ink outlines (coastlines, bars, swatches)
  - places are numbered callouts with square anchors, and the figure sets a heavy number against hairline units, after Hvnter.net's PEOPLE VOL1
  - the land bars stack to 100% with outlined segments and a boxed legend, after a French statistical plate (Paris population, 1801–1962)
  - microtext carries the real sources

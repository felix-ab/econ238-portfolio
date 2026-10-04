# Assets

- **Type.** One typeface: SUIT by Sun-young Sunn (github.com/sun-typeface/SUIT), SIL Open Font License, Reserved Font Name "SUIT". It is served as the unmodified variable file (`assets/fonts/SUIT-Variable.woff2`, licence alongside) on a fluid six-step type scale (`css/site.css`).
- **Design reference.** The layout grammar follows a public style reference for 큰그림컴퍼니 (Bigpicture Company, Seoul), from the DESIGN.md library at github.com/MichelKerkmeester/skilled-agent-harness_spec-driven-loops (`styles/library/bundles/style-eafe33bf`): one press ink, oversized grotesk, bracketed mono captions, 1px hairlines, 20 px cards and a 40 px pill. No studio assets are used, and there is no claim of association.
- **Print assets** (`assets/print/`), all made in Adobe Photoshop 2026 and exported with Photoshop:
  - **`riso-screen.png`**, the riso master: a 512² seamless stochastic threshold map. It combines fine grain, slight clumping, a paper-tooth displace and drift, and is equalized to a uniform histogram.
  - **`paper.webp` and `paper-tooth.png`**, seamless uncoated stock. The source is the ambientCG Paper001 scan (CC0).
  - **`pin.png` and `pin-active-key.png`**, ink-bled map pins in #121212, and in Fluorescent Pink over a misregistered key line.
- **How the riso print works.** Each data layer is a drum: Fluorescent Pink #FF48B0, Blue #0078BF, Yellow #FFE800 and Black. Coverage is screened at device resolution against the master, and each drum reads it at its own offset. The drums overprint in Multiply over the paper, each nudged a fraction of a pixel off register.
  - **Why Multiply.** Riso ink is translucent, so stacked inks filter light: transmittances multiply (Beer–Lambert). Overlaps darken and gaps show paper. Darken, Linear Burn and Screen don't model overlapping translucent inks.
- **Map data.** Natural Earth coastlines (world-atlas, ISC), FAO GLW3 cattle 2010 and IFPRI MapSPAM 2010 physical area. D3 and topojson-client are ISC-licensed.
- **The glass.** The map sits behind curved glass, built as an SVG filter: an edge-bevel displacement map (rounded-rectangle distance field, zero in the middle) refracts the print toward the centre near the rim.
  - **Aberration.** Red, green and blue are displaced at 64 / 54 / 44 px scale, so the aberration grows with the bevel. The per-channel approach follows rdev/liquid-glass-react (MIT).
  - **Blur.** A three-step blur ladder (σ 1.4 / 3.6 / 8) is masked to deeper bands toward the rim.
  - **Fallback.** Chromium and Firefox get the full filter. WebKit gets a CSS backdrop-blur frame without aberration.

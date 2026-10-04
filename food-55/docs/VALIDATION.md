# Prototype validation

Verified locally on 2026-10-04 before publication.

- JavaScript syntax checks passed for the model and application.
- Accounting checks passed for the zero-change reference, full beef removal, zero participation, partial participation and mixed behavior lanes.
- Invalid URL inputs clamp to declared ranges; scenario URLs preserve the selected state.
- Acres, square miles and square kilometres remain unavailable for illustrative data; unit conversion helper checked independently against known constants.
- Browser preset controls update the metric, ledger and four map layers. Toggling layer visibility leaves numerical accounting unchanged.
- Copying and reopening a scenario link restores its values.
- Downloaded JSON preserves the illustrative-data warning, source assumptions and null area.
- Desktop and full-page mobile screenshots visually inspected; no horizontal overflow at 1440, 390 or 320 pixels.
- Browser console was free of errors/warnings on the initial interactive load; local HTML references and unique IDs checked.

These checks verify software behavior and presentation. They do not validate the arbitrary land ratios, population assumptions, nutritional feasibility or patch geography.

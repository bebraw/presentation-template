# Technical Notes

This document contains the development-facing details for the presentation template repository.

For the system-level view of how build, rendering, validation, and archival fit together, see [ARCHITECTURE.md](ARCHITECTURE.md).
For future packaging thoughts about the runtime layer, see the "Future Option: Extract A Runtime Package" section in [ARCHITECTURE.md](ARCHITECTURE.md).

## Usage

Install dependencies:

```bash
npm install
```

Build the presentation:

```bash
npm run build
```

Run layout and text validation:

```bash
npm run validate
```

Run the full validation suite, including render validation:

```bash
npm run validate:all
```

Run the project quality gate used after changes:

```bash
npm run quality:gate
```

Refresh the committed render baseline after intentionally changing the deck design:

```bash
npm run baseline:render
```

If you add presentation diagrams or other deck graphics, author them as Graphviz `.dot` files in `slides/assets/diagrams/`. The build regenerates sibling `.png` files automatically through `npm run build:diagrams`, and validation rejects generated diagram PNGs that do not have matching `.dot` sources.

## Development Layout

- `slides/slide-01.js` to `slides/slide-04.js` hold the demo deck content.
- `generator/` holds the build, rendering, and validation runtime.
- `skills/pdf-slide-generator/SKILL.md` contains the deck-generation workflow guidance.
- `skills/slide-clarity-drill/` contains the wording-tightening skill used for line-by-line slide copy refinement.
- `archive/demo-presentation.pdf` stores the checked-in PDF snapshot for linking and archival.

## Project Structure

```text
.
├── archive/
│   └── demo-presentation.pdf
├── ARCHITECTURE.md
├── generator/
│   ├── compile.js
│   ├── deck.js
│   ├── helpers.js
│   ├── output-config.js
│   ├── pdf-renderer.js
│   ├── references.js
│   ├── render-baseline/
│   ├── render-diagrams.js
│   ├── render-utils.js
│   ├── text-metrics.js
│   ├── theme.js
│   ├── update-render-baseline.js
│   ├── validate-geometry.js
│   ├── validate-render.js
│   ├── validate-text.js
│   └── validation.js
├── package.json
├── README.md
├── TECHNICAL.md
├── skills/
│   ├── pdf-slide-generator/
│   │   └── SKILL.md
│   └── slide-clarity-drill/
│       ├── agents/
│       │   └── openai.yaml
│       └── SKILL.md
└── slides/
    ├── assets/
    │   └── diagrams/
    ├── output/
    ├── slide-01.js
    ├── slide-02.js
    ├── slide-03.js
    └── slide-04.js
```

## Notes

- Slide content lives in `slides/`, while the build and validation runtime lives in `generator/`.
- Diagram graphics in `slides/assets/diagrams/` must come from Graphviz `.dot` sources; do not hand-maintain the generated PNGs.
- The production build path renders PDF directly through `pdfkit`.
- The deck uses `Avenir Next` for both display and body text.
- `slides/output/` is git-ignored, so generated binaries stay local.
- `archive/demo-presentation.pdf` stores the checked-in PDF snapshot for linking and archival.
- `generator/render-baseline/` stores the approved render baseline for the current deck output.
- `npm run quality:gate` runs geometry/text validation before checking the generated PDF against the approved render baseline.
- If you extend the deck, duplicate an existing slide module and add it to `generator/deck.js`.

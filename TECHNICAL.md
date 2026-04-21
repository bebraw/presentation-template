# Technical Notes

This document contains the development-facing details for the presentation template repository.

For the system-level view of how build, rendering, validation, and archival fit together, see [ARCHITECTURE.md](ARCHITECTURE.md).

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

## Development Layout

- `slides/slide-01.js` to `slides/slide-04.js` hold the demo deck content.
- `generator/` holds the build, rendering, and validation runtime.
- `skills/pdf-slide-generator/SKILL.md` contains the imported skill guidance.
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
│   ├── render-utils.js
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
│   └── pdf-slide-generator/
│       └── SKILL.md
└── slides/
    ├── output/
    ├── slide-01.js
    ├── slide-02.js
    ├── slide-03.js
    └── slide-04.js
```

## Notes

- Slide content lives in `slides/`, while the build and validation runtime lives in `generator/`.
- The production build path renders PDF directly through `pdfkit`.
- The deck uses `Avenir Next` for both display and body text.
- `slides/output/` is git-ignored, so generated binaries stay local.
- `archive/demo-presentation.pdf` stores the checked-in PDF snapshot for linking and archival.
- `generator/render-baseline/` stores the approved render baseline for the current deck output.
- `npm run quality:gate` checks the generated PDF against that baseline and is the required final validation for presentation changes.
- If you extend the deck, duplicate an existing slide module and add it to `generator/deck.js`.

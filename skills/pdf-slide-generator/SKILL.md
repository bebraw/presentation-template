---
name: pdf-slide-generator
description: "Create and maintain this repository's presentation deck as native PDF output. Use when work involves slide content, deck structure, visual assets, generator runtime, render baselines, or validation for presentations, slides, decks, demos, or speaker materials."
license: MIT
metadata:
  version: "2.0"
  category: productivity
---

# PDF Slide Generator

Use this skill for presentation work in this repository.

## Scope

- Slide content lives in `slides/`.
- Build, rendering, and validation runtime lives in `generator/`.
- Primary output is `slides/output/demo-presentation.pdf`.
- Checked-in archive snapshot is `archive/demo-presentation.pdf`.
- Approved render baseline lives in `generator/render-baseline/`.

## Default Workflow

1. Determine whether the change belongs in slide content (`slides/`) or runtime/validation (`generator/`).
2. Reuse existing runtime helpers instead of introducing parallel slide infrastructure.
3. Build with `npm run build`.
4. If the visible output changed intentionally, refresh the baseline with `npm run baseline:render`.
5. Finish by running `npm run quality:gate`.

Do not consider presentation work done unless `npm run quality:gate` passes.

## Editing Rules

- Keep one file per slide module, following the existing naming pattern such as `slides/slide-05.js`.
- Prefer updating the existing design system in `generator/theme.js` and `generator/helpers.js` over slide-local style drift.
- Author deck diagrams and related graphics as Graphviz `.dot` sources under `slides/assets/diagrams/`; let the build regenerate the sibling PNGs.
- Do not hand-edit generated diagram PNGs or check in diagram PNGs without matching `.dot` sources.
- Put non-Graphviz presentation images in `slides/imgs/`.
- Keep generated artifacts in `slides/output/`.
- Treat `archive/demo-presentation.pdf` as a release snapshot. Update it only when the user asks for the archival copy to be refreshed.

## Validation Rules

- `npm run build` must produce the PDF successfully.
- `npm run build:diagrams` is the required path for refreshing Graphviz-authored graphics.
- `npm run quality:gate` is the required final validation.
- If slide visuals change intentionally, update `generator/render-baseline/` with `npm run baseline:render` before rerunning the gate.
- If `quality:gate` fails, fix the deck or baseline mismatch instead of bypassing the check.

## Structural Guidance

- Add new build or validation logic under `generator/`.
- Add new content slides under `slides/`.
- Keep slide modules dependent on shared generator utilities rather than duplicating helpers.
- If the deck order changes, update `generator/deck.js`.

## Output Expectations

- Preserve the existing deck voice and visual language unless the user asks for a redesign.
- Optimize for a clean rendered PDF, not for PPTX compatibility.
- Keep documentation aligned with the current structure when scripts, directories, or validation commands change.

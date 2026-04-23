# Browser Studio Roadmap

This document turns the browser-app MVP discussion into a concrete implementation roadmap for this repository.

The goal is to build a local browser-based presentation studio that reduces typing, codifies common flows, improves context handling, and shortens the iteration loop while keeping the existing deck generator as the source of truth.

## Product Intent

The browser studio should make these flows faster and more repeatable:

- ideate a theme
- ideate a presentation structure
- ideate or rewrite a slide
- drill wording line by line
- retry or redo layout
- generate slide variants
- compare alternatives visually
- validate changes before keeping them

This is not a PowerPoint replacement and not a full WYSIWYG editor in the MVP.

## Core Principle

Keep the current deck engine as the source of truth.

The app should wrap the existing runtime rather than replace it:

- [`generator/deck.js`](./generator/deck.js) remains the composition point
- [`generator/compile.js`](./generator/compile.js) remains the main PDF build path
- [`generator/render-utils.js`](./generator/render-utils.js) remains the page-rendering utility
- validation continues to reuse the existing geometry, text, and render checks under [`generator/`](./generator)

The studio is a control plane around the current generator, not a second rendering system.

## Target Outcome

By the end of the MVP, the repository should include a local browser app that:

- shows real slide previews generated from the current deck
- stores reusable deck and slide context
- exposes common workflows as explicit actions
- supports safe slide variants and compare/apply flow
- runs the current validation flow and reports the result clearly

## Architecture

Build the studio as two parts:

- `studio/server`: a Node backend that edits files, runs the build and validation pipeline, and exposes workflow APIs
- `studio/client`: a browser UI for previews, context, operations, variants, and validation feedback

Recommended stack:

- frontend: React + Vite
- backend: small Node HTTP server

This keeps frontend iteration fast without requiring the existing CommonJS generator code to be refactored immediately.

## UX Shape

The MVP should use a three-pane layout:

- left pane: workflow actions and conversational controls
- center pane: deck preview, current slide preview, and visual diff
- right pane: structured deck and slide context

Top-level app status should always show:

- current slide
- build status
- validation status
- latest operation outcome

## Phase Plan

### Phase 1: Studio Shell And Runtime Bridge

Objective: establish the browser app shell and connect it to the current generator runtime.

Implementation:

- create `studio/server/` with server entrypoint, route registration, and task runner modules
- create `studio/client/` with the initial three-pane shell
- add root scripts in [`package.json`](./package.json) for:
  - `studio:dev`
  - `studio:build`
  - `studio:start`
- implement backend wrappers for:
  - `buildDeck()`
  - `renderDeckPages()`
  - `validateDeck()`

Acceptance criteria:

- opening the browser app shows the current deck state
- the app can trigger a real deck build
- the app can report whether the last build succeeded or failed

### Phase 2: Preview And Status Pipeline

Objective: make the app preview-first so every meaningful change can be judged visually.

Implementation:

- add backend endpoints:
  - `POST /api/build`
  - `GET /api/preview/deck`
  - `GET /api/preview/slide/:index`
  - `POST /api/validate`
- store preview PNGs in a studio-local cache directory rather than in committed baseline directories
- show deck thumbnails in a rail and a focused slide preview in the main pane
- surface build and validation errors as structured UI messages rather than raw terminal output

Acceptance criteria:

- one action rebuilds the deck and refreshes previews
- users can inspect the whole deck or one slide
- users can see build and validation failures in the UI

### Phase 3: Persistent Context Model

Objective: stop retyping the same presentation intent over and over.

Implementation:

- add a repo-local state directory such as `studio/state/`
- add a persisted deck context file such as `studio/state/deck-context.json`
- store:
  - deck brief
  - audience
  - objective
  - tone
  - constraints
  - theme brief
  - outline
  - per-slide intent
  - per-slide notes
  - per-slide layout hints
- build a right-hand context editor in the browser app

Acceptance criteria:

- deck and slide context survive reloads
- operations can use stored context as inputs
- context editing does not require touching slide source files directly

### Phase 4: Structured Workflow Operations

Objective: replace repeated freeform prompting with explicit high-value actions.

Initial operations:

- `Ideate Theme`
- `Ideate Structure`
- `Ideate Slide`
- `Drill Wording`
- `Redo Layout`
- `Generate Variants`

Implementation:

- define each operation in backend code with:
  - required inputs
  - allowed file targets
  - expected output shape
  - rebuild requirement
- map wording-tightening behavior to the existing `slide-clarity-drill` workflow
- for the MVP, operation handlers should generate file edits against `slides/` and `generator/`, then rebuild previews

Acceptance criteria:

- each operation can be run from the UI
- each operation produces a previewable result
- operation inputs come primarily from stored context rather than ad hoc typing

### Phase 5: Slide Variant System

Objective: make experimentation safe and visual instead of destructive.

Implementation:

- add `studio/state/variants.json`
- record, per variant:
  - slide id
  - variant label
  - prompt or attempt summary
  - generated patch or content payload
  - preview image path
  - creation timestamp
- do not overwrite the main slide file when generating variants
- add a compare view that shows the current slide alongside 2-3 generated alternatives
- add `Apply Variant` to promote one chosen variant into the working slide file and rebuild

Acceptance criteria:

- users can generate alternatives without losing the current slide
- users can compare variants visually
- users can apply one chosen variant safely

### Phase 6: File Editing Boundary

Objective: keep write behavior predictable and auditable.

Implementation:

- centralize repo edits in one backend editing module
- restrict MVP write targets to:
  - `slides/slide-*.js`
  - [`generator/deck.js`](./generator/deck.js)
  - [`generator/theme.js`](./generator/theme.js)
  - `studio/state/*`
- add a dry-run mode for higher-risk operations such as theme and structure changes

Acceptance criteria:

- every operation has a clear write surface
- risky edits can be previewed before being applied
- the app does not make uncontrolled changes across the repo

### Phase 7: Validation And Diff UX

Objective: preserve the repository's guardrails inside the studio workflow.

Implementation:

- show geometry, text, and render validation status separately
- add a lightweight change summary view showing:
  - changed slide previews
  - changed files
  - validation result before and after
- keep render validation as an explicit action if it is too slow for every operation
- keep geometry and text checks easy to run after each meaningful change

Acceptance criteria:

- users can tell whether a change is acceptable visually
- users can tell whether a change broke the current gate
- validation feedback is understandable without reading raw logs

### Phase 8: First End-To-End Milestone

Objective: prove the workflow on one real vertical slice before expanding scope.

Target slice:

1. edit slide context in the app
2. run `Ideate Slide`
3. generate 2-3 layout variants
4. preview the results
5. apply one result
6. run validation

Exit condition:

- this flow feels materially faster than the current prompt-and-file-edit path
- the variant system is usable
- the preview loop is tight enough to justify continuing

If this slice feels clumsy, fix the operation model before adding more features.

## Proposed Directory Layout

```text
studio/
  client/
    src/
      App.jsx
      components/
      lib/
      pages/
  server/
    index.js
    routes/
    services/
      build.js
      preview.js
      validate.js
      operations.js
      edit-files.js
  state/
    deck-context.json
    variants.json
```

## API Plan

Initial backend routes:

- `POST /api/build`
- `POST /api/validate`
- `GET /api/preview/deck`
- `GET /api/preview/slide/:index`
- `POST /api/theme/ideate`
- `POST /api/outline/ideate`
- `POST /api/slide/ideate`
- `POST /api/slide/drill`
- `POST /api/slide/layout-variants`
- `POST /api/variant/apply`

These routes should operate on repo state and app state, then return structured results suitable for UI updates.

## Delivery Order

Implement in this order:

1. scaffold `studio/server` and `studio/client`
2. bridge backend build and preview to the existing generator
3. build the preview-first UI shell
4. add persistent deck and slide context
5. implement `Ideate Slide` and `Drill Wording`
6. implement variant generation and compare/apply
7. implement theme and outline operations
8. tighten validation, diffs, and error handling

## Main Risks

- full-deck rebuild latency may make the app feel slower than intended
- unrestricted file writing will make variants and rollback messy
- a generic chat UI without structured actions will recreate the current typing overhead instead of solving it
- building a full visual editor too early will fight the current code-first generator model

## MVP Definition Of Done

The MVP is done when all of the following are true:

- the app runs locally in the browser
- it shows deck and slide previews generated from the real deck engine
- it stores reusable deck and slide context
- it supports at least:
  - `Ideate Slide`
  - `Drill Wording`
  - `Redo Layout`
  - `Generate Variants`
- it can apply one chosen result back into the repo
- it can run the current validation flow and present the result clearly

## Recommended First Build Slice

The first implementation slice should be intentionally narrow:

- one backend route to build and preview the current deck
- one browser view showing slide thumbnails and focused preview
- one persistent slide-context editor
- one `Ideate Slide` operation for a single slide
- one compare/apply variant flow

If that slice works well, expand into theme and structure operations next.

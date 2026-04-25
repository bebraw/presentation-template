# ADR 0009: Graph-Style Presentations

## Status

Proposed implementation plan.

## Context

Linear decks and two-dimensional detours both assume there is still one privileged path through the presentation. That works for most talks, but it does not cover presentations that must branch based on audience choice, time, role, scenario, or outcome.

Some presentations are closer to guided decision trees:

- workshop decks that ask the room to choose a topic
- sales or demo decks that branch by customer need
- training decks that branch by skill level or role
- interactive story or "choose your own adventure" decks
- facilitation decks that route to different follow-up material depending on discussion outcome

slideotter already treats structure as explicit data instead of only file order. ADR 0007 adds a browser presentation surface, and ADR 0008 adds structured vertical detours. The next logical extension is to allow presentations whose navigation graph can branch into multiple valid next slides.

This should stay compatible with the existing structured-slide model, DOM renderer, validation approach, and review-before-apply workflow. The graph behavior should come from deck navigation metadata, not from custom per-slide scripting.

## Decision

Support graph-style presentations as an explicit deck-navigation model.

A graph-style presentation has:

- stable slide ids
- one declared start slide
- zero or more directed transitions from each slide to other slides
- optional labels or conditions describing why a transition exists
- at least one default forward path so normal presentation flow remains deterministic

The first implementation should support branching from the current slide to a small number of named next-slide options. It should not allow arbitrary executable logic, freeform scripting, or hidden runtime mutation of deck structure.

The intended use is to let presenters move through prepared branches while keeping the deck inspectable, validated, and authorable inside the same structured browser studio.

## Deck Model

The deck should carry explicit navigation metadata rather than inferring graph structure from filenames or only from slide order.

An example shape:

```json
{
  "navigation": {
    "mode": "graph",
    "startSlideId": "slide-01",
    "edges": [
      {
        "from": "slide-03",
        "to": "slide-04-basic",
        "label": "Basic path",
        "kind": "branch"
      },
      {
        "from": "slide-03",
        "to": "slide-04-advanced",
        "label": "Advanced path",
        "kind": "branch"
      },
      {
        "from": "slide-04-basic",
        "to": "slide-05",
        "kind": "default-next"
      }
    ]
  }
}
```

The exact storage shape can change, but the model should preserve:

- stable slide ids
- one explicit start slide
- directed edges between slides
- a transition kind such as `default-next`, `branch`, or `return`
- optional presenter-facing labels for branch choices
- deterministic ordering for branch options
- compatibility with skipped-slide behavior and validation

Slides remain normal structured slides. The graph only changes navigation, not the rendering or content schema of a slide.

## Presentation Behavior

Graph presentations should run inside the same browser presentation surface introduced in ADR 0007.

The first presentation-mode behavior should stay simple:

- `ArrowRight`, `PageDown`, and `Space` follow the current slide's default next edge
- `ArrowLeft` and `PageUp` return to the previous visited slide in presenter history
- when a slide has branch edges, the presenter can open a lightweight branch chooser and select one of the available next paths
- once a branch is chosen, navigation proceeds from that chosen slide

This means graph mode should track both:

- the navigation graph declared by the deck
- the actual visited history of the current run

History matters because there may be multiple valid parents for a slide, so "previous slide" should mean the slide the presenter actually came from, not an inferred structural parent.

## Branch Selection

Branch choice should be explicit in the presentation UI.

The first version should use a minimal chooser rather than always-visible chrome:

- if the current slide has more than one branch edge, presentation mode can show a compact branch menu on demand
- numeric keys or a small temporary overlay can select among branch labels
- branch options should be readable and ordered consistently

The first version should not require clickable hotspots inside the slide body, embedded hyperlinks, or free-positioned navigation buttons authored inside slide content.

## Studio Authoring Rules

The studio should make graph structure inspectable and editable without turning normal deck authoring into a node-editor first.

The first authoring slice can be modest:

- show outgoing edges for the selected slide
- let authors add, remove, relabel, and reorder branch edges
- let authors mark one edge as the default next path
- show incoming references so shared branch targets are visible
- warn when a slide becomes unreachable from the declared start slide

For graph-heavy decks, a separate graph overview is reasonable. But the first implementation does not need a full visual node editor if an outline-plus-edge inspector can express the structure clearly.

## Semantic Generation

Graph branching should fit slideotter's semantic planning model instead of bypassing it.

Generation may propose graph branches when:

- the deck is explicitly framed as interactive or choice-driven
- the user asks for audience-selectable paths
- the presenter needs alternate next steps for different roles, constraints, or outcomes
- the material naturally splits into mutually exclusive or optional continuations

Generation should not create branching by default for ordinary presentations. The default assumption remains that most decks are linear or two-dimensional.

## Export And Compatibility

Existing linear decks and two-dimensional decks remain valid.

- a linear deck is a graph with one start slide and one deterministic next path
- a two-dimensional deck can later be represented as a constrained graph shape if that helps unify runtime handling

PDF export should stay simple in the first version:

- export the default path by default
- optionally support enumerating alternate branches later

The first graph implementation is primarily for browser presentation mode, not for fully preserving branching behavior in PDF form.

## Validation

Validation should cover graph structure as well as rendered output.

Required checks:

- exactly one valid start slide exists
- every edge points to an existing non-archived slide
- default-next ordering is deterministic
- branch options are ordered and labeled when multiple choices exist
- no visible slide is unreachable from the start slide unless explicitly marked as detached or draft-only
- skipped slides invalidate or hide edges that point to them
- presentation mode can follow default-next edges and branch selection without dead ends

Rendered graph slides should still pass the same text, geometry, media, spacing, and contrast validation as any other structured slide.

## Non-Goals

- no arbitrary executable branching logic
- no authored JavaScript inside slide content
- no freeform canvas node editor in the first version
- no requirement that every branch be exportable to one PDF in the first slice
- no multiplayer audience voting or synchronized remote branch control
- no replacement of the simpler linear and two-dimensional models for ordinary decks

## Implementation Plan

1. Add graph navigation metadata.
   Extend deck state with a navigation model that can describe a start slide and directed edges between slides.

2. Add authoring controls for edges.
   Let authors inspect and edit outgoing transitions for the selected slide, including labels and the default next path.

3. Extend presentation mode with branch selection.
   Keep default next/previous keyboard flow, but add a compact chooser for selecting among branch edges.

4. Track visited history.
   Make previous-slide navigation follow the actual run history rather than only the static graph.

5. Add structure validation.
   Catch unreachable slides, broken edges, missing defaults, and skipped-slide edge problems before treating a graph deck as ready.

6. Add fixtures.
   Add at least one choose-your-own-adventure style deck fixture and validate branch selection plus history-aware backtracking.

## Open Questions

- Should graph mode be a separate deck-level navigation mode, or should linear and two-dimensional decks also be normalized internally to the same graph model?
- What is the smallest acceptable branch chooser for the first presentation-mode implementation: numeric overlay, temporary side panel, or inline control strip?
- Should branch labels be required whenever a slide has more than one outgoing branch edge?
- How should skipped slides interact with incoming edges: remove those edges automatically, or keep them as invalid until the author resolves them?

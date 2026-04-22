# presentation-template

This repository contains a small demonstration presentation built around the imported `pdf-slide-generator` skill.

## Demo deck

- Archived PDF: `archive/demo-presentation.pdf`
- Current local PDF build: `slides/output/demo-presentation.pdf`

The demo presentation is a four-slide starter deck:

- Cover
- Outline
- Content with implementation signals
- Summary / next steps

## Development

Build, validation, repository structure, and generator details are documented in [TECHNICAL.md](TECHNICAL.md).
The higher-level system design and runtime flow are documented in [ARCHITECTURE.md](ARCHITECTURE.md).
For presentation changes, run `npm run quality:gate` before considering the work done. It now runs geometry/text validation before the render-baseline check.

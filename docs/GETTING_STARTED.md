# Getting Started

This guide covers the tools you need installed and the shortest path to running slideotter locally.

## Hard Dependencies

Install these before working with the project:

- Node.js 24 and npm
- Graphviz, including the `dot` command
- Playwright Chromium browser dependencies

The project also uses npm packages with native binaries, including `sharp`, `@napi-rs/canvas`, and Playwright. `npm install` installs the JavaScript dependencies, but Playwright may still need its browser runtime installed for your machine.

## Install System Tools

macOS with Homebrew:

```bash
brew install graphviz
```

Install Node 24 with your preferred version manager, or use Homebrew's `node@24` formula if that matches your local setup.

Linux:

```bash
sudo apt-get update
sudo apt-get install -y graphviz
```

If you already manage Node with `nvm`, `fnm`, `asdf`, or another version manager, use that instead of installing Node through the system package manager. The important part is running Node 24.

Check the tools:

```bash
node --version
npm --version
dot -V
```

## Install Project Dependencies

From the repository root:

```bash
npm install
```

This also configures the repo-managed Git hooks in `.githooks/`.

Install the Playwright browser runtime:

```bash
npx playwright install chromium
```

On Linux, include the browser system dependencies:

```bash
npx playwright install --with-deps chromium
```

## Run The Studio

```bash
npm run studio:start
```

Open:

```text
http://127.0.0.1:4173
```

The standalone deck preview is available while the studio server is running:

```text
http://127.0.0.1:4173/deck-preview
```

## Common Commands

Build the active presentation PDF:

```bash
npm run build
```

Run the fast deterministic quality gate:

```bash
npm run quality:gate:fast
```

Run the full quality gate, including render-baseline validation:

```bash
npm run quality:gate
```

Refresh the approved render baseline after an intentional visual change:

```bash
npm run baseline:render
```

Update the checked-in archive PDF for the active presentation:

```bash
npm run archive:update
```

Refresh the README screenshot:

```bash
npm run screenshot:home
```

## Optional Tools

Docker is only needed if you want to run the GitHub Actions workflow locally through Agent CI:

```bash
npm run ci:local
```

LLM providers are optional. Without provider credentials, the studio uses local deterministic generation rules. See [DEVELOPMENT.md](../DEVELOPMENT.md) for OpenAI and LM Studio setup.

## Generated Files

- `slides/output/<presentation-id>.pdf` is generated locally and ignored by Git.
- `studio/output/` holds local preview and validation artifacts.
- `studio/baseline/<presentation-id>/` stores checked-in render-baseline PNGs.
- `archive/<presentation-id>.pdf` stores checked-in archive snapshots.

# ChatGPT Speed Trim

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)

ChatGPT Speed Trim is a browser extension for Chrome and Brave that keeps long ChatGPT threads responsive by trimming rendered history while preserving conversation flow.

## Highlights

- Faster UI on very long threads by reducing active DOM load.
- Runtime controls directly in the page to load older parts when needed.
- Popup settings with live render stats.
- Typed storage and migration-safe settings model.
- Clean TypeScript codebase with unit tests.

## Installation (local)

1. Install dependencies.

	npm install

2. Build the extension.

	npm run build

3. Open extensions page.

	chrome://extensions or brave://extensions

4. Enable Developer mode.
5. Click Load unpacked.
6. Select this repository root (folder containing manifest.json).

## Development

Build:

	npm run build

Watch mode:

	npm run watch

Tests:

	npm test

## Project Structure

- manifest.json: extension metadata and permissions.
- scripts/build.mjs: build and watch pipeline.
- src/popup.html and src/popup.css: popup shell and styles.
- src/background/index.ts: service worker entry.
- src/content/index.ts: content script orchestration.
- src/page/main.ts: main-world bootstrap.
- src/page/trim/trimConversation.ts: trimming engine.
- src/shared: shared constants, schema, storage, migrations.
- tests: unit tests.

## How It Works

1. The main-world script observes conversation-related payloads.
2. The trim engine determines what can be removed from active rendering.
3. UI controls keep older content recoverable on demand.
4. Preferences are persisted via typed storage with migration support.

## Roadmap

- Add integration and end-to-end tests with realistic payload fixtures.
- Add benchmark scenarios for large-thread performance comparisons.
- Improve diagnostics around trim decisions.

## Contributing

1. Create a branch.
2. Make your changes.
3. Run build and tests.
4. Open a pull request with context and screenshots when UI changes are involved.

## License

MIT License. See LICENSE.

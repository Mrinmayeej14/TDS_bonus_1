# LeafAI — Lightweight LLM Agent (Vanilla JS, ESM)

LeafAI is a minimal, client‑side LLM assistant with a modern emerald-themed UI, built using plain HTML/CSS/JavaScript and ES Modules. No bundlers or build steps required.

## Features

- Clean, responsive UI with deep emerald palette and dark-first theme
- Chat interface with message history and quick actions
- Drag-and-drop support for files (stubs available for processing)
- Command bar and context-menu wiring
- Markdown rendering and code highlighting (via renderer path)
- Modular code structure with clear separation of concerns
- Runs as a static site (ESM-friendly), deployable on Vercel

## Project Structure

```javascript
.
├─ index.html                # App shell (loads ES module entry)
├─ style.css                 # LeafAI emerald theme + layout
├─ agent.js                  # App class bootstrap; delegates to modules
├─ src/
│  ├─ main.js                # ES module entry (imports agent.js)
│  ├─ constants.js           # DEFAULTS, TOOLS, UI_STRINGS
│  ├─ services/
│  │  └─ llm.js              # LLM calls and response parsing
│  ├─ ui/
│  │  ├─ renderer.js         # DOM rendering, toasts, perf display
│  │  └─ events.js           # Event wiring (send, toolbar, DnD, etc.)
│  └─ utils/
│     └─ helpers.js          # debounce, preventDefaults
├─ README.md
├─ LICENSE
```

## Quick Start (Local)

Requirements:

- Modern browser supporting ES Modules
- Any static HTTP server (files must be served over http(s), not via file://)

Start a simple server on port 5173:

```javascript
python3 -m http.server 5173
```

Then open:

```javascript
http://localhost:5173
```

Notes:

- index.html uses type="module" to load src/main.js (which imports agent.js). Serving over HTTP is required for modules to load correctly.

## Usage

- Open the app and use the Settings panel to choose your provider and enter an API key (if required).
- Type a prompt and press Enter or click Send.
- Use quick actions and the command bar to accelerate common tasks.
- Drag-and-drop a file into the window to trigger the file handling flow (processing stubs included).

## Configuration

- Default UI and model settings live in src/constants.js (DEFAULTS).
- Provider/API settings are configurable at runtime via the UI settings panel.
- Avoid committing API keys. Client-side keys are visible to end users—use a server proxy in production to keep keys secret.

## Deployment (Vercel)

You can deploy this static site with Vercel in seconds.

1. Install Vercel CLI (if not installed):

```javascript
npm i -g vercel
```

2. From the project root:

```javascript
vercel
```

Follow the prompts to create a preview deployment.

3. When ready to go live:

```javascript
vercel --prod
```

Optional vercel.json for static behavior:

```json
{
  "cleanUrls": true,
  "trailingSlash": false
}
```

## Security Notes

- Do not embed secrets in client-side code.
- For production, proxy LLM requests through a server to protect API keys and apply rate limiting and logging.
- Sanitize all user-rendered content to prevent XSS.

## Roadmap

- Add DOMPurify to sanitize markdown/code rendering
- Add AbortController with retry/backoff around LLM fetches
- Minimal PWA: manifest.json + sw.js with cache strategy
- Optional: tests, linting, CI

## License

See LICENSE for details.

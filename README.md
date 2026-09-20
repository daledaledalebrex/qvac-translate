# Cebuano ⇄ Tagalog Offline Translator

A small web app that translates between **Cebuano (Bisaya)** and **Tagalog (Filipino)** — a low-resource language pair — running entirely on-device using [QVAC](https://github.com/tetherto/qvac), Tether's open-source local-AI SDK.

No cloud API, no usage bill, no internet required after the model is downloaded once. Your text never leaves your machine.

## Why an LLM instead of a dedicated translation model?

QVAC ships fast, purpose-built NMT engines (Bergamot, IndicTrans), but neither covers Cebuano↔Tagalog — Bergamot is European-language-focused and IndicTrans covers Indian languages. So this app takes the more flexible route: it loads a small multilingual instruction model (`QWEN3_1_7B_INST_Q4`) through QVAC and prompts it to translate. This works for language pairs that don't have a dedicated NMT model, at the cost of being slower than a real NMT engine.

Translation quality reflects how well the base model was trained on Cebuano, which has far less written data online than Tagalog — expect it to be good for everyday sentences and rougher on idioms or technical text. That gap is exactly why offline, community-driven tools for low-resource languages like this are worth building.

## How it works

1. An Express server starts and calls `loadModel()` from `@qvac/sdk`, which downloads the model on first run (cached locally after that) and loads it into memory.
2. The browser UI sends the text you type, plus a direction (`ceb → tl` or `tl → ceb`), to a `/api/translate` endpoint.
3. The server builds a translation prompt and calls `completion()` on the loaded model, entirely locally.
4. The translation is sent back and shown in the output box.

## Requirements

- [Node.js](https://nodejs.org/) 18 or later
- ~2–3 GB free disk space for the model (downloaded once, cached afterward)
- No GPU required — this runs fine on CPU, though a GPU will speed it up

This app uses `@qvac/bare-sdk` with only the LLM plugin registered, instead of the full `@qvac/sdk`. The full SDK's default worker loads every built-in addon (ASR, TTS, OCR, etc.) at startup, and some of those have native dependencies (e.g. the ASR addon needs Vulkan) that many containers — including plain GitHub Codespaces — don't ship. Registering just the LLM plugin avoids touching those addons entirely, so this runs cleanly in minimal/CI environments as well as on a full desktop.

## Setup

```bash
git clone <this-repo-url>
cd qvac-ceb-tl-translator
npm install
npm start
```

Then open **http://localhost:3000**.

On first run, the app downloads the model in the background — the status banner at the top of the page shows progress. This only happens once; subsequent runs load instantly from the local cache.

## Usage

1. Wait for the status banner to say "Model loaded — translating fully offline on this device."
2. Type Cebuano (or Tagalog) text into the input box.
3. Click **Translate**.
4. Use the ⇄ button to swap directions.

## Project structure

```
.
├── server.js          # Express server + QVAC SDK integration
├── public/
│   ├── index.html     # UI
│   ├── style.css
│   └── app.js          # Frontend logic (polling, translate calls)
├── package.json
└── LICENSE
```

## Tech

- [`@qvac/sdk`](https://www.npmjs.com/package/@qvac/sdk) — on-device model loading and inference
- Express — thin local web server
- Vanilla HTML/CSS/JS frontend, no build step

## Limitations

- Translation quality depends on the base model's Cebuano coverage, which is more limited than Tagalog. Treat this as a helpful draft, not a certified translation.
- The first launch requires an internet connection to download the model; every launch after that is fully offline.

## License

MIT — see [LICENSE](./LICENSE). Built on top of the open-source [QVAC SDK](https://github.com/tetherto/qvac) (Apache 2.0).

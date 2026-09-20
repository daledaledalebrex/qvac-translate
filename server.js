// server.js
//
// Offline Cebuano <-> Tagalog translator powered by the QVAC SDK.
//
// Cebuano-Tagalog is not covered by QVAC's dedicated NMT engines (Bergamot is
// European-language-focused, IndicTrans covers Indian languages), so this app
// takes the LLM route instead: it loads a small multilingual instruction
// model with QVAC and prompts it to translate. Everything -- the model
// weights, the download, and every inference call -- runs on this machine.
// No text you type ever leaves your device.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadModel, unloadModel, completion, QWEN3_1_7B_INST_Q4 } from "@qvac/sdk";

// Which built-in plugins the worker loads is controlled by qvac.config.json
// in the project root (set to only the LLM plugin). This is what avoids
// pulling in the ASR addon, which needs Vulkan and isn't available in many
// containers/CI environments (including plain GitHub Codespaces).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Model lifecycle -------------------------------------------------------

let modelId = null;
let loadingPromise = null;
let lastProgress = { status: "idle" };

async function ensureModelLoaded() {
  if (modelId) return modelId;
  if (loadingPromise) return loadingPromise;

  lastProgress = { status: "loading", percentage: 0 };

  loadingPromise = loadModel({
    modelSrc: QWEN3_1_7B_INST_Q4,
    modelType: "llm",
    modelConfig: { ctx_size: 4096 },
    onProgress: (progress) => {
      lastProgress = { status: "loading", ...progress };
      console.log("[qvac] loading model:", progress);
    },
  })
    .then((id) => {
      modelId = id;
      lastProgress = { status: "ready" };
      console.log("[qvac] model ready:", id);
      return id;
    })
    .catch((err) => {
      lastProgress = { status: "error", message: err.message };
      loadingPromise = null;
      throw err;
    });

  return loadingPromise;
}

// Kick off the download/load as soon as the server starts so the model is
// warm by the time someone opens the page.
ensureModelLoaded().catch((err) => {
  console.error("[qvac] initial model load failed:", err);
});

// --- Translation prompt ------------------------------------------------

const LANG_NAMES = { ceb: "Cebuano (Bisaya)", tl: "Tagalog (Filipino)" };

function buildHistory(text, direction) {
  const [from, to] = direction.split("-");
  const fromName = LANG_NAMES[from];
  const toName = LANG_NAMES[to];

  return [
    {
      role: "system",
      content:
        `You are an offline translation engine for Philippine languages. ` +
        `Translate the user's ${fromName} text into natural, everyday ${toName}. ` +
        `Reply with ONLY the translation, no explanations, no quotes, no notes.`,
    },
    { role: "user", content: text },
  ];
}

// --- Routes ----------------------------------------------------------------

app.get("/api/status", (req, res) => {
  res.json(lastProgress);
});

app.post("/api/translate", async (req, res) => {
  try {
    const { text, direction } = req.body || {};

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Provide non-empty 'text'." });
    }
    if (direction !== "ceb-tl" && direction !== "tl-ceb") {
      return res.status(400).json({ error: "'direction' must be 'ceb-tl' or 'tl-ceb'." });
    }

    const id = await ensureModelLoaded();

    const run = completion({
      modelId: id,
      history: buildHistory(text.trim(), direction),
      stream: false,
      generationParams: { temp: 0.2, predict: 512 },
    });

    const result = await run.final;
    res.json({ translation: result.contentText.trim() });
  } catch (err) {
    console.error("[qvac] translate error:", err);
    res.status(500).json({ error: err.message || "Translation failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Offline Cebuano <-> Tagalog translator running at http://localhost:${PORT}`);
});

// --- Graceful shutdown -------------------------------------------------

async function shutdown() {
  console.log("\n[qvac] shutting down, unloading model...");
  try {
    if (modelId) await unloadModel({ modelId });
  } catch (err) {
    console.error("[qvac] error unloading model:", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

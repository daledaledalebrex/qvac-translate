const statusEl = document.getElementById("status");
const inputEl = document.getElementById("input");
const outputEl = document.getElementById("output");
const translateBtn = document.getElementById("translateBtn");
const swapBtn = document.getElementById("swap");
const fromLabel = document.getElementById("fromLabel");
const toLabel = document.getElementById("toLabel");

let direction = "ceb-tl"; // "ceb-tl" or "tl-ceb"
const NAMES = { ceb: "Cebuano", tl: "Tagalog" };

function applyDirectionLabels() {
  const [from, to] = direction.split("-");
  fromLabel.textContent = NAMES[from];
  toLabel.textContent = NAMES[to];
  inputEl.placeholder = `Type ${NAMES[from]} text here...`;
}

swapBtn.addEventListener("click", () => {
  direction = direction === "ceb-tl" ? "tl-ceb" : "ceb-tl";
  applyDirectionLabels();
  const tmp = inputEl.value;
  inputEl.value = outputEl.value;
  outputEl.value = tmp;
});

async function pollStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();

    if (data.status === "ready") {
      statusEl.textContent = "✓ Model loaded — translating fully offline on this device.";
      statusEl.className = "status ready";
      translateBtn.disabled = false;
      return; // stop polling
    }
    if (data.status === "error") {
      statusEl.textContent = `Model failed to load: ${data.message}`;
      statusEl.className = "status error";
      return;
    }
    const pct = typeof data.percentage === "number" ? ` (${Math.round(data.percentage)}%)` : "";
    statusEl.textContent = `Downloading / loading the on-device model${pct}... this only happens once.`;
    translateBtn.disabled = true;
    setTimeout(pollStatus, 1200);
  } catch (err) {
    statusEl.textContent = "Waiting for server...";
    setTimeout(pollStatus, 1500);
  }
}

translateBtn.addEventListener("click", async () => {
  const text = inputEl.value.trim();
  if (!text) return;

  translateBtn.disabled = true;
  translateBtn.textContent = "Translating…";
  outputEl.value = "";

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, direction }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Translation failed.");
    outputEl.value = data.translation;
  } catch (err) {
    outputEl.value = `⚠ ${err.message}`;
  } finally {
    translateBtn.disabled = false;
    translateBtn.textContent = "Translate";
  }
});

applyDirectionLabels();
pollStatus();

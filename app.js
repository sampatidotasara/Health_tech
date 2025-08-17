// ---------- Simple Knowledge Base (demo, not medical advice) ----------
const KB = {
  redFlags: {
    // Any present => urgent triage
    symptoms: [
      "severe chest pain", "difficulty breathing", "blue lips or face",
      "severe bleeding", "unconsciousness", "seizure", "stiff neck with fever",
      "confusion", "one-sided weakness", "stroke symptoms", "severe dehydration",
    ],
    vitals: {
      tempC: v => v >= 40.0,      // very high fever
      hr: v => v >= 130           // tachycardia danger (rough heuristic)
    }
  },
  conditions: [
    {
      name: "Common Cold (Viral URI)",
      weights: { "runny nose": 2, "stuffy nose": 2, "sore throat": 2, "sneezing": 2, "cough": 1, "low-grade fever": 1, "fatigue": 1, "headache": 1 },
      advice: [
        "Rest, fluids, warm soups/tea.",
        "Salt-water gargles for sore throat.",
        "Consider OTC pain/fever reducer as directed."
      ]
    },
    {
      name: "Influenza (Flu)",
      weights: { "fever": 3, "chills": 2, "body aches": 3, "headache": 2, "dry cough": 2, "fatigue": 2, "sore throat": 1 },
      advice: [
        "Hydrate well and rest.",
        "If high risk or severe, contact a clinician—antivirals work best early."
      ]
    },
    {
      name: "COVID-19",
      weights: { "fever": 2, "dry cough": 3, "loss of taste or smell": 4, "fatigue": 2, "shortness of breath": 2, "sore throat": 1, "headache": 1, "body aches": 1 },
      advice: [
        "Consider testing and follow local guidance.",
        "Isolate if positive; hydrate and rest."
      ]
    },
    {
      name: "Acute Gastroenteritis (Stomach Bug)",
      weights: { "nausea": 2, "vomiting": 3, "diarrhea": 3, "abdominal cramps": 2, "fever": 1, "fatigue": 1 },
      advice: [
        "Small, frequent sips of oral rehydration solution.",
        "Seek care if unable to keep fluids, bloody stool, or signs of dehydration."
      ]
    },
    {
      name: "Allergic Rhinitis",
      weights: { "sneezing": 2, "itchy eyes": 3, "runny nose": 2, "stuffy nose": 2, "clear nasal discharge": 2, "post-nasal drip": 1, "cough": 1 },
      advice: [
        "Reduce exposure to triggers; consider antihistamines as directed.",
        "Saline rinses can help."
      ]
    },
    {
      name: "Migraine",
      weights: { "unilateral headache": 3, "throbbing headache": 3, "nausea": 1, "vomiting": 1, "light sensitivity": 2, "sound sensitivity": 2, "aura": 2 },
      advice: [
        "Rest in a dark, quiet room; hydrate.",
        "If frequent/severe, talk to a clinician about treatment options."
      ]
    }
  ],
  symptomDictionary: [
    "fever","low-grade fever","chills","body aches","headache","unilateral headache","throbbing headache","dry cough","cough",
    "runny nose","stuffy nose","sore throat","sneezing","fatigue","loss of taste or smell",
    "nausea","vomiting","diarrhea","abdominal cramps",
    "itchy eyes","clear nasal discharge","post-nasal drip",
    "light sensitivity","sound sensitivity","aura",
    "shortness of breath",
    // red flags:
    "severe chest pain","difficulty breathing","blue lips or face","severe bleeding","unconsciousness","seizure","stiff neck with fever","confusion","one-sided weakness","stroke symptoms","severe dehydration"
  ]
};

// ---------- DOM ----------
const el = id => document.getElementById(id);
const symptomInput = el("symptom-input");
const addBtn = el("add-symptom-btn");
const suggestionsBox = el("suggestions");
const chipsBox = el("selected-symptoms");
const analyzeBtn = el("analyze-btn");
const resetBtn = el("reset-btn");
const triageBox = el("triage");
const likelyBox = el("likely-conditions");
const adviceBox = el("advice");
const result = el("result");
const historyBox = el("history");
const clearHistoryBtn = el("clear-history");

let selected = new Set();

// ---------- Helpers ----------
function renderChips() {
  chipsBox.innerHTML = "";
  [...selected].forEach(sym => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${sym} <button title="remove">✕</button>`;
    chip.querySelector("button").onclick = () => {
      selected.delete(sym);
      renderChips();
      renderSuggestions();
    };
    chipsBox.appendChild(chip);
  });
}

function renderSuggestions() {
  const q = symptomInput.value.trim().toLowerCase();
  const list = KB.symptomDictionary
    .filter(s => s.toLowerCase().includes(q))
    .filter(s => !selected.has(s))
    .slice(0, 12);
  suggestionsBox.innerHTML = "";
  list.forEach(s => {
    const b = document.createElement("button");
    b.className = "sugg";
    b.textContent = s;
    b.onclick = () => { selected.add(s); symptomInput.value = ""; renderChips(); renderSuggestions(); symptomInput.focus(); };
    suggestionsBox.appendChild(b);
  });
}

function addSymptomFromInput() {
  const s = symptomInput.value.trim().toLowerCase();
  if (!s) return;
  selected.add(s);
  symptomInput.value = "";
  renderChips();
  renderSuggestions();
}

// Normalize numeric inputs
const num = v => (v === "" || v === null || isNaN(Number(v))) ? null : Number(v);

// ---------- Scoring / Triage ----------
function analyze() {
  const age = num(el("age").value);
  const duration = num(el("duration").value);
  const temp = num(el("temp").value);
  const hr = num(el("hr").value);

  const symptoms = [...selected];

  // Red flag detection
  const redReasons = [];
  for (const rf of KB.redFlags.symptoms) {
    if (symptoms.includes(rf)) redReasons.push(`Red-flag symptom: ${rf}`);
  }
  if (temp !== null && KB.redFlags.vitals.tempC(temp)) redReasons.push(`Very high fever (≥ 40°C)`);
  if (hr !== null && KB.redFlags.vitals.hr(hr)) redReasons.push(`Very high heart rate (≥ 130 bpm)`);

  // Condition scores
  const scores = KB.conditions.map(c => {
    let score = 0, max = 0;
    Object.entries(c.weights).forEach(([sym, w]) => {
      max += w;
      if (symptoms.includes(sym)) score += w;
    });

    // small modifiers
    if (c.name.includes("Cold") && duration !== null && duration > 10) score -= 1; // too long
    if (c.name.includes("Influenza") && temp !== null && temp >= 38) score += 1;
    if (c.name.includes("COVID") && symptoms.includes("loss of taste or smell")) score += 1;

    score = Math.max(0, score);
    const confidence = max ? Math.round((score / max) * 100) : 0;
    return { condition: c.name, confidence, advice: c.advice };
  });

  scores.sort((a,b) => b.confidence - a.confidence);

  // Render
  result.classList.remove("hidden");

  // Triage
  triageBox.innerHTML = "";
  if (redReasons.length) {
    triageBox.innerHTML = `
      <p class="badge danger">Urgent attention recommended</p>
      <ul class="list">${redReasons.map(r => `<li>${r}</li>`).join("")}</ul>
      <hr />
    `;
  } else {
    triageBox.innerHTML = `<p class="badge ok">No immediate red flags detected (based on inputs)</p><hr />`;
  }

  // Likely conditions
  const top = scores.filter(s => s.confidence > 0).slice(0, 4);
  if (top.length === 0) {
    likelyBox.innerHTML = `<p>No strong matches. Consider rest, fluids, and monitoring. If symptoms persist or worsen, seek medical advice.</p>`;
    adviceBox.innerHTML = "";
  } else {
    likelyBox.innerHTML = `
      <ol class="list">
        ${top.map(t => `<li><strong>${t.condition}</strong> — approx. match: ${t.confidence}%</li>`).join("")}
      </ol>
    `;
    // merged advice from top 2
    const merged = [...new Set(top.slice(0,2).flatMap(t => t.advice))];
    adviceBox.innerHTML = `
      <h3>General self-care tips</h3>
      <ul class="list">
        ${merged.map(a => `<li>${a}</li>`).join("")}
      </ul>
    `;
  }

  // Save history
  const entry = {
    time: new Date().toISOString(),
    symptoms,
    age, duration, temp, hr,
    triage: redReasons.length ? "Urgent" : "OK",
    top: top.map(t => ({ condition: t.condition, confidence: t.confidence }))
  };
  saveHistory(entry);
  renderHistory();
}

// ---------- History ----------
function loadHistory() {
  try { return JSON.parse(localStorage.getItem("ht_history") || "[]"); }
  catch { return []; }
}
function saveHistory(item) {
  const h = loadHistory();
  h.unshift(item);
  localStorage.setItem("ht_history", JSON.stringify(h.slice(0,20)));
}
function renderHistory() {
  const h = loadHistory();
  if (!h.length) { historyBox.innerHTML = `<p class="muted">No previous checks.</p>`; return; }
  historyBox.innerHTML = h.map(e => `
    <div class="history-item">
      <div><strong>${new Date(e.time).toLocaleString()}</strong> — ${e.triage}</div>
      <div>Symptoms: ${e.symptoms.join(", ") || "—"}</div>
      ${e.top?.length ? `<div>Top: ${e.top.map(t => `${t.condition} (${t.confidence}%)`).join(", ")}</div>` : ""}
      <hr />
    </div>
  `).join("");
}

// ---------- Events ----------
symptomInput.addEventListener("input", renderSuggestions);
symptomInput.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); addSymptomFromInput(); }
});
addBtn.addEventListener("click", addSymptomFromInput);
analyzeBtn.addEventListener("click", analyze);
resetBtn.addEventListener("click", () => {
  selected = new Set();
  symptomInput.value = "";
  ["age","duration","temp","hr"].forEach(id => el(id).value = "");
  renderChips(); renderSuggestions();
  result.classList.add("hidden");
});
clearHistoryBtn.addEventListener("click", () => { localStorage.removeItem("ht_history"); renderHistory(); });

// Initial render
renderChips();
renderSuggestions();
renderHistory();

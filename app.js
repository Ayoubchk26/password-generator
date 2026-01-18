const $ = (id) => document.getElementById(id);

const AMBIGUOUS = new Set(["O", "0", "I", "l", "1", "|", "`", "'", '"', "\\"]);

function removeAmbiguous(str) {
  return [...str].filter((c) => !AMBIGUOUS.has(c)).join("");
}

// crypto-safe random int [0, max)
function randInt(max) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

function choice(str) {
  return str[randInt(str.length)];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generatePassword({
  length = 16,
  upper = true,
  lower = true,
  digits = true,
  symbols = true,
  excludeAmb = true,
}) {
  let upp = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let low = "abcdefghijklmnopqrstuvwxyz";
  let dig = "0123456789";
  let sym = "!@#$%^&*()-_=+[]{};:,.?/";

  if (excludeAmb) {
    upp = removeAmbiguous(upp);
    low = removeAmbiguous(low);
    dig = removeAmbiguous(dig);
    sym = removeAmbiguous(sym);
  }

  const categories = [];
  if (upper) categories.push(upp);
  if (lower) categories.push(low);
  if (digits) categories.push(dig);
  if (symbols) categories.push(sym);

  if (length < 4) throw new Error("La longueur doit être au minimum 4.");
  if (categories.length === 0) throw new Error("Active au moins une catégorie.");
  if (length < categories.length) {
    throw new Error(`Longueur trop petite: minimum ${categories.length} avec ces options.`);
  }

  // 1) garantir 1 caractère par catégorie
  const pwd = categories.map((cat) => choice(cat));

  // 2) compléter avec l'alphabet global
  const alphabet = categories.join("");
  for (let i = pwd.length; i < length; i++) {
    pwd.push(choice(alphabet));
  }

  // 3) mélanger
  shuffle(pwd);
  return pwd.join("");
}

/* ---------- Force ---------- */
function estimateStrength(pwd) {
  let score = 0;
  if (!pwd) return { score: 0, label: "—" };

  // longueur
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (pwd.length >= 16) score += 1;
  if (pwd.length >= 24) score += 1;

  // diversité
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);
  const hasSym = /[^A-Za-z0-9]/.test(pwd);
  score += [hasUpper, hasLower, hasDigit, hasSym].filter(Boolean).length;

  // pénalités simples
  if (/^(.)\1+$/.test(pwd)) score = 0;
  if (/(.)\1\1/.test(pwd)) score -= 1;

  score = Math.max(0, Math.min(score, 10));

  let label = "Faible";
  if (score >= 4) label = "Moyen";
  if (score >= 7) label = "Fort";
  if (score >= 9) label = "Très fort";

  return { score, label };
}

function updateStrengthUI(pwd) {
  const fill = $("strengthFill");
  const text = $("strengthText");
  if (!fill || !text) return; // si tu n'as pas encore ajouté le HTML

  const { score, label } = estimateStrength(pwd);
  const pct = Math.round((score / 10) * 100);
  fill.style.width = pct + "%";
  text.textContent = label;
}

/* ---------- Historique ---------- */
const HISTORY_KEY = "pwd_history_v1";
const HISTORY_LIMIT = 10;

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function renderHistory() {
  const ul = $("historyList");
  if (!ul) return; // si tu n'as pas encore ajouté le HTML

  const list = loadHistory();
  ul.innerHTML = "";

  if (list.length === 0) {
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML =
      `<span class="history-pwd" style="opacity:.7">Aucun mot de passe pour l’instant.</span>`;
    ul.appendChild(li);
    return;
  }

  for (const pwd of list) {
    const li = document.createElement("li");
    li.className = "history-item";

    const span = document.createElement("span");
    span.className = "history-pwd";
    span.title = pwd;
    span.textContent = pwd;

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "secondary";
    useBtn.textContent = "Utiliser";
    useBtn.addEventListener("click", () => {
      $("password").value = pwd;
      updateStrengthUI(pwd);
      showMsg("Mot de passe repris depuis l’historique.");
    });

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "Copier";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pwd);
        showMsg("Copié dans le presse-papiers.");
      } catch {
        $("password").value = pwd;
        $("password").select();
        document.execCommand("copy");
        showMsg("Copié (fallback).");
      }
    });

    actions.appendChild(useBtn);
    actions.appendChild(copyBtn);

    li.appendChild(span);
    li.appendChild(actions);
    ul.appendChild(li);
  }
}

function pushToHistory(pwd) {
  if (!pwd) return;
  let list = loadHistory();
  list = list.filter((x) => x !== pwd);
  list.unshift(pwd);
  if (list.length > HISTORY_LIMIT) list = list.slice(0, HISTORY_LIMIT);
  saveHistory(list);
  renderHistory();
}

/* ---------- UI helpers ---------- */
function showMsg(text, isError = false) {
  const msg = $("msg");
  if (!msg) return;
  msg.textContent = text;
  msg.style.color = isError ? "#ff8a8a" : "#a8ffb0";
}

/* ---------- Events ---------- */
$("generate").addEventListener("click", () => {
  try {
    const length = parseInt($("length").value, 10);

    const password = generatePassword({
      length,
      upper: $("upper").checked,
      lower: $("lower").checked,
      digits: $("digits").checked,
      symbols: $("symbols").checked,
      excludeAmb: $("excludeAmb").checked,
    });

    $("password").value = password;
    updateStrengthUI(password);
    pushToHistory(password);
    showMsg("Mot de passe généré.");
  } catch (e) {
    showMsg(e.message || "Erreur.", true);
  }
});

$("copy").addEventListener("click", async () => {
  const val = $("password").value;
  if (!val) return showMsg("Génère un mot de passe d’abord.", true);

  try {
    await navigator.clipboard.writeText(val);
    showMsg("Copié dans le presse-papiers.");
  } catch {
    $("password").select();
    document.execCommand("copy");
    showMsg("Copié (fallback).");
  }
});

const clearBtn = $("clearHistory");
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    saveHistory([]);
    renderHistory();
    showMsg("Historique vidé.");
  });
}

const toggleBtn = $("togglePwd");
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    const input = $("password");
    const btn = $("togglePwd");

    if (input.type === "password") {
      input.type = "text";
      btn.textContent = "Masquer";
    } else {
      input.type = "password";
      btn.textContent = "Afficher";
    }
  });
}

/* ---------- Init ---------- */
renderHistory();
$("generate").click();
updateStrengthUI($("password").value);

function getToken() {
  return sessionStorage.getItem("token") || "";
}

async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "Resposta inválida do servidor", raw: text.slice(0, 200) };
  }
}

function logout() {
  sessionStorage.removeItem("token");
  window.location.href = "/";
}

function pillClass(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("atraso")) return "dead";
  if (s.includes("andamento")) return "warn";
  if (s.includes("conclu")) return "ok";
  return "";
}

function fmtDateBR(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

function isoToInputDT(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "2026-02" -> "fevereiro de 2026"
function compLabel(ym) {
  if (!ym) return "";
  const m = String(ym).trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(ym);
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const d = new Date(year, month, 1);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(d);
}

// mantém compatibilidade se ainda houver "competencia" antigo
function fmtCompetencia(v) {
  const s = String(v || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[2]}/${m[1]}`;
  return s;
}
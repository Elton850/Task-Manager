let token = localStorage.getItem("token") || "";
let me = null;
let editingId = null;

const $ = (id) => document.getElementById(id);

function setLogin(on) {
  $("loginCard").style.display = on ? "block" : "none";
  $("appCard").style.display = on ? "none" : "block";
  $("btnLogout").style.display = on ? "none" : "inline-block";
}

function openModal(open) {
  $("modal").classList.toggle("show", !!open);
}

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  }).then(r => r.json());
}

function isoToDate(iso){ if(!iso) return ""; return new Date(iso).toISOString().slice(0,10); }
function isoToLocalDT(iso){
  if(!iso) return "";
  const d = new Date(iso);
  const pad = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function doLogin() {
  $("loginHint").textContent = "Autenticando...";
  const email = $("email").value.trim();
  const password = $("password").value.trim();

  const res = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    $("loginHint").textContent = res.error || "Erro";
    return;
  }
  token = res.token;
  localStorage.setItem("token", token);
  await bootstrap();
}

async function bootstrap() {
  const meRes = await api("/api/me");
  if (!meRes.ok) {
    token = "";
    localStorage.removeItem("token");
    setLogin(true);
    return;
  }
  me = meRes.user;
  $("meLine").textContent = `${me.nome || me.email} • ${me.role} • Área: ${me.area || "-"}`;
  setLogin(false);

  // filtros
  const lookRes = await api("/api/lookups");
  const statuses = (lookRes.ok && lookRes.lookups && lookRes.lookups.STATUS) ? lookRes.lookups.STATUS : [];
  $("fStatus").innerHTML = `<option value="">Todos</option>` + statuses.map(s=>`<option>${s}</option>`).join("");

  await loadTasks();
}

async function loadTasks() {
  $("hint").textContent = "Carregando...";
  const qs = new URLSearchParams();
  if ($("fStatus").value) qs.set("status", $("fStatus").value);
  if ($("fFrom").value) qs.set("from", new Date($("fFrom").value).toISOString());
  if ($("fTo").value) qs.set("to", new Date($("fTo").value).toISOString());

  const res = await api("/api/tasks?" + qs.toString());
  if (!res.ok) { $("hint").textContent = res.error || "Erro"; return; }

  const tb = $("tb");
  tb.innerHTML = "";

  res.tasks.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.competencia || ""}</td>
      <td>${t.recorrencia || ""}</td>
      <td>${t.tipo || ""}</td>
      <td>${t.atividade || ""}</td>
      <td>${t.responsavelNome || t.responsavelEmail || ""}</td>
      <td>${isoToDate(t.prazo)}</td>
      <td>${t.realizado ? isoToLocalDT(t.realizado) : ""}</td>
      <td>${t.status || ""}</td>
      <td></td>
    `;

    const td = tr.querySelector("td:last-child");

    const btnE = document.createElement("button");
    btnE.className = "btn ghost";
    btnE.textContent = "Editar";
    btnE.onclick = () => editTask(t);

    const btnD = document.createElement("button");
    btnD.className = "btn ghost";
    btnD.textContent = "Duplicar";
    btnD.onclick = async () => {
      const r = await api(`/api/tasks/${t.id}/duplicate`, { method: "POST" });
      if (!r.ok) alert(r.error || "Erro");
      else loadTasks();
    };

    const btnX = document.createElement("button");
    btnX.className = "btn ghost";
    btnX.textContent = "Excluir";
    btnX.onclick = async () => {
      if (!confirm("Excluir?")) return;
      const r = await api(`/api/tasks/${t.id}`, { method: "DELETE" });
      if (!r.ok) alert(r.error || "Erro");
      else loadTasks();
    };

    td.appendChild(btnE);
    td.appendChild(btnD);
    td.appendChild(btnX);

    tb.appendChild(tr);
  });

  $("hint").textContent = `Tasks: ${res.tasks.length}`;
}

function clearModal() {
  editingId = null;
  $("mTitle").textContent = "Nova task";
  $("mCompetencia").value = "";
  $("mRecorrencia").value = "Diário";
  $("mTipo").value = "Benefícios";
  $("mAtividade").value = "";
  $("mStatus").value = "Em Andamento";
  $("mPrazo").value = "";
  $("mRealizado").value = "";
  $("mObs").value = "";
  $("mHint").textContent = "";
}

function editTask(t) {
  editingId = t.id;
  $("mTitle").textContent = "Editar task";
  $("mCompetencia").value = t.competencia || "";
  $("mRecorrencia").value = t.recorrencia || "";
  $("mTipo").value = t.tipo || "";
  $("mAtividade").value = t.atividade || "";
  $("mStatus").value = t.status || "";
  $("mPrazo").value = isoToDate(t.prazo);
  $("mRealizado").value = t.realizado ? isoToLocalDT(t.realizado) : "";
  $("mObs").value = t.observacoes || "";
  openModal(true);
}

async function saveTask() {
  $("mHint").textContent = "Salvando...";

  const payload = {
    competencia: $("mCompetencia").value.trim(),
    recorrencia: $("mRecorrencia").value.trim(),
    tipo: $("mTipo").value.trim(),
    atividade: $("mAtividade").value.trim(),
    status: $("mStatus").value.trim(),
    prazo: $("mPrazo").value ? new Date($("mPrazo").value).toISOString() : "",
    realizado: $("mRealizado").value ? new Date($("mRealizado").value).toISOString() : "",
    observacoes: $("mObs").value.trim(),
  };

  const res = editingId
    ? await api(`/api/tasks/${editingId}`, { method: "PUT", body: JSON.stringify(payload) })
    : await api(`/api/tasks`, { method: "POST", body: JSON.stringify(payload) });

  if (!res.ok) { $("mHint").textContent = res.error || "Erro"; return; }

  openModal(false);
  await loadTasks();
}

document.addEventListener("DOMContentLoaded", () => {
  $("btnLogin").onclick = doLogin;
  $("btnLogout").onclick = () => {
    token = "";
    localStorage.removeItem("token");
    setLogin(true);
    $("meLine").textContent = "Deslogado";
  };

  $("btnNew").onclick = () => { clearModal(); openModal(true); };
  $("mClose").onclick = () => openModal(false);
  $("mSave").onclick = saveTask;

  $("btnRefresh").onclick = loadTasks;
  $("btnFilter").onclick = loadTasks;

  bootstrap();
});
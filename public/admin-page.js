let me = null;
let lookups = {};

const $ = (id) => document.getElementById(id);

async function bootstrap() {
  const meRes = await api("/api/me");
  if (!meRes.ok) return logout();
  me = meRes.user;

  if (me.role !== "ADMIN") return logout(); // simples e direto

  $("meLine").textContent = `${me.nome || me.email} • ${me.role}`;
  $("btnLogout").onclick = (e) => { e.preventDefault(); logout(); };

  $("cat").onchange = render;
  $("add").onclick = addItem;

  await loadLookups();
  render();
}

async function loadLookups() {
  const res = await api("/api/lookups");
  if (!res.ok) { $("hint").textContent = res.error || "Erro"; return; }
  lookups = res.lookups || {};
}

function render() {
  const cat = $("cat").value;
  const items = lookups[cat] || [];

  const list = $("list");
  list.innerHTML = "";

  items.forEach(v => {
    const span = document.createElement("span");
    span.className = "pill";
    span.textContent = v;
    list.appendChild(span);
  });

  $("hint").textContent = `Itens: ${items.length}`;
}

async function addItem() {
  const category = $("cat").value;
  const value = ($("val").value || "").trim();
  const order = $("ord").value ? Number($("ord").value) : 9999;

  if (!value) { alert("Informe o valor."); return; }

  const res = await api("/api/lookups", {
    method:"POST",
    body: JSON.stringify({ category, value, order })
  });

  if (!res.ok) { alert(res.error || "Erro"); return; }

  lookups = res.lookups || {};
  $("val").value = "";
  $("ord").value = "";
  render();
}

document.addEventListener("DOMContentLoaded", bootstrap);
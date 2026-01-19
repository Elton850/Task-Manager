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
  return res.json();
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

function isoDate(iso){ return iso ? new Date(iso).toISOString().slice(0,10) : ""; }
function isoLocalDT(iso){
  if(!iso) return "";
  const d = new Date(iso);
  const pad = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
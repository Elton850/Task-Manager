document.getElementById("btnLogin").onclick = async () => {
  const hint = document.getElementById("hint");
  hint.textContent = "Autenticando...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  const res = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    hint.textContent = res.error || "Erro";
    return;
  }

  // sessão já foi criada via cookie HttpOnly no server
  window.location.href = "/calendar";
};

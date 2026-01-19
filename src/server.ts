import "dotenv/config";
import express from "express";
import helmet from "helmet";
import path from "path";
import { login, verifyToken, type AuthedUser } from "./auth";
import { sheets } from "./sheetsApi";
import { nowIso, mustString, safeLowerEmail } from "./utils";
import type { TaskRow } from "./types";
import { canEditTask, canDeleteTask } from "./access";

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));

// Front (B)
app.use("/public", express.static(path.join(process.cwd(), "public")));

app.get("/", (_, res) => res.sendFile(path.join(process.cwd(), "public/login.html")));
app.get("/app", (_, res) => res.sendFile(path.join(process.cwd(), "public/app.html")));
app.get("/admin", (_, res) => res.sendFile(path.join(process.cwd(), "public/admin.html")));

function authMiddleware(req: any, res: any, next: any) {
  try {
    const auth = String(req.headers.authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = mustString(req.body.email, "Email");
    const password = mustString(req.body.password, "Senha");
    const out = await login(email, password);
    res.json({ ok: true, ...out });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.get("/api/me", authMiddleware, async (req: any, res) => {
  res.json({ ok: true, user: req.user as AuthedUser });
});

app.get("/api/users", authMiddleware, async (req: any, res) => {
  const me = req.user as AuthedUser;

  const all = await sheets.listUsers();
  const active = all.filter(u => String(u.active).toUpperCase() === "TRUE");

  let visible = active;

  if (me.role === "LEADER") {
    visible = active.filter(u => String(u.area || "") === String(me.area || ""));
  }

  if (me.role === "USER") {
    visible = active.filter(u => String(u.email || "").toLowerCase() === me.email.toLowerCase());
  }

  // não expor passwordHash
  const safe = visible.map(u => ({
    email: String(u.email || "").toLowerCase(),
    nome: String(u.nome || ""),
    role: String(u.role || "USER").toUpperCase(),
    area: String(u.area || ""),
  }));

  res.json({ ok: true, users: safe });
});

app.get("/api/lookups", authMiddleware, async (req: any, res) => {
  const lookups = await sheets.listLookups();
  res.json({ ok: true, lookups });
});

app.post("/api/lookups", authMiddleware, async (req: any, res) => {
  const me = req.user as AuthedUser;
  if (me.role !== "ADMIN") return res.status(403).json({ ok: false, error: "FORBIDDEN" });

  try {
    const category = mustString(req.body.category, "Categoria").toUpperCase();
    const value = mustString(req.body.value, "Valor");
    const order = Number(req.body.order ?? 9999);
    const lookups = await sheets.upsertLookup({ category, value, order });
    res.json({ ok: true, lookups });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.get("/api/tasks", authMiddleware, async (req: any, res) => {
  const me = req.user as AuthedUser;
  const all = (await sheets.listTasks()) as TaskRow[];

  const visible = all.filter(t => {
    if (me.role === "ADMIN") return true;
    if (me.role === "LEADER") return String(t.area || "") === String(me.area || "");
    return safeLowerEmail(t.responsavelEmail) === me.email;
  });

  // filtros básicos (opcionais)
  const status = String(req.query.status || "").trim();
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();

  let out = visible;
  if (status) out = out.filter(t => String(t.status || "") === status);
  if (from) out = out.filter(t => t.prazo && new Date(t.prazo) >= new Date(from));
  if (to) out = out.filter(t => t.prazo && new Date(t.prazo) <= new Date(to));

  // ordena por prazo
  out.sort((a, b) => (a.prazo || "").localeCompare(b.prazo || ""));
  res.json({ ok: true, tasks: out });
});

app.post("/api/tasks", authMiddleware, async (req: any, res) => {
  const me = req.user as AuthedUser;

  try {
    const tarefa = mustString(req.body.atividade, "Atividade");
    const tipo = mustString(req.body.tipo, "Tipo");
    const recorrencia = mustString(req.body.recorrencia, "Recorrência");
    const status = mustString(req.body.status, "Status");
    const competencia = String(req.body.competencia || "").trim();
    const observacoes = String(req.body.observacoes || "").trim();

    const prazo = req.body.prazo ? new Date(req.body.prazo).toISOString() : "";
    const realizado = req.body.realizado ? new Date(req.body.realizado).toISOString() : "";

    // responsável: USER é sempre ele; leader/admin podem atribuir por e-mail
    let responsavelEmail = me.email;
    let responsavelNome = me.nome;
    let area = me.area;

    if (me.role !== "USER" && req.body.responsavelEmail) {
      const re = safeLowerEmail(req.body.responsavelEmail);
      const u = await sheets.getUserByEmail(re);
      if (!u) throw new Error("Responsável não cadastrado.");
      if (me.role === "LEADER" && String(u.area || "") !== me.area) throw new Error("Leader só atribui na própria área.");
      responsavelEmail = re;
      responsavelNome = String(u.nome || "");
      area = String(u.area || "");
    }

    const now = nowIso();

    const task: Partial<TaskRow> = {
      competencia,
      recorrencia,
      tipo,
      atividade: tarefa,
      responsavelEmail,
      responsavelNome,
      area,
      prazo,
      realizado,
      status,
      observacoes,
      createdAt: now,
      createdBy: me.email,
      updatedAt: now,
      updatedBy: me.email,
      deletedAt: "",
      deletedBy: ""
    };

    const created = await sheets.createTask(task);
    res.json({ ok: true, task: created });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.put("/api/tasks/:id", authMiddleware, async (req: any, res) => {
  const me = req.user as AuthedUser;
  const id = mustString(req.params.id, "id");

  try {
    const all = (await sheets.listTasks()) as TaskRow[];
    const current = all.find(t => t.id === id);
    if (!current) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const patch: Partial<TaskRow> = {};
    const fields = ["competencia","recorrencia","tipo","atividade","prazo","realizado","status","observacoes","responsavelEmail"] as const;

    for (const f of fields) {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    }

    // normaliza datas se vierem
    if (patch.prazo) patch.prazo = new Date(String(patch.prazo)).toISOString();
    if (patch.realizado === "CLEAR") patch.realizado = "";
    else if (patch.realizado) patch.realizado = new Date(String(patch.realizado)).toISOString();

    // reatribuição (leader/admin)
    if (patch.responsavelEmail) {
      const re = safeLowerEmail(patch.responsavelEmail);
      const u = await sheets.getUserByEmail(re);
      if (!u) throw new Error("Responsável não cadastrado.");
      if (me.role === "LEADER" && String(u.area || "") !== me.area) throw new Error("Leader só atribui na própria área.");
      (patch as any).responsavelEmail = re;
      (patch as any).responsavelNome = String(u.nome || "");
      (patch as any).area = String(u.area || "");
    }

    (patch as any).updatedAt = nowIso();
    (patch as any).updatedBy = me.email;

    if (!canEditTask(me, current, patch)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const updated = await sheets.updateTask(id, patch);
    res.json({ ok: true, task: updated });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

app.post("/api/tasks/:id/duplicate", authMiddleware, async (req: any, res) => {
  const me = req.user as AuthedUser;
  const id = mustString(req.params.id, "id");

  const all = (await sheets.listTasks()) as TaskRow[];
  const current = all.find(t => t.id === id);
  if (!current) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  // visibilidade
  const canSee =
    me.role === "ADMIN" ||
    (me.role === "LEADER" && current.area === me.area) ||
    (me.role === "USER" && safeLowerEmail(current.responsavelEmail) === me.email);

  if (!canSee) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

  const now = nowIso();
  const copy: Partial<TaskRow> = {
    ...current,
    id: "",
    realizado: "",
    createdAt: now,
    createdBy: me.email,
    updatedAt: now,
    updatedBy: me.email,
    deletedAt: "",
    deletedBy: "",
  };

  // user duplica para si
  if (me.role === "USER") {
    copy.responsavelEmail = me.email;
    copy.responsavelNome = me.nome;
    copy.area = me.area;
  }

  const created = await sheets.createTask(copy);
  res.json({ ok: true, task: created });
});

app.delete("/api/tasks/:id", authMiddleware, async (req: any, res) => {
  const me = req.user as AuthedUser;
  const id = mustString(req.params.id, "id");

  const all = (await sheets.listTasks()) as TaskRow[];
  const current = all.find(t => t.id === id);
  if (!current) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  if (!canDeleteTask(me, current)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

  const deleted = await sheets.softDeleteTask(id, me.email);
  res.json({ ok: true, task: deleted });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`OK http://localhost:${port}`));
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import path from "path";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";

import { login, verifyToken, type AuthedUser } from "./auth";
import { sheets } from "./sheetsApi";
import { mustString, nowIso, safeLowerEmail } from "./utils";
import type { TaskRow } from "./types";
import { canEditTask, canDeleteTask } from "./access";

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const a =
  (fn: any) =>
  (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/* =========================
   Sessão via Cookie HttpOnly
   ========================= */
const SESSION_COOKIE = "qco_session";

function isProd() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function setSessionCookie(res: express.Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd(), // Render = HTTPS
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 12, // 12h (ajuste se quiser)
  });
}

function clearSessionCookie(res: express.Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

function getTokenFromReq(req: any) {
  // 1) cookie (preferido)
  const c = req.cookies?.[SESSION_COOKIE];
  if (c) return String(c);

  // 2) fallback: Authorization Bearer (mantém compatibilidade)
  const auth = String(req.headers.authorization || "");
  if (auth.startsWith("Bearer ")) return auth.slice(7);

  return "";
}

function authMiddleware(req: any, res: any, next: any) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
}

async function getUserByEmailSafe(email: string) {
  const e = safeLowerEmail(email);
  if (!e) return null;
  try {
    const u = await sheets.getUserByEmail(e);
    return u || null;
  } catch {
    return null;
  }
}

/* ===== Cache de tasks (TTL curto) + índice por ID ===== */
let tasksCache: { at: number; data: TaskRow[] } | null = null;
let tasksIndex: Map<string, TaskRow> | null = null;

async function listTasksCached() {
  const ttlMs = 8000;
  if (tasksCache && Date.now() - tasksCache.at < ttlMs) return tasksCache.data;
  const data = (await sheets.listTasks()) as TaskRow[];
  tasksCache = { at: Date.now(), data };
  tasksIndex = null;
  return data;
}

async function getTaskByIdCached(id: string) {
  const all = await listTasksCached();
  if (!tasksIndex) tasksIndex = new Map(all.map((t) => [String(t.id), t]));
  return tasksIndex.get(String(id)) || null;
}

function bustTasksCache() {
  tasksCache = null;
  tasksIndex = null;
}

/* ===== Competência: normaliza para AAAA-MM ===== */
function normYm(input: any): string {
  const s = String(input || "").trim();
  if (!s) return "";

  let m = s.match(/^(\d{4})-(\d{1,2})-\d{1,2}/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;

  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;

  m = s.match(/^(\d{4})\/(\d{1,2})$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;

  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${String(Number(m[1])).padStart(2, "0")}`;

  return s;
}

/* ===== Datas: salvar como YYYY-MM-DD (sem Z/UTC) ===== */
function toYmdOrEmpty(v: any): string {
  if (!v) return "";
  const s = String(v).trim();
  if (!s) return "";

  // já está no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // tenta parsear ISO e reduzir
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  return s.slice(0, 10);
}

/* ===== Regras de status (Concluído x Concluído em Atraso) ===== */
function toDateOrNull(v: any) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;

  // interpreta YYYY-MM-DD como local (evita -1 dia)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function isConcluidoStatus(s: any) {
  const x = String(s || "").toLowerCase();
  return x.includes("conclu");
}

function normalizeClear(patch: any) {
  if (patch.realizado === "CLEAR") patch.realizado = "";
}

function applyDoneLateRule(finalStatus: any, finalPrazo: any, finalRealizado: any) {
  if (!isConcluidoStatus(finalStatus)) return String(finalStatus || "");

  const p = toDateOrNull(finalPrazo);
  const r = toDateOrNull(finalRealizado);
  if (!p || !r) return "Concluído";

  return r > p ? "Concluído em Atraso" : "Concluído";
}

/* =========================
   Static + rotas de páginas
   ========================= */
app.use("/public", express.static(path.join(process.cwd(), "public")));

/**
 * ROTA VAZIA:
 * - se logado -> /calendar
 * - se não -> login.html
 */
app.get(
  "/",
  a(async (req: any, res: any) => {
    const token = getTokenFromReq(req);
    if (token) {
      try {
        verifyToken(token);
        return res.redirect("/calendar");
      } catch {
        // cookie inválido/expirado
        clearSessionCookie(res);
      }
    }
    return res.sendFile(path.join(process.cwd(), "public/login.html"));
  })
);

app.get("/app", (_req, res) => res.sendFile(path.join(process.cwd(), "public/app.html")));
app.get("/calendar", (_req, res) => res.sendFile(path.join(process.cwd(), "public/calendar.html")));
app.get("/admin", (_req, res) => res.sendFile(path.join(process.cwd(), "public/admin.html")));
app.get("/admin/users", (_req, res) => res.sendFile(path.join(process.cwd(), "public/users.html")));

/* =========================
   AUTH
   ========================= */
app.post(
  "/api/auth/login",
  a(async (req: any, res: any) => {
    const email = mustString(req.body.email, "Email");
    const password = mustString(req.body.password, "Senha");

    const out = await login(email, password);
    // out deve conter token e user (como você já tinha)
    if (!out?.token) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    // cookie de sessão HttpOnly
    setSessionCookie(res, out.token);

    // devolve user pro front (token não precisa mais ir pro localStorage)
    res.json({ ok: true, user: out.user });
  })
);

app.post(
  "/api/auth/logout",
  a(async (_req: any, res: any) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  })
);

app.get(
  "/api/me",
  authMiddleware,
  a(async (req: any, res: any) => {
    res.json({ ok: true, user: req.user as AuthedUser });
  })
);

/* USERS (VISUALIZAÇÃO) */
app.get(
  "/api/users",
  authMiddleware,
  a(async (req: any, res: any) => {
    const me = req.user as AuthedUser;
    const all = await sheets.listUsers();
    const active = all.filter((u: any) => String(u.active).toUpperCase() === "TRUE" || u.active === true);

    let visible = active;
    if (me.role === "LEADER") visible = active.filter((u: any) => String(u.area || "") === String(me.area || ""));
    if (me.role === "USER") visible = active.filter((u: any) => safeLowerEmail(u.email) === me.email);

    res.json({
      ok: true,
      users: visible.map((u: any) => ({
        email: safeLowerEmail(u.email),
        nome: String(u.nome || ""),
        role: String(u.role || "USER").toUpperCase(),
        area: String(u.area || ""),
      })),
    });
  })
);

/* ADMIN - USERS */
app.get(
  "/api/admin/users",
  authMiddleware,
  a(async (req: any, res: any) => {
    const me = req.user as AuthedUser;
    if (me.role !== "ADMIN") return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const all = await sheets.listUsers();
    res.json({
      ok: true,
      users: all.map((u: any) => ({
        email: safeLowerEmail(u.email),
        nome: String(u.nome || ""),
        role: String(u.role || "USER").toUpperCase(),
        area: String(u.area || ""),
        active: String(u.active).toUpperCase() === "TRUE" || u.active === true,
        canDelete: String(u.canDelete).toUpperCase() === "TRUE" || u.canDelete === true,
      })),
    });
  })
);

app.post(
  "/api/admin/users",
  authMiddleware,
  a(async (req: any, res: any) => {
    const me = req.user as AuthedUser;
    if (me.role !== "ADMIN") return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const email = mustString(req.body.email, "Email").toLowerCase();
    const password = mustString(req.body.password, "Senha");
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await sheets.userUpsert(
      {
        email,
        nome: req.body.nome || "",
        role: String(req.body.role || "USER").toUpperCase(),
        area: req.body.area || "",
        active: req.body.active ?? true,
        canDelete: req.body.canDelete ?? false,
        passwordHash,
      },
      me.email
    );

    res.json({ ok: true, user });
  })
);

app.put(
  "/api/admin/users/:email",
  authMiddleware,
  a(async (req: any, res: any) => {
    const me = req.user as AuthedUser;
    if (me.role !== "ADMIN") return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const email = mustString(req.params.email, "Email").toLowerCase();
    const patch: any = {
      email,
      nome: req.body.nome,
      role: req.body.role,
      area: req.body.area,
      active: req.body.active,
      canDelete: req.body.canDelete,
    };

    if (req.body.password) patch.passwordHash = await bcrypt.hash(String(req.body.password), 12);

    const user = await sheets.userUpsert(patch, me.email);
    res.json({ ok: true, user });
  })
);

app.post(
  "/api/admin/users/:email/active",
  authMiddleware,
  a(async (req: any, res: any) => {
    const me = req.user as AuthedUser;
    if (me.role !== "ADMIN") return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const email = mustString(req.params.email, "Email").toLowerCase();
    const active = !!req.body.active;

    const user = await sheets.userSetActive(email, active, me.email);
    res.json({ ok: true, user });
  })
);

/* LOOKUPS */
app.get(
  "/api/lookups",
  authMiddleware,
  a(async (_req: any, res: any) => {
    const lookups = await sheets.listLookups();
    res.json({ ok: true, lookups });
  })
);

app.post(
  "/api/lookups",
  authMiddleware,
  a(async (req: any, res: any) => {
    const me = req.user as AuthedUser;
    if (me.role !== "ADMIN") return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const lookups = await sheets.upsertLookup({
      category: mustString(req.body.category, "Categoria").toUpperCase(),
      value: mustString(req.body.value, "Valor"),
      order: Number(req.body.order ?? 9999),
    });

    res.json({ ok: true, lookups });
  })
);

app.put(
  "/api/lookups/rename",
  authMiddleware,
  a(async (req: any, res: any) => {
    const me = req.user as AuthedUser;
    if (me.role !== "ADMIN") return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const lookups = await sheets.lookupRename(
      mustString(req.body.category, "Categoria").toUpperCase(),
      mustString(req.body.oldValue, "Valor antigo"),
      mustString(req.body.newValue, "Novo valor"),
      me.email
    );
    res.json({ ok: true, lookups });
  })
);

/* TASKS */
app.get(
  "/api/tasks",
  authMiddleware,
  a(async (req: any, res: any) => {
    const me = req.user as AuthedUser;
    const all = await listTasksCached();

    let visible = all.filter((t) => {
      if (me.role === "ADMIN") return true;
      if (me.role === "LEADER") return String((t as any).area || "") === String(me.area || "");
      return safeLowerEmail((t as any).responsavelEmail) === me.email;
    });

    // tenta preencher responsavelNome
    try {
      const needs = visible.some((t) => !String((t as any).responsavelNome || "").trim());
      if (needs) {
        const uAll = await sheets.listUsers();
        const map = new Map<string, string>(uAll.map((u: any) => [safeLowerEmail(u.email), String(u.nome || "").trim()]));

        visible = visible.map((t: any) => {
          const email = safeLowerEmail(t.responsavelEmail);
          const nome = String(t.responsavelNome || "").trim() || map.get(email) || "";
          return { ...t, responsavelEmail: email, responsavelNome: nome || email };
        });
      }
    } catch {}

    res.json({ ok: true, tasks: visible });
  })
);

app.post(
  "/api/tasks",
  authMiddleware,
  a(async (req: any, res: any) => {
    const me = req.user as AuthedUser;
    const now = nowIso();

    let responsavelEmail = me.email;
    if ((me.role === "ADMIN" || me.role === "LEADER") && req.body.responsavelEmail) {
      responsavelEmail = safeLowerEmail(req.body.responsavelEmail);
    }

    const u = await getUserByEmailSafe(responsavelEmail);
    const area = u?.area ? String(u.area) : String(me.area || "");
    if (me.role === "LEADER" && area !== String(me.area || "")) {
      return res.status(403).json({ ok: false, error: "Leader não pode criar tarefa fora da sua área." });
    }

    const competenciaYm = normYm(req.body.competenciaYm || req.body.competencia);

    const prazo = toYmdOrEmpty(req.body.prazo);
    const realizado = toYmdOrEmpty(req.body.realizado);

    const rawStatus = req.body.status || "";
    const finalStatus = applyDoneLateRule(rawStatus, prazo, realizado);

    const task: any = {
      competenciaYm,
      competencia: competenciaYm,
      recorrencia: req.body.recorrencia || "",
      tipo: req.body.tipo || "",
      atividade: mustString(req.body.atividade, "Atividade"),
      responsavelEmail,
      responsavelNome: String(u?.nome || ""),
      area,
      prazo,
      realizado,
      status: finalStatus,
      observacoes: req.body.observacoes || "",
      createdAt: now,
      createdBy: me.email,
      updatedAt: now,
      updatedBy: me.email,
      deletedAt: "",
      deletedBy: "",
    };

    const created = await sheets.createTask(task);
    bustTasksCache();
    res.json({ ok: true, task: created });
  })
);

app.post(
  "/api/tasks/:id/duplicate",
  authMiddleware,
  a(async (req: any, res: any) => {
    const me = req.user as AuthedUser;
    if (me.role === "USER") return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const id = mustString(req.params.id, "id");
    const cur = await getTaskByIdCached(id);
    if (!cur) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    if (me.role === "LEADER" && String((cur as any).area || "") !== String(me.area || "")) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const newEmail = safeLowerEmail((cur as any).responsavelEmail);
    const u = await getUserByEmailSafe(newEmail);
    const competenciaYm = normYm((cur as any).competenciaYm || (cur as any).competencia);

    const now = nowIso();
    const copy: any = {
      competenciaYm,
      competencia: competenciaYm,
      recorrencia: (cur as any).recorrencia || "",
      tipo: (cur as any).tipo || "",
      atividade: (cur as any).atividade || "",
      responsavelEmail: newEmail,
      responsavelNome: String(u?.nome || (cur as any).responsavelNome || ""),
      area: String(u?.area || (cur as any).area || me.area || ""),
      prazo: toYmdOrEmpty((cur as any).prazo),
      realizado: "",
      status: "Em Andamento",
      observacoes: (cur as any).observacoes || "",
      createdAt: now,
      createdBy: me.email,
      updatedAt: now,
      updatedBy: me.email,
      deletedAt: "",
      deletedBy: "",
    };

    const created = await sheets.createTask(copy);
    bustTasksCache();
    res.json({ ok: true, task: created });
  })
);

app.put(
  "/api/tasks/:id",
  authMiddleware,
  a(async (req: any, res: any) => {
    const me = req.user as AuthedUser;
    const id = mustString(req.params.id, "id");

    const current = await getTaskByIdCached(id);
    if (!current) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    // USER: status/realizado/observacoes apenas
    if (me.role === "USER") {
      if (safeLowerEmail((current as any).responsavelEmail) !== me.email) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      const patch: any = { updatedAt: nowIso(), updatedBy: me.email };
      if (req.body.status !== undefined) patch.status = req.body.status;
      if (req.body.realizado !== undefined) patch.realizado = req.body.realizado;
      if (req.body.observacoes !== undefined) patch.observacoes = String(req.body.observacoes || "");

      if (patch.status === undefined && patch.realizado === undefined && patch.observacoes === undefined) {
        return res.status(403).json({ ok: false, error: "Sem alterações permitidas." });
      }

      normalizeClear(patch);
      if (patch.realizado !== undefined) patch.realizado = toYmdOrEmpty(patch.realizado);

      const finalPrazo = (current as any).prazo || "";
      const finalRealizado = patch.realizado !== undefined ? patch.realizado : (current as any).realizado || "";
      const finalStatusRaw = patch.status !== undefined ? patch.status : (current as any).status || "";
      patch.status = applyDoneLateRule(finalStatusRaw, finalPrazo, finalRealizado);

      const updated = await sheets.updateTask(id, patch);
      bustTasksCache();
      return res.json({ ok: true, task: updated });
    }

    // LEADER/ADMIN
    const patch: any = { ...req.body, updatedAt: nowIso(), updatedBy: me.email };
    normalizeClear(patch);

    if (patch.prazo !== undefined) patch.prazo = toYmdOrEmpty(patch.prazo);
    if (patch.realizado !== undefined) patch.realizado = toYmdOrEmpty(patch.realizado);

    if (patch.competenciaYm || patch.competencia) {
      const ym = normYm(patch.competenciaYm || patch.competencia);
      patch.competenciaYm = ym;
      patch.competencia = ym;
    }

    if (patch.responsavelEmail) {
      const newEmail = safeLowerEmail(patch.responsavelEmail);
      const u = await getUserByEmailSafe(newEmail);
      patch.responsavelEmail = newEmail;
      patch.responsavelNome = String(u?.nome || "");
      patch.area = String(u?.area || (current as any).area || "");

      if (me.role === "LEADER" && String(patch.area || "") !== String(me.area || "")) {
        return res.status(403).json({ ok: false, error: "Leader não pode reatribuir para fora da área." });
      }
    }

    if (!canEditTask(me, current as any, patch)) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const finalPrazo = patch.prazo !== undefined ? patch.prazo : (current as any).prazo || "";
    const finalRealizado = patch.realizado !== undefined ? patch.realizado : (current as any).realizado || "";
    const finalStatusRaw = patch.status !== undefined ? patch.status : (current as any).status || "";
    patch.status = applyDoneLateRule(finalStatusRaw, finalPrazo, finalRealizado);

    const updated = await sheets.updateTask(id, patch);
    bustTasksCache();
    res.json({ ok: true, task: updated });
  })
);

app.delete(
  "/api/tasks/:id",
  authMiddleware,
  a(async (req: any, res: any) => {
    const me = req.user as AuthedUser;
    const id = mustString(req.params.id, "id");

    const current = await getTaskByIdCached(id);
    if (!current) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    if (!canDeleteTask(me, current as any)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const deleted = await sheets.softDeleteTask(id, me.email);
    bustTasksCache();
    res.json({ ok: true, task: deleted });
  })
);

/* handler de erro */
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("SERVER_ERROR:", err);
  res.status(500).json({ ok: false, error: err?.message || "SERVER_ERROR" });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`OK http://localhost:${port}`));
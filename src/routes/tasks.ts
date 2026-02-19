import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { requireAuth } from "../middleware/auth";
import { mustString, optStr, nowIso, calcStatus } from "../utils";

const router = Router();
router.use(requireAuth);

interface TaskDbRow {
  id: string;
  tenant_id: string;
  competencia_ym: string;
  recorrencia: string;
  tipo: string;
  atividade: string;
  responsavel_email: string;
  responsavel_nome: string;
  area: string;
  prazo: string | null;
  realizado: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

function rowToTask(row: TaskDbRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    competenciaYm: row.competencia_ym,
    recorrencia: row.recorrencia,
    tipo: row.tipo,
    atividade: row.atividade,
    responsavelEmail: row.responsavel_email,
    responsavelNome: row.responsavel_nome,
    area: row.area,
    prazo: row.prazo || "",
    realizado: row.realizado || "",
    status: row.status,
    observacoes: row.observacoes || "",
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function buildWhereClause(user: Request["user"]): { where: string; params: unknown[] } {
  const baseWhere = "tenant_id = ? AND deleted_at IS NULL";
  const params: unknown[] = [user!.tenantId];

  if (user!.role === "ADMIN") {
    return { where: baseWhere, params };
  }
  if (user!.role === "LEADER") {
    return { where: `${baseWhere} AND area = ?`, params: [...params, user!.area] };
  }
  // USER: only own tasks
  return { where: `${baseWhere} AND responsavel_email = ?`, params: [...params, user!.email] };
}

// GET /api/tasks
router.get("/", (req: Request, res: Response): void => {
  try {
    const { where, params } = buildWhereClause(req.user);

    // Optional filters from query
    const { area, responsavel, status, competenciaYm, search } = req.query;
    let dynamicWhere = where;
    const dynamicParams = [...params];

    if (area && typeof area === "string") {
      dynamicWhere += " AND area = ?";
      dynamicParams.push(area);
    }
    if (responsavel && typeof responsavel === "string") {
      dynamicWhere += " AND responsavel_email = ?";
      dynamicParams.push(responsavel);
    }
    if (status && typeof status === "string") {
      dynamicWhere += " AND status = ?";
      dynamicParams.push(status);
    }
    if (competenciaYm && typeof competenciaYm === "string") {
      dynamicWhere += " AND competencia_ym = ?";
      dynamicParams.push(competenciaYm);
    }
    if (search && typeof search === "string") {
      dynamicWhere += " AND (atividade LIKE ? OR observacoes LIKE ?)";
      dynamicParams.push(`%${search}%`, `%${search}%`);
    }

    const rows = db.prepare(`
      SELECT * FROM tasks WHERE ${dynamicWhere}
      ORDER BY competencia_ym DESC, prazo ASC, created_at DESC
    `).all(...dynamicParams) as TaskDbRow[];

    res.json({ tasks: rows.map(rowToTask) });
  } catch {
    res.status(500).json({ error: "Erro ao buscar tarefas.", code: "INTERNAL" });
  }
});

// POST /api/tasks
router.post("/", (req: Request, res: Response): void => {
  try {
    const user = req.user!;
    const tenantId = req.tenantId!;
    const body = req.body;

    const atividade = mustString(body.atividade, "Atividade");
    if (atividade.length > 200) {
      res.status(400).json({ error: "Atividade muito longa (máx 200 chars).", code: "VALIDATION" });
      return;
    }

    // Determine the responsible user
    let responsavelEmail: string;
    let responsavelNome: string;
    let area: string;

    if (user.role === "ADMIN" || user.role === "LEADER") {
      responsavelEmail = mustString(body.responsavelEmail, "Responsável");
      // Get user info
      const respUser = db.prepare("SELECT nome, area FROM users WHERE tenant_id = ? AND email = ?")
        .get(tenantId, responsavelEmail) as { nome: string; area: string } | undefined;

      if (!respUser) {
        res.status(400).json({ error: "Responsável não encontrado.", code: "USER_NOT_FOUND" });
        return;
      }

      // LEADER can only assign to users in their area
      if (user.role === "LEADER" && respUser.area !== user.area) {
        res.status(403).json({ error: "LEADER só pode atribuir tarefas da sua área.", code: "FORBIDDEN" });
        return;
      }

      responsavelNome = respUser.nome;
      area = respUser.area;
    } else {
      // USER creates tasks for themselves
      responsavelEmail = user.email;
      responsavelNome = user.nome;
      area = user.area;

      // Validate recorrencia against rules
      const recorrencia = mustString(body.recorrencia, "Recorrência");
      const rule = db.prepare("SELECT allowed_recorrencias FROM rules WHERE tenant_id = ? AND area = ?")
        .get(tenantId, area) as { allowed_recorrencias: string } | undefined;

      if (!rule) {
        res.status(400).json({ error: "Nenhuma regra configurada para sua área. Contate o ADMIN.", code: "NO_RULE" });
        return;
      }

      const allowed: string[] = JSON.parse(rule.allowed_recorrencias || "[]");
      if (!allowed.includes(recorrencia)) {
        res.status(400).json({
          error: `Recorrência "${recorrencia}" não permitida para sua área. Permitidas: ${allowed.join(", ")}`,
          code: "RECORRENCIA_NOT_ALLOWED",
        });
        return;
      }
    }

    const prazo = optStr(body.prazo);
    const realizado = optStr(body.realizado);
    const observacoes = optStr(body.observacoes);

    if (observacoes.length > 1000) {
      res.status(400).json({ error: "Observações muito longas (máx 1000 chars).", code: "VALIDATION" });
      return;
    }

    const status = calcStatus(prazo, realizado);
    const id = uuidv4();
    const now = nowIso();

    db.prepare(`
      INSERT INTO tasks (id, tenant_id, competencia_ym, recorrencia, tipo, atividade,
        responsavel_email, responsavel_nome, area, prazo, realizado, status, observacoes,
        created_at, created_by, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, tenantId,
      mustString(body.competenciaYm, "Competência"),
      mustString(body.recorrencia, "Recorrência"),
      mustString(body.tipo, "Tipo"),
      atividade,
      responsavelEmail, responsavelNome, area,
      prazo || null, realizado || null,
      status, observacoes || null,
      now, user.email, now, user.email
    );

    const created = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskDbRow;
    res.status(201).json({ task: rowToTask(created) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar tarefa.";
    res.status(400).json({ error: msg, code: "VALIDATION" });
  }
});

// PUT /api/tasks/:id
router.put("/:id", (req: Request, res: Response): void => {
  try {
    const user = req.user!;
    const tenantId = req.tenantId!;
    const { id } = req.params;

    const task = db.prepare("SELECT * FROM tasks WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL")
      .get(id, tenantId) as TaskDbRow | undefined;

    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada.", code: "NOT_FOUND" });
      return;
    }

    // Access check
    if (user.role === "USER" && task.responsavel_email !== user.email) {
      res.status(403).json({ error: "Sem permissão para editar esta tarefa.", code: "FORBIDDEN" });
      return;
    }
    if (user.role === "LEADER" && task.area !== user.area) {
      res.status(403).json({ error: "Sem permissão para editar esta tarefa.", code: "FORBIDDEN" });
      return;
    }

    const body = req.body;
    const prazo = optStr(body.prazo ?? task.prazo);
    const realizado = optStr(body.realizado ?? task.realizado);
    const atividade = optStr(body.atividade ?? task.atividade);
    const observacoes = optStr(body.observacoes ?? task.observacoes);
    const status = calcStatus(prazo, realizado);
    const now = nowIso();

    db.prepare(`
      UPDATE tasks SET
        competencia_ym = ?, recorrencia = ?, tipo = ?, atividade = ?,
        responsavel_email = ?, responsavel_nome = ?, area = ?,
        prazo = ?, realizado = ?, status = ?, observacoes = ?,
        updated_at = ?, updated_by = ?
      WHERE id = ? AND tenant_id = ?
    `).run(
      optStr(body.competenciaYm ?? task.competencia_ym),
      optStr(body.recorrencia ?? task.recorrencia),
      optStr(body.tipo ?? task.tipo),
      atividade,
      optStr(body.responsavelEmail ?? task.responsavel_email),
      optStr(body.responsavelNome ?? task.responsavel_nome),
      optStr(body.area ?? task.area),
      prazo || null, realizado || null,
      status, observacoes || null,
      now, user.email,
      id, tenantId
    );

    const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskDbRow;
    res.json({ task: rowToTask(updated) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar tarefa.";
    res.status(400).json({ error: msg, code: "VALIDATION" });
  }
});

// DELETE /api/tasks/:id (soft delete)
router.delete("/:id", (req: Request, res: Response): void => {
  try {
    const user = req.user!;
    const tenantId = req.tenantId!;
    const { id } = req.params;

    const task = db.prepare("SELECT * FROM tasks WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL")
      .get(id, tenantId) as TaskDbRow | undefined;

    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada.", code: "NOT_FOUND" });
      return;
    }

    // Only ADMIN, LEADER (in area), or users with canDelete permission
    if (user.role === "USER" && !user.canDelete) {
      res.status(403).json({ error: "Sem permissão para excluir tarefas.", code: "FORBIDDEN" });
      return;
    }
    if (user.role === "LEADER" && task.area !== user.area) {
      res.status(403).json({ error: "Sem permissão para excluir esta tarefa.", code: "FORBIDDEN" });
      return;
    }

    db.prepare(`
      UPDATE tasks SET deleted_at = ?, deleted_by = ?
      WHERE id = ? AND tenant_id = ?
    `).run(nowIso(), user.email, id, tenantId);

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao excluir tarefa.", code: "INTERNAL" });
  }
});

// POST /api/tasks/:id/duplicate
router.post("/:id/duplicate", (req: Request, res: Response): void => {
  try {
    const user = req.user!;
    const tenantId = req.tenantId!;
    const { id } = req.params;

    if (user.role === "USER") {
      res.status(403).json({ error: "Sem permissão para duplicar tarefas.", code: "FORBIDDEN" });
      return;
    }

    const task = db.prepare("SELECT * FROM tasks WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL")
      .get(id, tenantId) as TaskDbRow | undefined;

    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada.", code: "NOT_FOUND" });
      return;
    }

    const newId = uuidv4();
    const now = nowIso();

    db.prepare(`
      INSERT INTO tasks (id, tenant_id, competencia_ym, recorrencia, tipo, atividade,
        responsavel_email, responsavel_nome, area, prazo, realizado, status, observacoes,
        created_at, created_by, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'Em Andamento', ?, ?, ?, ?, ?)
    `).run(
      newId, tenantId, task.competencia_ym, task.recorrencia, task.tipo,
      task.atividade, task.responsavel_email, task.responsavel_nome, task.area,
      task.prazo, task.observacoes, now, user.email, now, user.email
    );

    const created = db.prepare("SELECT * FROM tasks WHERE id = ?").get(newId) as TaskDbRow;
    res.status(201).json({ task: rowToTask(created) });
  } catch {
    res.status(500).json({ error: "Erro ao duplicar tarefa.", code: "INTERNAL" });
  }
});

export default router;

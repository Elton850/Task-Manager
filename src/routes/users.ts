import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { safeLowerEmail, nowIso } from "../utils";

const router = Router();
router.use(requireAuth);

interface UserDbRow {
  id: string;
  tenant_id: string;
  email: string;
  nome: string;
  role: string;
  area: string;
  active: number;
  can_delete: number;
  must_change_password: number;
  created_at: string;
}

function rowToUser(row: UserDbRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    nome: row.nome,
    role: row.role,
    area: row.area,
    active: row.active === 1,
    canDelete: row.can_delete === 1,
    mustChangePassword: row.must_change_password === 1,
    createdAt: row.created_at,
  };
}

// GET /api/users — active users (filtered by role for selection dropdowns)
router.get("/", (req: Request, res: Response): void => {
  try {
    const user = req.user!;
    const tenantId = req.tenantId!;

    let rows: UserDbRow[];

    if (user.role === "ADMIN") {
      rows = db.prepare("SELECT * FROM users WHERE tenant_id = ? AND active = 1 ORDER BY nome ASC")
        .all(tenantId) as UserDbRow[];
    } else if (user.role === "LEADER") {
      rows = db.prepare("SELECT * FROM users WHERE tenant_id = ? AND active = 1 AND area = ? ORDER BY nome ASC")
        .all(tenantId, user.area) as UserDbRow[];
    } else {
      rows = db.prepare("SELECT * FROM users WHERE tenant_id = ? AND email = ?")
        .all(tenantId, user.email) as UserDbRow[];
    }

    res.json({ users: rows.map(rowToUser) });
  } catch {
    res.status(500).json({ error: "Erro ao buscar usuários.", code: "INTERNAL" });
  }
});

// GET /api/users/all — all users (ADMIN only)
router.get("/all", requireRole("ADMIN"), (req: Request, res: Response): void => {
  try {
    const rows = db.prepare("SELECT * FROM users WHERE tenant_id = ? ORDER BY nome ASC")
      .all(req.tenantId!) as UserDbRow[];
    res.json({ users: rows.map(rowToUser) });
  } catch {
    res.status(500).json({ error: "Erro ao buscar usuários.", code: "INTERNAL" });
  }
});

// POST /api/users — create user (ADMIN only)
router.post("/", requireRole("ADMIN"), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { nome, email: emailRaw, role, area, canDelete } = req.body;

    if (!nome || !emailRaw || !role || !area) {
      res.status(400).json({ error: "Nome, email, role e área são obrigatórios.", code: "MISSING_FIELDS" });
      return;
    }

    const email = safeLowerEmail(emailRaw);

    const existing = db.prepare("SELECT id FROM users WHERE tenant_id = ? AND email = ?")
      .get(tenantId, email);

    if (existing) {
      res.status(409).json({ error: "Email já cadastrado nesta empresa.", code: "DUPLICATE_EMAIL" });
      return;
    }

    if (!["USER", "LEADER", "ADMIN"].includes(role)) {
      res.status(400).json({ error: "Role inválido.", code: "INVALID_ROLE" });
      return;
    }

    const id = uuidv4();
    const now = nowIso();

    db.prepare(`
      INSERT INTO users (id, tenant_id, email, nome, role, area, active, can_delete, password_hash, must_change_password, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, '', 1, ?)
    `).run(id, tenantId, email, String(nome).trim(), role, String(area).trim(), canDelete ? 1 : 0, now);

    const created = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserDbRow;
    res.status(201).json({ user: rowToUser(created) });
  } catch {
    res.status(500).json({ error: "Erro ao criar usuário.", code: "INTERNAL" });
  }
});

// PUT /api/users/:id — update user (ADMIN only)
router.put("/:id", requireRole("ADMIN"), (req: Request, res: Response): void => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    const existing = db.prepare("SELECT * FROM users WHERE id = ? AND tenant_id = ?")
      .get(id, tenantId) as UserDbRow | undefined;

    if (!existing) {
      res.status(404).json({ error: "Usuário não encontrado.", code: "NOT_FOUND" });
      return;
    }

    const { nome, role, area, canDelete } = req.body;

    if (role && !["USER", "LEADER", "ADMIN"].includes(role)) {
      res.status(400).json({ error: "Role inválido.", code: "INVALID_ROLE" });
      return;
    }

    db.prepare(`
      UPDATE users SET
        nome = ?, role = ?, area = ?, can_delete = ?
      WHERE id = ? AND tenant_id = ?
    `).run(
      nome || existing.nome,
      role || existing.role,
      area || existing.area,
      canDelete !== undefined ? (canDelete ? 1 : 0) : existing.can_delete,
      id, tenantId
    );

    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserDbRow;
    res.json({ user: rowToUser(updated) });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar usuário.", code: "INTERNAL" });
  }
});

// PATCH /api/users/:id/toggle-active (ADMIN only)
router.patch("/:id/toggle-active", requireRole("ADMIN"), (req: Request, res: Response): void => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    // Prevent deactivating yourself
    if (id === req.user!.id) {
      res.status(400).json({ error: "Não é possível desativar sua própria conta.", code: "SELF_DEACTIVATE" });
      return;
    }

    const existing = db.prepare("SELECT * FROM users WHERE id = ? AND tenant_id = ?")
      .get(id, tenantId) as UserDbRow | undefined;

    if (!existing) {
      res.status(404).json({ error: "Usuário não encontrado.", code: "NOT_FOUND" });
      return;
    }

    const newActive = existing.active === 1 ? 0 : 1;
    db.prepare("UPDATE users SET active = ? WHERE id = ? AND tenant_id = ?").run(newActive, id, tenantId);

    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserDbRow;
    res.json({ user: rowToUser(updated) });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar usuário.", code: "INTERNAL" });
  }
});

export default router;

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import db from "../db";
import { requireAuth } from "../middleware/auth";
import { nowIso } from "../utils";

const router = Router();

/** Comparação segura contra timing attack para chave super-admin. */
function secureCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Super-admin key for tenant management (set in env)
function checkSuperAdmin(req: Request, res: Response): boolean {
  const key = (req.headers["x-super-admin-key"] as string) || "";
  const expected = process.env.SUPER_ADMIN_KEY || "";

  if (!expected || !secureCompare(key, expected)) {
    res.status(403).json({ error: "Acesso negado.", code: "FORBIDDEN" });
    return false;
  }
  return true;
}

// GET /api/tenants — list all tenants (super admin)
router.get("/", (req: Request, res: Response): void => {
  if (!checkSuperAdmin(req, res)) return;
  try {
    const tenants = db.prepare("SELECT id, slug, name, active, created_at FROM tenants ORDER BY name ASC").all();
    res.json({ tenants });
  } catch {
    res.status(500).json({ error: "Erro ao buscar tenants.", code: "INTERNAL" });
  }
});

// GET /api/tenants/current — public tenant info for current request
router.get("/current", (req: Request, res: Response): void => {
  if (!req.tenant) {
    res.status(404).json({ error: "Tenant não identificado.", code: "NO_TENANT" });
    return;
  }
  res.json({
    tenant: {
      id: req.tenant.id,
      slug: req.tenant.slug,
      name: req.tenant.name,
    }
  });
});

// POST /api/tenants — create tenant + initial admin user (super admin)
router.post("/", async (req: Request, res: Response): Promise<void> => {
  if (!checkSuperAdmin(req, res)) return;

  try {
    const { slug, name, adminEmail, adminPassword, adminNome } = req.body;

    if (!slug || !name || !adminEmail || !adminPassword) {
      res.status(400).json({ error: "slug, name, adminEmail e adminPassword são obrigatórios.", code: "MISSING_FIELDS" });
      return;
    }

    const slugNorm = String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const existing = db.prepare("SELECT id FROM tenants WHERE slug = ?").get(slugNorm);

    if (existing) {
      res.status(409).json({ error: "Slug já em uso.", code: "DUPLICATE_SLUG" });
      return;
    }

    const tenantId = uuidv4();
    const adminId = uuidv4();
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const now = nowIso();

    const DEFAULT_LOOKUPS: Record<string, string[]> = {
      AREA: ["TI", "Financeiro", "RH", "Operações", "Comercial"],
      RECORRENCIA: ["Diário", "Semanal", "Quinzenal", "Mensal", "Trimestral", "Semestral", "Anual", "Pontual"],
      TIPO: ["Rotina", "Projeto", "Reunião", "Auditoria", "Treinamento"],
    };

    const insertAll = db.transaction(() => {
      db.prepare("INSERT INTO tenants (id, slug, name, active, created_at) VALUES (?, ?, ?, 1, ?)")
        .run(tenantId, slugNorm, String(name).trim(), now);

      db.prepare(`
        INSERT INTO users (id, tenant_id, email, nome, role, area, active, can_delete, password_hash, must_change_password, created_at)
        VALUES (?, ?, ?, ?, 'ADMIN', 'TI', 1, 1, ?, 0, ?)
      `).run(adminId, tenantId, String(adminEmail).trim().toLowerCase(), adminNome || "Administrador", passwordHash, now);

      let order = 0;
      for (const [category, values] of Object.entries(DEFAULT_LOOKUPS)) {
        for (const value of values) {
          db.prepare("INSERT OR IGNORE INTO lookups (id, tenant_id, category, value, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?)")
            .run(uuidv4(), tenantId, category, value, order++, now);
        }
      }
    });

    insertAll();

    res.status(201).json({
      tenant: { id: tenantId, slug: slugNorm, name },
      admin: { email: adminEmail },
      accessUrl: `https://${slugNorm}.taskmanager.com`,
    });
  } catch {
    res.status(500).json({ error: "Erro ao criar tenant.", code: "INTERNAL" });
  }
});

// PATCH /api/tenants/:id/toggle-active (super admin)
router.patch("/:id/toggle-active", (req: Request, res: Response): void => {
  if (!checkSuperAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(id) as { active: number } | undefined;
    if (!tenant) {
      res.status(404).json({ error: "Tenant não encontrado.", code: "NOT_FOUND" });
      return;
    }
    db.prepare("UPDATE tenants SET active = ? WHERE id = ?").run(tenant.active === 1 ? 0 : 1, id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro.", code: "INTERNAL" });
  }
});

// GET /api/tenants/:id/info — tenant info (authenticated, same tenant)
router.get("/:id/info", requireAuth, (req: Request, res: Response): void => {
  try {
    if (req.user!.tenantId !== req.params.id) {
      res.status(403).json({ error: "Acesso negado.", code: "FORBIDDEN" });
      return;
    }
    const tenant = db.prepare("SELECT id, slug, name, active, created_at FROM tenants WHERE id = ?")
      .get(req.params.id);
    if (!tenant) {
      res.status(404).json({ error: "Tenant não encontrado.", code: "NOT_FOUND" });
      return;
    }
    res.json({ tenant });
  } catch {
    res.status(500).json({ error: "Erro.", code: "INTERNAL" });
  }
});

export default router;

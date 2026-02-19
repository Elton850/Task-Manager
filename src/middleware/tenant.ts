import { Request, Response, NextFunction } from "express";
import db from "../db";
import type { Tenant } from "../types";

interface TenantDbRow {
  id: string;
  slug: string;
  name: string;
  active: number;
  created_at: string;
}

function resolveTenantSlug(req: Request): string | null {
  // 1. Custom header (used by frontend SPA)
  const header = req.headers["x-tenant-slug"];
  if (header && typeof header === "string") return header.trim().toLowerCase();

  // 2. Subdomain from Host header (production: empresaX.taskmanager.com)
  const host = req.headers["host"] || "";
  const parts = host.split(".");
  if (parts.length >= 3 && !host.includes("localhost")) {
    return parts[0].toLowerCase();
  }

  // 3. Query param (development fallback)
  const qParam = req.query["tenant"];
  if (qParam && typeof qParam === "string") return qParam.trim().toLowerCase();

  return null;
}

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip tenant resolution for CSRF endpoint and static files
  if (req.path === "/api/csrf" || req.path === "/api/health") {
    return next();
  }

  const slug = resolveTenantSlug(req);
  if (!slug) {
    res.status(400).json({ error: "Tenant não identificado.", code: "NO_TENANT" });
    return;
  }

  const row = db.prepare("SELECT * FROM tenants WHERE slug = ? AND active = 1").get(slug) as TenantDbRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Empresa não encontrada ou inativa.", code: "TENANT_NOT_FOUND" });
    return;
  }

  req.tenant = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    active: row.active === 1,
    createdAt: row.created_at,
  };
  req.tenantId = row.id;

  next();
}

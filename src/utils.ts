export function mustString(v: unknown, label: string) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`${label} é obrigatório.`);
  return s;
}

export function toBool(v: any) {
  if (typeof v === "boolean") return v;
  return String(v ?? "").toUpperCase() === "TRUE";
}

export function nowIso() {
  return new Date().toISOString();
}

export function safeLowerEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}
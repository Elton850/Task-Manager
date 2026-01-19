import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { sheets } from "./sheetsApi";
import { safeLowerEmail, toBool } from "./utils";
import type { Role } from "./types";

const JWT_SECRET = process.env.JWT_SECRET!;

export type AuthedUser = {
  email: string;
  nome: string;
  role: Role;
  area: string;
  canDelete: boolean;
};

export function signToken(user: AuthedUser) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET não configurado.");
  return jwt.sign(user, JWT_SECRET, { expiresIn: "12h" });
}

export function verifyToken(token: string): AuthedUser {
  return jwt.verify(token, JWT_SECRET) as AuthedUser;
}

export async function login(emailRaw: string, password: string): Promise<{ token: string; user: AuthedUser }> {
  const email = safeLowerEmail(emailRaw);
  const row = await sheets.getUserByEmail(email);
  if (!row) throw new Error("Usuário não cadastrado.");
  if (!toBool(row.active)) throw new Error("Usuário inativo.");
  if (!row.passwordHash) throw new Error("Usuário sem senha configurada.");

  const ok = await bcrypt.compare(password, String(row.passwordHash));
  if (!ok) throw new Error("Credenciais inválidas.");

  const user: AuthedUser = {
    email,
    nome: String(row.nome || ""),
    role: String(row.role || "USER").toUpperCase() as Role,
    area: String(row.area || ""),
    canDelete: toBool(row.canDelete),
  };

  return { token: signToken(user), user };
}

import "dotenv/config";

const API_URL = process.env.SHEETS_API_URL!;
const API_KEY = process.env.SHEETS_API_KEY!;

async function callSheets<T>(action: string, payload: any = {}): Promise<T> {
  if (!API_URL || !API_KEY) throw new Error("SHEETS_API_URL / SHEETS_API_KEY não configurados.");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: API_KEY, action, ...payload }),
  });

  const data = await res.json().catch(() => ({}));
  if (!data?.ok) throw new Error(data?.error || "Erro ao chamar Sheets API");
  return data as T;
}

export const sheets = {
  async getUserByEmail(email: string) {
    const data = await callSheets<{ ok: true; user: any }>("users.getByEmail", { email });
    return data.user;
  },

  async listTasks() {
    const data = await callSheets<{ ok: true; tasks: any[] }>("tasks.list");
    return data.tasks;
  },

  async createTask(task: any) {
    const data = await callSheets<{ ok: true; task: any }>("tasks.create", { task });
    return data.task;
  },

  async updateTask(id: string, patch: any) {
    const data = await callSheets<{ ok: true; task: any }>("tasks.update", { id, patch });
    return data.task;
  },

  async softDeleteTask(id: string, deletedBy: string) {
    const data = await callSheets<{ ok: true; task: any }>("tasks.softDelete", { id, deletedBy });
    return data.task;
  },

  async listLookups() {
    const data = await callSheets<{ ok: true; lookups: any }>("lookups.list");
    return data.lookups;
  },

  async upsertLookup(item: any) {
    const data = await callSheets<{ ok: true; lookups: any }>("lookups.upsert", { item });
    return data.lookups;
  },
};

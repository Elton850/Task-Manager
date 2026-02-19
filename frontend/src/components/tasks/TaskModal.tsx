import React, { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Badge, { getStatusVariant } from "@/components/ui/Badge";
import { useAuth } from "@/contexts/AuthContext";
import type { Task, Lookups, User } from "@/types";

interface TaskModalProps {
  open: boolean;
  task?: Task | null;
  lookups: Lookups;
  users: User[];
  onClose: () => void;
  onSave: (data: Partial<Task>) => Promise<void>;
  loading?: boolean;
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function TaskModal({ open, task, lookups, users, onClose, onSave, loading }: TaskModalProps) {
  const { user } = useAuth();
  const isEdit = !!task;

  const [form, setForm] = useState({
    competenciaYm: task?.competenciaYm || currentYearMonth(),
    recorrencia: task?.recorrencia || "",
    tipo: task?.tipo || "",
    atividade: task?.atividade || "",
    responsavelEmail: task?.responsavelEmail || (user?.role === "USER" ? user.email : ""),
    prazo: task?.prazo || "",
    realizado: task?.realizado || "",
    observacoes: task?.observacoes || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm({
        competenciaYm: task?.competenciaYm || currentYearMonth(),
        recorrencia: task?.recorrencia || "",
        tipo: task?.tipo || "",
        atividade: task?.atividade || "",
        responsavelEmail: task?.responsavelEmail || (user?.role === "USER" ? user.email : ""),
        prazo: task?.prazo || "",
        realizado: task?.realizado || "",
        observacoes: task?.observacoes || "",
      });
      setErrors({});
    }
  }, [open, task, user]);

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: "" }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.competenciaYm) errs.competenciaYm = "Competência é obrigatória";
    if (!form.recorrencia) errs.recorrencia = "Recorrência é obrigatória";
    if (!form.tipo) errs.tipo = "Tipo é obrigatório";
    if (!form.atividade.trim()) errs.atividade = "Descrição da atividade é obrigatória";
    if (form.atividade.length > 200) errs.atividade = "Máximo 200 caracteres";
    if (user?.role !== "USER" && !form.responsavelEmail) errs.responsavelEmail = "Responsável é obrigatório";
    if (form.observacoes.length > 1000) errs.observacoes = "Máximo 1000 caracteres";

    if (form.prazo && form.realizado && form.realizado < form.prazo) {
      // This is valid (early completion), no error
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSave({
      ...form,
      responsavelEmail: user?.role === "USER" ? user.email : form.responsavelEmail,
    });
  };

  // Filter users for LEADER (only their area)
  const selectableUsers = user?.role === "LEADER"
    ? users.filter(u => u.area === user.area)
    : users;

  const recorrenciaOptions = (lookups.RECORRENCIA || []).map(v => ({ value: v, label: v }));
  const tipoOptions = (lookups.TIPO || []).map(v => ({ value: v, label: v }));
  const userOptions = selectableUsers.map(u => ({ value: u.email, label: `${u.nome} (${u.area})` }));

  // Generate YM options (6 months back + 6 months forward)
  const ymOptions = Array.from({ length: 13 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6 + i);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { value: ym, label };
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Tarefa" : "Nova Tarefa"}
      subtitle={isEdit && task?.status ? undefined : undefined}
      size="lg"
      footer={
        <>
          {isEdit && task?.status && (
            <div className="flex-1">
              <Badge variant={getStatusVariant(task.status)}>{task.status}</Badge>
            </div>
          )}
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading}>
            {isEdit ? "Salvar alterações" : "Criar tarefa"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Competência"
            required
            value={form.competenciaYm}
            onChange={e => set("competenciaYm", e.target.value)}
            options={ymOptions}
            error={errors.competenciaYm}
          />

          <Select
            label="Recorrência"
            required
            value={form.recorrencia}
            onChange={e => set("recorrencia", e.target.value)}
            options={recorrenciaOptions}
            placeholder="Selecione..."
            error={errors.recorrencia}
          />

          <Select
            label="Tipo"
            required
            value={form.tipo}
            onChange={e => set("tipo", e.target.value)}
            options={tipoOptions}
            placeholder="Selecione..."
            error={errors.tipo}
          />

          {user?.role !== "USER" ? (
            <Select
              label="Responsável"
              required
              value={form.responsavelEmail}
              onChange={e => set("responsavelEmail", e.target.value)}
              options={userOptions}
              placeholder="Selecione..."
              error={errors.responsavelEmail}
            />
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-300">Responsável</label>
              <div className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-400">
                {user.nome} <span className="text-slate-600">(você)</span>
              </div>
            </div>
          )}
        </div>

        <Textarea
          label="Descrição da atividade"
          required
          value={form.atividade}
          onChange={e => set("atividade", e.target.value)}
          placeholder="Descreva a atividade..."
          rows={3}
          error={errors.atividade}
          hint={`${form.atividade.length}/200 caracteres`}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Prazo"
            type="date"
            value={form.prazo}
            onChange={e => set("prazo", e.target.value)}
          />
          <Input
            label="Data realizado"
            type="date"
            value={form.realizado}
            onChange={e => set("realizado", e.target.value)}
            hint={form.realizado ? "Status será recalculado automaticamente" : undefined}
          />
        </div>

        <Textarea
          label="Observações"
          value={form.observacoes}
          onChange={e => set("observacoes", e.target.value)}
          placeholder="Observações opcionais..."
          rows={2}
          error={errors.observacoes}
          hint={form.observacoes ? `${form.observacoes.length}/1000 caracteres` : undefined}
        />

        {isEdit && task && (
          <div className="pt-2 border-t border-slate-700/60">
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <span>Criado por: <span className="text-slate-400">{task.createdBy}</span></span>
              <span>Em: <span className="text-slate-400">{new Date(task.createdAt).toLocaleDateString("pt-BR")}</span></span>
              {task.updatedBy && (
                <>
                  <span>Editado por: <span className="text-slate-400">{task.updatedBy}</span></span>
                  <span>Em: <span className="text-slate-400">{new Date(task.updatedAt).toLocaleDateString("pt-BR")}</span></span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

import React from "react";
import { Edit2, Trash2, Copy, ChevronUp, ChevronDown } from "lucide-react";
import Badge, { getStatusVariant } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import type { Task } from "@/types";

type SortField = "competenciaYm" | "prazo" | "status" | "area" | "responsavelNome" | "recorrencia";

interface TaskTableProps {
  tasks: Task[];
  loading: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onDuplicate?: (task: Task) => void;
}

export default function TaskTable({ tasks, loading, onEdit, onDelete, onDuplicate }: TaskTableProps) {
  const { user } = useAuth();
  const [sortField, setSortField] = React.useState<SortField>("competenciaYm");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const sorted = [...tasks].sort((a, b) => {
    const va = a[sortField] || "";
    const vb = b[sortField] || "";
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="inline-flex flex-col ml-1 opacity-50">
      {sortField === field
        ? sortDir === "asc" ? <ChevronUp size={12} className="opacity-100 text-brand-400" /> : <ChevronDown size={12} className="opacity-100 text-brand-400" />
        : <ChevronUp size={10} />
      }
    </span>
  );

  const ThSortable = ({ field, label, className = "" }: { field: SortField; label: string; className?: string }) => (
    <th
      onClick={() => handleSort(field)}
      className={`px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 select-none ${className}`}
    >
      {label}<SortIcon field={field} />
    </th>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner text="Carregando tarefas..." />
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
          <span className="text-2xl">📋</span>
        </div>
        <p className="text-sm font-medium text-slate-400">Nenhuma tarefa encontrada</p>
        <p className="text-xs mt-1">Ajuste os filtros ou crie uma nova tarefa</p>
      </div>
    );
  }

  const canDuplicate = user?.role === "ADMIN" || user?.role === "LEADER";

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-xl border border-slate-700/60">
      <table className="min-w-full divide-y divide-slate-700/60">
        <thead className="bg-slate-800/50">
          <tr>
            <ThSortable field="competenciaYm" label="Competência" />
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Atividade</th>
            <ThSortable field="recorrencia" label="Recorrência" className="hidden md:table-cell" />
            <ThSortable field="area" label="Área" className="hidden lg:table-cell" />
            <ThSortable field="responsavelNome" label="Responsável" className="hidden sm:table-cell" />
            <ThSortable field="prazo" label="Prazo" className="hidden md:table-cell" />
            <ThSortable field="status" label="Status" />
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/40 bg-slate-900/40">
          {sorted.map(task => (
            <tr key={task.id} className="hover:bg-slate-800/40 transition-colors">
              <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap font-mono">
                {task.competenciaYm}
              </td>
              <td className="px-4 py-3 text-sm text-slate-200 max-w-xs">
                <div className="truncate" title={task.atividade}>{task.atividade}</div>
                {task.observacoes && (
                  <div className="text-xs text-slate-500 truncate mt-0.5" title={task.observacoes}>
                    {task.observacoes}
                  </div>
                )}
                {/* Mobile extras */}
                <div className="flex flex-wrap gap-1 mt-1 sm:hidden">
                  <span className="text-xs text-slate-500">{task.responsavelNome}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap hidden md:table-cell">
                {task.recorrencia}
              </td>
              <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap hidden lg:table-cell">
                {task.area}
              </td>
              <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap hidden sm:table-cell">
                {task.responsavelNome}
              </td>
              <td className="px-4 py-3 text-sm whitespace-nowrap hidden md:table-cell">
                {task.prazo ? (
                  <span className={task.status === "Em Atraso" ? "text-rose-400 font-medium" : "text-slate-400"}>
                    {new Date(task.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <Badge variant={getStatusVariant(task.status)} size="sm">
                  {task.status}
                </Badge>
                {task.realizado && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    {new Date(task.realizado + "T00:00:00").toLocaleDateString("pt-BR")}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-1">
                  {canDuplicate && onDuplicate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDuplicate(task)}
                      title="Duplicar"
                    >
                      <Copy size={14} />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onEdit(task)} title="Editar">
                    <Edit2 size={14} />
                  </Button>
                  {(user?.role !== "USER" || user.canDelete) && (
                    <Button variant="ghost" size="sm" onClick={() => onDelete(task)} title="Excluir"
                      className="hover:text-rose-400 hover:bg-rose-500/10">
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

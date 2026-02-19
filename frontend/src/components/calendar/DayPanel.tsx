import React from "react";
import { X, Clock, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import Badge, { getStatusVariant } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { Task } from "@/types";

interface DayPanelProps {
  day: number;
  month: number;
  year: number;
  tasks: Task[];
  onClose: () => void;
  onEditTask: (task: Task) => void;
}

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function DayPanel({ day, month, year, tasks, onClose, onEditTask }: DayPanelProps) {
  const dateStr = `${String(day).padStart(2, "0")} de ${MONTHS_PT[month]} de ${year}`;

  const grouped = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    if (!acc[t.status]) acc[t.status] = [];
    acc[t.status].push(t);
    return acc;
  }, {});

  const statusOrder = ["Em Atraso", "Em Andamento", "Concluído em Atraso", "Concluído"];

  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden flex flex-col h-full min-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{dateStr}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <CheckCircle size={32} className="mb-3 opacity-30" />
            <p className="text-sm">Nenhuma tarefa com prazo neste dia</p>
          </div>
        ) : (
          <div className="space-y-4">
            {statusOrder.map(status => {
              const items = grouped[status];
              if (!items?.length) return null;

              const icons: Record<string, React.ReactNode> = {
                "Em Atraso": <AlertCircle size={14} className="text-rose-400" />,
                "Em Andamento": <Clock size={14} className="text-blue-400" />,
                "Concluído em Atraso": <AlertTriangle size={14} className="text-amber-400" />,
                "Concluído": <CheckCircle size={14} className="text-emerald-400" />,
              };

              return (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-2">
                    {icons[status]}
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {status} ({items.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map(task => (
                      <button
                        key={task.id}
                        onClick={() => onEditTask(task)}
                        className="w-full text-left p-3 rounded-lg bg-slate-800/60 border border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-slate-200 flex-1">{task.atividade}</p>
                          <Badge variant={getStatusVariant(task.status)} size="sm">
                            {task.tipo}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                          <span>{task.responsavelNome}</span>
                          <span>·</span>
                          <span>{task.area}</span>
                          {task.realizado && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-500">
                                Realizado: {new Date(task.realizado + "T00:00:00").toLocaleDateString("pt-BR")}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

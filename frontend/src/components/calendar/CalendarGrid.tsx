import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";
import type { Task } from "@/types";

interface CalendarGridProps {
  year: number;
  month: number; // 0-indexed
  tasks: Task[];
  selectedDay: number | null;
  onDayClick: (day: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function getStatusDots(tasks: Task[]): { color: string; label: string }[] {
  const map = new Map<string, { color: string; label: string }>();

  for (const t of tasks) {
    if (!map.has(t.status)) {
      const colorMap: Record<string, { color: string; label: string }> = {
        "Em Andamento":       { color: "bg-blue-400",    label: "Em Andamento" },
        "Concluído":          { color: "bg-emerald-400", label: "Concluído" },
        "Em Atraso":          { color: "bg-rose-400",    label: "Em Atraso" },
        "Concluído em Atraso":{ color: "bg-amber-400",   label: "Concluído em Atraso" },
      };
      map.set(t.status, colorMap[t.status] || { color: "bg-slate-400", label: t.status });
    }
  }

  return Array.from(map.values());
}

export default function CalendarGrid({
  year, month, tasks, selectedDay, onDayClick, onPrev, onNext, onToday,
}: CalendarGridProps) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Group tasks by day (using prazo date)
  const tasksByDay = new Map<number, Task[]>();
  const ymStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  for (const task of tasks) {
    if (task.competenciaYm === ymStr && task.prazo) {
      const prazoDate = new Date(task.prazo + "T00:00:00");
      if (prazoDate.getFullYear() === year && prazoDate.getMonth() === month) {
        const d = prazoDate.getDate();
        if (!tasksByDay.has(d)) tasksByDay.set(d, []);
        tasksByDay.get(d)!.push(task);
      }
    }
  }

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete rows
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
        <h2 className="text-base font-semibold text-slate-100">
          {MONTHS_PT[month]} {year}
        </h2>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" onClick={onToday}>Hoje</Button>
          )}
          <Button variant="ghost" size="sm" onClick={onPrev} icon={<ChevronLeft size={16} />} />
          <Button variant="ghost" size="sm" onClick={onNext} icon={<ChevronRight size={16} />} />
        </div>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-slate-700/60">
        {WEEK_DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="aspect-square p-1 border-b border-r border-slate-700/30 opacity-0" />;

          const dayTasks = tasksByDay.get(day) || [];
          const isToday = isCurrentMonth && today.getDate() === day;
          const isSelected = selectedDay === day;
          const dots = getStatusDots(dayTasks);
          const hasOverdue = dayTasks.some(t => t.status === "Em Atraso");

          return (
            <button
              key={day}
              onClick={() => onDayClick(day)}
              className={`
                relative aspect-square p-1.5 text-left border-b border-r border-slate-700/30
                hover:bg-slate-800/60 transition-colors cursor-pointer
                ${isSelected ? "bg-brand-600/15 border-brand-500/30" : ""}
                ${isToday && !isSelected ? "bg-slate-800/40" : ""}
              `}
            >
              <span className={`
                text-xs font-medium block text-center w-6 h-6 leading-6 mx-auto rounded-full
                ${isToday ? "bg-brand-600 text-white" : isSelected ? "text-brand-300" : hasOverdue ? "text-rose-400" : "text-slate-400"}
              `}>
                {day}
              </span>

              {dayTasks.length > 0 && (
                <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                  {dots.slice(0, 3).map((dot, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${dot.color}`} title={dot.label} />
                  ))}
                </div>
              )}

              {dayTasks.length > 0 && (
                <span className="absolute top-0.5 right-1 text-[9px] text-slate-500">
                  {dayTasks.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-5 py-3 border-t border-slate-700/60">
        {[
          { color: "bg-blue-400",    label: "Em Andamento" },
          { color: "bg-emerald-400", label: "Concluído" },
          { color: "bg-rose-400",    label: "Em Atraso" },
          { color: "bg-amber-400",   label: "Concluído em Atraso" },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${item.color}`} />
            <span className="text-xs text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

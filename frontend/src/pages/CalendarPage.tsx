import React, { useState, useEffect, useCallback } from "react";
import { AlertCircle, Clock, AlertTriangle } from "lucide-react";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import DayPanel from "@/components/calendar/DayPanel";
import TaskModal from "@/components/tasks/TaskModal";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useToast } from "@/contexts/ToastContext";
import { tasksApi, usersApi, lookupsApi } from "@/services/api";
import type { Task, Lookups, User } from "@/types";

export default function CalendarPage() {
  const { toast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [lookups, setLookups] = useState<Lookups>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, usersRes, lookupsRes] = await Promise.all([
        tasksApi.list(),
        usersApi.list(),
        lookupsApi.list(),
      ]);
      setAllTasks(tasksRes.tasks);
      setUsers(usersRes.users);
      setLookups(lookupsRes.lookups);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao carregar dados", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter tasks for selected month
  useEffect(() => {
    const ymStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    setTasks(allTasks.filter(t => t.competenciaYm === ymStr));
  }, [allTasks, year, month]);

  const goToPrev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };

  const goToNext = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const goToToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDay(null);
  };

  // Get tasks for selected day
  const dayTasks = selectedDay
    ? tasks.filter(t => {
        if (!t.prazo) return false;
        const d = new Date(t.prazo + "T00:00:00");
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === selectedDay;
      })
    : [];

  // Alerts: overdue + due soon
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in3Days = new Date(today); in3Days.setDate(in3Days.getDate() + 3);
  const in7Days = new Date(today); in7Days.setDate(in7Days.getDate() + 7);

  const overdueTasks = allTasks.filter(t => t.status === "Em Atraso");
  const dueSoonTasks = allTasks.filter(t => {
    if (t.status !== "Em Andamento" || !t.prazo) return false;
    return t.prazo >= todayStr && t.prazo <= in7Days.toISOString().slice(0, 10);
  });

  const handleSave = async (data: Partial<Task>) => {
    if (!editTask) return;
    setSaving(true);
    try {
      await tasksApi.update(editTask.id, data);
      await load();
      setEditTask(null);
      toast("Tarefa atualizada", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><LoadingSpinner text="Carregando calendário..." /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {(overdueTasks.length > 0 || dueSoonTasks.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {overdueTasks.length > 0 && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <AlertCircle size={16} className="text-rose-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-rose-300">
                  {overdueTasks.length} tarefa{overdueTasks.length !== 1 ? "s" : ""} em atraso
                </p>
                <p className="text-xs text-rose-400/70 mt-0.5">
                  {overdueTasks.slice(0, 2).map(t => t.atividade).join(", ")}
                  {overdueTasks.length > 2 ? ` +${overdueTasks.length - 2}` : ""}
                </p>
              </div>
            </div>
          )}
          {dueSoonTasks.length > 0 && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Clock size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300">
                  {dueSoonTasks.length} tarefa{dueSoonTasks.length !== 1 ? "s" : ""} vencendo em 7 dias
                </p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  {dueSoonTasks.slice(0, 2).map(t => t.atividade).join(", ")}
                  {dueSoonTasks.length > 2 ? ` +${dueSoonTasks.length - 2}` : ""}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calendar + Day Panel */}
      <div className={`grid gap-4 ${selectedDay ? "lg:grid-cols-3" : "grid-cols-1"}`}>
        <div className={selectedDay ? "lg:col-span-2" : ""}>
          <CalendarGrid
            year={year}
            month={month}
            tasks={tasks}
            selectedDay={selectedDay}
            onDayClick={d => setSelectedDay(prev => prev === d ? null : d)}
            onPrev={goToPrev}
            onNext={goToNext}
            onToday={goToToday}
          />
        </div>

        {selectedDay && (
          <div>
            <DayPanel
              day={selectedDay}
              month={month}
              year={year}
              tasks={dayTasks}
              onClose={() => setSelectedDay(null)}
              onEditTask={task => setEditTask(task)}
            />
          </div>
        )}
      </div>

      {/* Edit modal (from day panel) */}
      {editTask && (
        <TaskModal
          open={!!editTask}
          task={editTask}
          lookups={lookups}
          users={users}
          onClose={() => setEditTask(null)}
          onSave={handleSave}
          loading={saving}
        />
      )}
    </div>
  );
}

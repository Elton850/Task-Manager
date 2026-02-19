import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import TaskTable from "@/components/tasks/TaskTable";
import TaskFilters from "@/components/tasks/TaskFilters";
import TaskModal from "@/components/tasks/TaskModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { tasksApi, usersApi, lookupsApi } from "@/services/api";
import type { Task, TaskFilters as Filters, Lookups, User } from "@/types";

const DEFAULT_FILTERS: Filters = {
  search: "", status: "", area: "", responsavel: "", competenciaYm: "",
};

export default function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [lookups, setLookups] = useState<Lookups>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, usersRes, lookupsRes] = await Promise.all([
        tasksApi.list(),
        usersApi.list(),
        lookupsApi.list(),
      ]);
      setTasks(tasksRes.tasks);
      setUsers(usersRes.users);
      setLookups(lookupsRes.lookups);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao carregar dados", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!t.atividade.toLowerCase().includes(s) && !t.observacoes?.toLowerCase().includes(s)) return false;
      }
      if (filters.status && t.status !== filters.status) return false;
      if (filters.area && t.area !== filters.area) return false;
      if (filters.responsavel && t.responsavelEmail !== filters.responsavel) return false;
      if (filters.competenciaYm && t.competenciaYm !== filters.competenciaYm) return false;
      return true;
    });
  }, [tasks, filters]);

  const handleSave = async (data: Partial<Task>) => {
    setSaving(true);
    try {
      if (editTask) {
        const { task } = await tasksApi.update(editTask.id, data);
        setTasks(prev => prev.map(t => t.id === task.id ? task : t));
        toast("Tarefa atualizada", "success");
      } else {
        const { task } = await tasksApi.create(data);
        setTasks(prev => [task, ...prev]);
        toast("Tarefa criada", "success");
      }
      setModalOpen(false);
      setEditTask(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar tarefa", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await tasksApi.delete(deleteTarget.id);
      setTasks(prev => prev.filter(t => t.id !== deleteTarget.id));
      toast("Tarefa excluída", "success");
      setDeleteTarget(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao excluir", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (task: Task) => {
    try {
      const { task: dup } = await tasksApi.duplicate(task.id);
      setTasks(prev => [dup, ...prev]);
      toast("Tarefa duplicada", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao duplicar", "error");
    }
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={load} icon={<RefreshCw size={14} />}>
            Atualizar
          </Button>
          <Button
            size="sm"
            icon={<Plus size={15} />}
            onClick={() => { setEditTask(null); setModalOpen(true); }}
          >
            Nova tarefa
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <TaskFilters
          filters={filters}
          lookups={lookups}
          users={users}
          onChange={f => setFilters(p => ({ ...p, ...f }))}
          onClear={() => setFilters(DEFAULT_FILTERS)}
          totalCount={tasks.length}
          filteredCount={filteredTasks.length}
        />
      </Card>

      {/* Table */}
      <Card padding={false}>
        <TaskTable
          tasks={filteredTasks}
          loading={loading}
          onEdit={task => { setEditTask(task); setModalOpen(true); }}
          onDelete={task => setDeleteTarget(task)}
          onDuplicate={handleDuplicate}
        />
      </Card>

      {/* Task Modal */}
      <TaskModal
        open={modalOpen}
        task={editTask}
        lookups={lookups}
        users={users}
        onClose={() => { setModalOpen(false); setEditTask(null); }}
        onSave={handleSave}
        loading={saving}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir tarefa"
        message={`Deseja excluir a tarefa "${deleteTarget?.atividade}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

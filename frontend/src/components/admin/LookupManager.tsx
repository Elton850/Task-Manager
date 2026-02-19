import React, { useState } from "react";
import { Plus, Edit2, Trash2, Check, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { lookupsApi } from "@/services/api";
import { useToast } from "@/contexts/ToastContext";
import type { LookupItem } from "@/types";

interface LookupManagerProps {
  items: LookupItem[];
  onRefresh: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  AREA: "Áreas",
  RECORRENCIA: "Recorrências",
  TIPO: "Tipos de Tarefa",
};

export default function LookupManager({ items, onRefresh }: LookupManagerProps) {
  const { toast } = useToast();
  const [newValue, setNewValue] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const grouped = items.reduce<Record<string, LookupItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();

  const handleAdd = async (category: string) => {
    const val = (newValue[category] || "").trim();
    if (!val) return;

    setLoading(`add-${category}`);
    try {
      await lookupsApi.add(category, val);
      setNewValue(p => ({ ...p, [category]: "" }));
      onRefresh();
      toast(`"${val}" adicionado com sucesso`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao adicionar", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleRename = async (id: string) => {
    const val = editValue.trim();
    if (!val) return;

    setLoading(`rename-${id}`);
    try {
      await lookupsApi.rename(id, val);
      setEditId(null);
      onRefresh();
      toast("Renomeado com sucesso", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao renomear", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (id: string, value: string) => {
    if (!window.confirm(`Remover "${value}"? Esta ação pode afetar tarefas existentes.`)) return;

    setLoading(`delete-${id}`);
    try {
      await lookupsApi.remove(id);
      onRefresh();
      toast("Item removido", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao remover", "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {categories.map(category => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">
            {CATEGORY_LABELS[category] || category}
          </h3>

          <div className="space-y-1.5 mb-3">
            {grouped[category].map(item => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40"
              >
                {editId === item.id ? (
                  <>
                    <Input
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleRename(item.id);
                        if (e.key === "Escape") setEditId(null);
                      }}
                      className="flex-1 h-7 text-xs"
                      autoFocus
                    />
                    <Button variant="ghost" size="sm" onClick={() => handleRename(item.id)} loading={loading === `rename-${item.id}`}>
                      <Check size={13} className="text-emerald-400" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>
                      <X size={13} />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-300">{item.value}</span>
                    <Button variant="ghost" size="sm" onClick={() => { setEditId(item.id); setEditValue(item.value); }}>
                      <Edit2 size={12} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id, item.value)}
                      loading={loading === `delete-${item.id}`}
                      className="hover:text-rose-400 hover:bg-rose-500/10"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new */}
          <div className="flex gap-2">
            <Input
              value={newValue[category] || ""}
              onChange={e => setNewValue(p => ({ ...p, [category]: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleAdd(category)}
              placeholder={`Novo ${CATEGORY_LABELS[category]?.slice(0, -1).toLowerCase() || "valor"}...`}
              className="flex-1 h-8 text-xs"
            />
            <Button
              size="sm"
              onClick={() => handleAdd(category)}
              loading={loading === `add-${category}`}
              icon={<Plus size={13} />}
            >
              Adicionar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

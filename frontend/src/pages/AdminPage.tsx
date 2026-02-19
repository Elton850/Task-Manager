import React, { useState, useEffect, useCallback } from "react";
import { Settings, List, Shield } from "lucide-react";
import Card, { CardHeader } from "@/components/ui/Card";
import LookupManager from "@/components/admin/LookupManager";
import RulesManager from "@/components/admin/RulesManager";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { lookupsApi, rulesApi } from "@/services/api";
import type { Lookups, LookupItem, Rule } from "@/types";

type Tab = "lookups" | "rules";

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>(user?.role === "ADMIN" ? "lookups" : "rules");
  const [lookupItems, setLookupItems] = useState<LookupItem[]>([]);
  const [lookups, setLookups] = useState<Lookups>({});
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const promises: Promise<unknown>[] = [rulesApi.list()];
      if (user?.role === "ADMIN") {
        promises.unshift(lookupsApi.listAll(), lookupsApi.list());
      } else {
        promises.unshift(lookupsApi.list());
      }

      if (user?.role === "ADMIN") {
        const [itemsRes, lookupsRes, rulesRes] = await Promise.all([
          lookupsApi.listAll(),
          lookupsApi.list(),
          rulesApi.list(),
        ]);
        setLookupItems(itemsRes.lookups);
        setLookups(lookupsRes.lookups);
        setRules(rulesRes.rules);
      } else {
        const [lookupsRes, rulesRes] = await Promise.all([
          lookupsApi.list(),
          rulesApi.list(),
        ]);
        setLookups(lookupsRes.lookups);
        setRules(rulesRes.rules);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao carregar", "error");
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => { load(); }, [load]);

  const tabs = [
    ...(user?.role === "ADMIN" ? [{ id: "lookups" as Tab, label: "Listas de Valores", icon: <List size={15} /> }] : []),
    { id: "rules" as Tab, label: "Regras de Área", icon: <Shield size={15} /> },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><LoadingSpinner text="Carregando configurações..." /></div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-slate-500">
        {user?.role === "ADMIN"
          ? "Gerencie listas de valores e regras por área"
          : "Gerencie as regras de recorrência da sua área"
        }
      </p>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex gap-1 p-1 bg-slate-800/60 rounded-lg w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`
                flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all
                ${tab === t.id
                  ? "bg-slate-700 text-slate-100 shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
                }
              `}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {tab === "lookups" && user?.role === "ADMIN" && (
        <Card>
          <CardHeader
            title="Listas de Valores"
            subtitle="Gerencie as opções disponíveis nos formulários de tarefas"
          />
          <LookupManager items={lookupItems} onRefresh={load} />
        </Card>
      )}

      {tab === "rules" && (
        <Card>
          <CardHeader
            title="Regras por Área"
            subtitle={
              user?.role === "ADMIN"
                ? "Defina quais recorrências são permitidas por área"
                : `Defina as recorrências permitidas para a área: ${user?.area}`
            }
          />
          <RulesManager rules={rules} lookups={lookups} onRefresh={load} />
        </Card>
      )}
    </div>
  );
}

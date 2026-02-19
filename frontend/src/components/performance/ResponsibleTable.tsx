import React from "react";
import Badge, { getStatusVariant } from "@/components/ui/Badge";
import type { ResponsavelStats } from "@/types";

interface ResponsibleTableProps {
  data: ResponsavelStats[];
}

export default function ResponsibleTable({ data }: ResponsibleTableProps) {
  const sorted = [...data].sort((a, b) => b.total - a.total);

  if (!sorted.length) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        Nenhum dado disponível
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-700/60">
        <thead>
          <tr>
            {["Responsável", "Total", "Em Andamento", "Concluído", "Em Atraso", "Concl. Atraso", "Taxa Conclusão"].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/40">
          {sorted.map(row => {
            const totalFinished = row.concluido + row.concluidoEmAtraso;
            const rate = row.total > 0 ? Math.round((totalFinished / row.total) * 100) : 0;

            return (
              <tr key={row.email} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-3 py-2.5">
                  <div className="text-sm font-medium text-slate-200">{row.nome}</div>
                  <div className="text-xs text-slate-500">{row.email}</div>
                </td>
                <td className="px-3 py-2.5 text-sm font-semibold text-slate-200">{row.total}</td>
                <td className="px-3 py-2.5">
                  <Badge variant="blue" size="sm">{row.emAndamento}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant="green" size="sm">{row.concluido}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  {row.emAtraso > 0
                    ? <Badge variant="red" size="sm">{row.emAtraso}</Badge>
                    : <span className="text-slate-600 text-xs">—</span>
                  }
                </td>
                <td className="px-3 py-2.5">
                  {row.concluidoEmAtraso > 0
                    ? <Badge variant="amber" size="sm">{row.concluidoEmAtraso}</Badge>
                    : <span className="text-slate-600 text-xs">—</span>
                  }
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden min-w-[60px]">
                      <div
                        className={`h-full rounded-full ${rate >= 80 ? "bg-emerald-400" : rate >= 50 ? "bg-amber-400" : "bg-rose-400"}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium tabular-nums ${rate >= 80 ? "text-emerald-400" : rate >= 50 ? "text-amber-400" : "text-rose-400"}`}>
                      {rate}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

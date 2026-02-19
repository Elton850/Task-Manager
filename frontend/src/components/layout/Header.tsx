import React from "react";
import { useLocation } from "react-router-dom";
import { Menu, Bell } from "lucide-react";

interface HeaderProps {
  onMenuToggle: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  "/tasks": "Tarefas",
  "/calendar": "Calendário",
  "/performance": "Performance",
  "/users": "Usuários",
  "/admin": "Configurações",
};

export default function Header({ onMenuToggle }: HeaderProps) {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || "Task Manager";

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between px-4 lg:px-6 py-3 bg-slate-950/95 backdrop-blur border-b border-slate-700/60">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800 lg:hidden"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-slate-100">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="text-xs text-slate-500 hidden sm:block">
          {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
        </div>
      </div>
    </header>
  );
}

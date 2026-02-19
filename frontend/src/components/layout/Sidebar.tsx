import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Calendar, BarChart2, Users, Settings,
  LogOut, CheckSquare, ChevronLeft, Menu
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Badge, { getRoleVariant } from "@/components/ui/Badge";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { to: "/tasks",       icon: <LayoutDashboard size={18} />, label: "Tarefas" },
  { to: "/calendar",    icon: <Calendar size={18} />,        label: "Calendário" },
  { to: "/performance", icon: <BarChart2 size={18} />,       label: "Performance" },
  { to: "/users",       icon: <Users size={18} />,           label: "Usuários",  roles: ["ADMIN"] },
  { to: "/admin",       icon: <Settings size={18} />,        label: "Configurações", roles: ["ADMIN", "LEADER"] },
];

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const { user, tenant, logout } = useAuth();

  const visibleItems = navItems.filter(item => !item.roles || item.roles.includes(user?.role || ""));

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full z-30 flex flex-col
        bg-slate-900 border-r border-slate-700/60
        transition-all duration-300 ease-in-out
        ${open ? "w-64" : "w-0 lg:w-64"}
        overflow-hidden
      `}>
        {/* Logo / Company */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
              <CheckSquare size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100 truncate">
                {tenant?.name || "Task Manager"}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {tenant?.slug ? `@${tenant.slug}` : "v2.0"}
              </div>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="text-slate-500 hover:text-slate-300 transition-colors lg:hidden ml-2"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? "bg-brand-600/15 text-brand-300 border border-brand-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent"
                }
              `}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Info */}
        {user && (
          <div className="px-3 pb-4 flex-shrink-0 border-t border-slate-700/60 pt-3">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50 mb-2">
              <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-brand-300">
                  {user.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-200 truncate">{user.nome}</p>
                <p className="text-xs text-slate-500 truncate">{user.area}</p>
              </div>
              <Badge variant={getRoleVariant(user.role)} size="sm">
                {user.role}
              </Badge>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            >
              <LogOut size={15} />
              Sair
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

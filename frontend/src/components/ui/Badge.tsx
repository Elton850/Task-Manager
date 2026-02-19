import React from "react";

type BadgeVariant = "blue" | "green" | "red" | "amber" | "slate" | "indigo" | "purple";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  blue:   "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  green:  "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  red:    "bg-rose-500/15 text-rose-300 border border-rose-500/30",
  amber:  "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  slate:  "bg-slate-500/15 text-slate-300 border border-slate-500/30",
  indigo: "bg-brand-500/15 text-brand-300 border border-brand-500/30",
  purple: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
};

export function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "Em Andamento": return "blue";
    case "Concluído": return "green";
    case "Em Atraso": return "red";
    case "Concluído em Atraso": return "amber";
    default: return "slate";
  }
}

export function getRoleVariant(role: string): BadgeVariant {
  switch (role) {
    case "ADMIN": return "purple";
    case "LEADER": return "indigo";
    default: return "slate";
  }
}

export default function Badge({ children, variant = "slate", size = "sm", className = "" }: BadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

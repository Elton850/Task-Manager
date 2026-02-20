import React, { useState } from "react";
import defaultLogo from "@/assets/logo.jpeg";

interface TenantLogoProps {
  /** Slug da empresa (ex.: "acme"). Quando vazio ou "system", usa logo padrão. */
  tenantSlug: string | null | undefined;
  alt?: string;
  className?: string;
  /** Tamanho do container (ex.: "h-8 w-8", "h-16 w-16"). */
  size?: string;
}

/**
 * Exibe a logo da empresa quando existir (GET /api/tenants/logo/:slug).
 * Se não houver logo ou der erro, usa a logo padrão do sistema.
 */
export default function TenantLogo({ tenantSlug, alt = "Logo", className = "", size = "h-10 w-10" }: TenantLogoProps) {
  const [useFallback, setUseFallback] = useState(false);
  const logoUrl = tenantSlug && tenantSlug !== "system" && !useFallback
    ? `/api/tenants/logo/${tenantSlug}`
    : null;

  return (
    <div className={`${size} rounded-lg border border-slate-200 overflow-hidden bg-white flex items-center justify-center flex-shrink-0 p-0.5 ${className}`}>
      <img
        src={logoUrl || defaultLogo}
        alt={alt}
        className="w-full h-full object-contain"
        onError={() => setUseFallback(true)}
      />
    </div>
  );
}

import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export default function Textarea({ label, error, hint, className = "", id, ...props }: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
          {label}
          {props.required && <span className="text-rose-400 ml-1">*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        {...props}
        className={`
          w-full rounded-lg bg-slate-800 border text-slate-100 placeholder-slate-500
          px-3 py-2 text-sm resize-vertical min-h-[80px]
          focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
          ${error ? "border-rose-500 focus:ring-rose-500" : "border-slate-700 hover:border-slate-600"}
          ${className}
        `}
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export default function Select({
  label, error, hint, options, placeholder, className = "", id, ...props
}: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-slate-300">
          {label}
          {props.required && <span className="text-rose-400 ml-1">*</span>}
        </label>
      )}
      <select
        id={selectId}
        {...props}
        className={`
          w-full rounded-lg bg-slate-800 border text-slate-100
          px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors appearance-none
          ${error ? "border-rose-500 focus:ring-rose-500" : "border-slate-700 hover:border-slate-600"}
          ${className}
        `}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

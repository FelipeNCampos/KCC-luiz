import { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  helperText?: string;
};

export function TextField({ label, error, helperText, id, ...props }: TextFieldProps) {
  const inputId = id ?? props.name;
  const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;

  return (
    <label className="grid gap-2" htmlFor={inputId}>
      <span className="oak-label">{label}</span>
      <input
        className="oak-input"
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...props}
      />
      {helperText && !error ? (
        <small id={`${inputId}-helper`} className="text-xs font-semibold text-black/60">
          {helperText}
        </small>
      ) : null}
      {error ? (
        <small id={`${inputId}-error`} className="text-xs font-bold text-oak-danger">
          {error}
        </small>
      ) : null}
    </label>
  );
}

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-400 dark:disabled:bg-slate-700",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:text-slate-400 " +
    "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
  ghost:
    "text-slate-600 hover:bg-slate-100 disabled:text-slate-400 dark:text-slate-300 dark:hover:bg-slate-800",
};

// Herda TODAS as props de um <button> nativo (onClick, disabled, type, aria-*...)
// e acrescenta só `variant`. O `...props` repassa o resto para o elemento real.
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      // type="button" por padrão: dentro de um <form>, o padrão do HTML seria "submit"
      // e qualquer botão (ex.: "remover opção") enviaria o formulário sem querer.
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

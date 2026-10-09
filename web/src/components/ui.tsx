"use client";

import {
  FormEvent,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  InputHTMLAttributes,
  ButtonHTMLAttributes,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

export function buttonClass(variant: "primary" | "secondary" | "ghost" | "danger" = "primary") {
  const styles = {
    primary:
      "bg-amber text-charcoal hover:bg-amber-hover focus-visible:outline-amber disabled:opacity-50",
    secondary:
      "bg-white text-charcoal border border-line hover:bg-canvas focus-visible:outline-charcoal",
    ghost: "bg-transparent text-charcoal hover:bg-white/10 focus-visible:outline-amber",
    danger: "bg-danger text-white hover:bg-red-800 focus-visible:outline-danger",
  }[variant];
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${styles}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return <button {...props} className={`${buttonClass(variant)} ${className}`} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="label-text text-charcoal">{label}</span>
      {children}
      {hint ? <span className="block meta-text">{hint}</span> : null}
    </label>
  );
}

const control =
  "w-full min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm text-charcoal placeholder:text-muted focus:border-charcoal focus:outline-none focus:ring-2 focus:ring-amber/60";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${control} min-h-24 ${props.className ?? ""}`} />;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-line bg-white shadow-[var(--shadow-card)] ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb ? <div className="meta-text mb-1">{breadcrumb}</div> : null}
        <h1 className="page-title text-charcoal">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl body-text text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-5 py-10 text-center sm:px-6 sm:py-12">
      <h2 className="card-title text-charcoal">{title}</h2>
      <p className="mt-1 body-text text-muted">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 body-text text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-charcoal" />
      {label}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 meta-text">
      <span>
        {total} result{total === 1 ? "" : "s"} · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  onSubmit,
  submitLabel = "Save",
  busy = false,
  nested = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit?: (event: FormEvent) => void;
  submitLabel?: string;
  busy?: boolean;
  nested?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex items-end justify-center bg-charcoal/45 p-0 sm:items-center sm:p-4 ${nested ? "z-[70]" : "z-50"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onClick={onClose}
    >
      <form
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-[var(--shadow-pop)] sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (busy) return;
          onSubmit?.(event);
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id="dialog-title" className="section-title text-charcoal">
            {title}
          </h2>
          <button type="button" className="flex min-h-11 min-w-11 items-center justify-center text-muted hover:text-charcoal" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-line bg-white px-5 py-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {onSubmit ? (
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : submitLabel}
            </Button>
          ) : null}
        </div>
      </form>
    </div>,
    document.body,
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
      {message}
    </div>
  );
}

export function ResponsiveRecords({
  cards,
  table,
}: {
  cards: ReactNode;
  table: ReactNode;
}) {
  return (
    <>
      <div className="space-y-2 md:hidden">{cards}</div>
      <div className="hidden overflow-x-auto md:block">{table}</div>
    </>
  );
}

export function FilterPanel({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="mb-4 p-4">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between text-sm font-medium text-charcoal md:hidden"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        Filters
        <span className="meta-text">{open ? "Hide" : "Show"}</span>
      </button>
      <div className={`${open ? "mt-3 block" : "hidden"} md:block`}>{children}</div>
    </Card>
  );
}

export function RecordCard({
  href,
  title,
  subtitle,
  meta,
  extra,
}: {
  href: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-line bg-white p-3.5 shadow-[var(--shadow-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-charcoal">{title}</p>
          {subtitle ? <p className="mt-0.5 truncate body-text text-muted">{subtitle}</p> : null}
        </div>
        {extra}
      </div>
      {meta ? <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 meta-text">{meta}</div> : null}
    </Link>
  );
}

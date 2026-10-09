import type { LeadStatus, PaymentStatus } from "@/types/api";
import { LEAD_LABELS } from "@/lib/lifecycle";
import { paymentStatusLabel } from "@/lib/money";

const leadStyles: Record<LeadStatus, string> = {
  NEW_INQUIRY: "bg-sky-50 text-sky-900 ring-sky-200",
  QUOTATION_PREPARED: "bg-violet-50 text-violet-900 ring-violet-200",
  AWAITING_CONFIRMATION: "bg-amber-50 text-amber-950 ring-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  LOST: "bg-slate-100 text-slate-800 ring-slate-300",
  CANCELLED: "bg-rose-50 text-rose-900 ring-rose-200",
};

const payStyles: Record<PaymentStatus, string> = {
  UNPAID: "bg-rose-50 text-rose-900 ring-rose-200",
  PARTIALLY_PAID: "bg-amber-50 text-amber-950 ring-amber-200",
  PAID: "bg-emerald-50 text-emerald-900 ring-emerald-200",
};

const badge = "inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5 ring-1 ring-inset";

export function LeadBadge({ status }: { status: LeadStatus | string }) {
  const key = status as LeadStatus;
  return (
    <span className={`${badge} ${leadStyles[key] ?? "bg-slate-100 text-slate-800 ring-slate-300"}`}>
      {LEAD_LABELS[key] ?? status}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus | string }) {
  const key = status as PaymentStatus;
  return (
    <span className={`${badge} ${payStyles[key] ?? "bg-slate-100 text-slate-800 ring-slate-300"}`}>
      {paymentStatusLabel(status)}
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`${badge} ${
        active ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-300"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

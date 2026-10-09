import type { LeadStatus, PaymentStatus } from "@/types/api";
import { LEAD_LABELS } from "@/lib/lifecycle";
import { paymentStatusLabel } from "@/lib/money";

const leadStyles: Record<LeadStatus, string> = {
  NEW_INQUIRY: "bg-sky-50 text-sky-800",
  QUOTATION_PREPARED: "bg-violet-50 text-violet-800",
  AWAITING_CONFIRMATION: "bg-amber-50 text-amber-900",
  CONFIRMED: "bg-emerald-50 text-emerald-800",
  LOST: "bg-slate-100 text-slate-700",
  CANCELLED: "bg-rose-50 text-rose-800",
};

const payStyles: Record<PaymentStatus, string> = {
  UNPAID: "bg-rose-50 text-rose-800",
  PARTIALLY_PAID: "bg-amber-50 text-amber-900",
  PAID: "bg-emerald-50 text-emerald-800",
};

export function LeadBadge({ status }: { status: LeadStatus | string }) {
  const key = status as LeadStatus;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${leadStyles[key] ?? "bg-slate-100 text-slate-700"}`}>
      {LEAD_LABELS[key] ?? status}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus | string }) {
  const key = status as PaymentStatus;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${payStyles[key] ?? "bg-slate-100 text-slate-700"}`}>
      {paymentStatusLabel(status)}
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

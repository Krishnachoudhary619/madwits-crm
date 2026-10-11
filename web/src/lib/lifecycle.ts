import type { LeadStatus } from "@/types/api";

export const LEAD_LABELS: Record<LeadStatus, string> = {
  NEW_INQUIRY: "New enquiry",
  QUOTATION_PREPARED: "Quotation prepared",
  AWAITING_CONFIRMATION: "Waiting for customer",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  LOST: "Lost",
  CANCELLED: "Cancelled",
};

export const OPEN_ENQUIRY_STATUSES: LeadStatus[] = [
  "NEW_INQUIRY",
  "QUOTATION_PREPARED",
  "AWAITING_CONFIRMATION",
];

export function canQuote(status: LeadStatus): boolean {
  return (
    status === "NEW_INQUIRY" ||
    status === "QUOTATION_PREPARED" ||
    status === "AWAITING_CONFIRMATION"
  );
}

export function canConfirm(status: LeadStatus): boolean {
  return status === "QUOTATION_PREPARED" || status === "AWAITING_CONFIRMATION";
}

export function canMarkLost(status: LeadStatus): boolean {
  return (
    status === "NEW_INQUIRY" ||
    status === "QUOTATION_PREPARED" ||
    status === "AWAITING_CONFIRMATION"
  );
}

export function canCancel(status: LeadStatus): boolean {
  return (
    status === "NEW_INQUIRY" ||
    status === "QUOTATION_PREPARED" ||
    status === "AWAITING_CONFIRMATION" ||
    status === "CONFIRMED" ||
    status === "COMPLETED"
  );
}

export function canChangeStage(status: LeadStatus): boolean {
  return status === "CONFIRMED" || status === "COMPLETED";
}

export function canRecordPayment(status: LeadStatus): boolean {
  return status === "CONFIRMED" || status === "COMPLETED";
}

export function canSendBill(status: LeadStatus): boolean {
  return status === "COMPLETED";
}

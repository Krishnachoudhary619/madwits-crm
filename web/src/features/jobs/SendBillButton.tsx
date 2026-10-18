"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { formatInr } from "@/lib/money";
import { buildBillPdf, whatsappShareUrl, type BillDetails } from "@/lib/billPdf";
import type { Customer, Job, JobBalance, PrintCategory } from "@/types/api";

function detailsFor(
  job: Job,
  customer: Customer | null,
  category: PrintCategory | null,
  balance: JobBalance | null,
): BillDetails {
  return {
    shopName: "MadWits",
    jobNumber: job.job_number,
    title: job.title?.trim() || "",
    stationeryName: category?.name || "Stationery",
    customerName: customer?.name || "Customer",
    customerPhone: customer?.phone || "",
    quantity: job.quantity,
    amount: formatInr(balance?.amount_due ?? job.final_amount ?? job.quoted_amount),
    paid: formatInr(balance?.total_paid ?? "0.00"),
    balance: formatInr(balance?.balance ?? job.final_amount ?? job.quoted_amount),
    issuedOn: formatDate(new Date().toISOString()),
  };
}

function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function deliverBill(
  job: Job,
  customer: Customer | null,
  category: PrintCategory | null,
  balance: JobBalance | null,
) {
  const details = detailsFor(job, customer, category, balance);
  const bytes = buildBillPdf(details);
  downloadPdf(bytes, `${job.job_number}-bill.pdf`);
  const opened = window.open(whatsappShareUrl(details), "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.assign(whatsappShareUrl(details));
  }
}

export function SendBillButton({
  job,
  customer,
  category,
  balance,
}: {
  job: Job;
  customer: Customer | null;
  category: PrintCategory | null;
  balance: JobBalance | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendBill() {
    setBusy(true);
    setError("");
    try {
      await deliverBill(job, customer, category, balance);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" disabled={busy} onClick={() => void sendBill()}>
        {busy ? "Preparing bill…" : "Send bill on WhatsApp"}
      </Button>
      {error ? <p className="mt-1 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

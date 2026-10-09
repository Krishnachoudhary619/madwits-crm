"use client";

import { useState } from "react";
import { jobsApi } from "@/lib/api/endpoints";
import { shopDateTime } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { formatInr } from "@/lib/money";
import { canCancel, canChangeStage, canConfirm, canMarkLost, canQuote } from "@/lib/lifecycle";
import { allowedStageTargets } from "@/lib/jobs";
import type { Job, WorkflowStage } from "@/types/api";
import { AttributionSelect } from "@/features/jobs/AttributionSelect";
import { Button, ErrorBanner, Field, Input, Modal, Select, Textarea } from "@/components/ui";

export function JobActions({
  job,
  stages,
  onUpdated,
}: {
  job: Job;
  stages: WorkflowStage[];
  onUpdated: (job: Job, conflict?: boolean) => void;
}) {
  const [modal, setModal] = useState<"quote" | "confirm" | "lost" | "cancel" | "stage" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attribution, setAttribution] = useState("");
  const [quoted, setQuoted] = useState(job.quoted_amount ?? "");
  const [finalAmount, setFinalAmount] = useState(job.final_amount ?? "");
  const [advance, setAdvance] = useState(job.advance_amount ?? "0");
  const [awaiting, setAwaiting] = useState(true);
  const [notes, setNotes] = useState("");
  const [toStage, setToStage] = useState("");

  const targets = allowedStageTargets(stages, job.current_stage_id);

  function open(kind: typeof modal) {
    setError("");
    setNotes("");
    setQuoted(job.quoted_amount ?? "");
    setFinalAmount(job.final_amount ?? "");
    setAdvance(job.advance_amount ?? "0");
    setToStage(targets[0]?.id ?? "");
    setModal(kind);
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      let updated: Job = job;
      if (modal === "quote") {
        updated = await jobsApi.quotation(job.id, {
          quoted_amount: quoted,
          final_amount: finalAmount || null,
          advance_amount: advance || null,
          awaiting_confirmation: awaiting,
          notes: notes || null,
        });
      } else if (modal === "confirm") {
        updated = await jobsApi.confirm(job.id, {
          updated_by_user_id: attribution,
          notes: notes || null,
          final_amount: finalAmount || null,
        });
      } else if (modal === "lost") {
        updated = await jobsApi.markLost(job.id, { notes: notes || null });
      } else if (modal === "cancel") {
        updated = await jobsApi.cancel(job.id, { notes: notes || null });
      } else if (modal === "stage") {
        updated = await jobsApi.stage(job.id, {
          to_stage_id: toStage,
          updated_by_user_id: attribution,
          expected_current_stage_id: job.current_stage_id,
          notes: notes || null,
        });
      }
      setModal(null);
      onUpdated(updated);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      if (message.toLowerCase().includes("changed") || message.toLowerCase().includes("expected")) {
        onUpdated(job, true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canQuote(job.lead_status) ? (
          <Button onClick={() => open("quote")}>Prepare quotation</Button>
        ) : null}
        {canConfirm(job.lead_status) ? (
          <Button variant="secondary" onClick={() => open("confirm")}>
            Confirm job
          </Button>
        ) : null}
        {canChangeStage(job.lead_status) ? (
          <Button variant="secondary" onClick={() => open("stage")}>
            Change stage
          </Button>
        ) : null}
        {canMarkLost(job.lead_status) ? (
          <Button variant="secondary" onClick={() => open("lost")}>
            Mark lost
          </Button>
        ) : null}
        {canCancel(job.lead_status) ? (
          <Button variant="danger" onClick={() => open("cancel")}>
            Cancel job
          </Button>
        ) : null}
      </div>
      {modal ? (
        <Modal
          title={
            modal === "quote"
              ? "Quotation"
              : modal === "confirm"
                ? "Confirm existing job"
                : modal === "stage"
                  ? "Change production stage"
                  : modal === "lost"
                    ? "Mark lost"
                    : "Cancel job"
          }
          onClose={() => setModal(null)}
          onSubmit={submit}
          busy={busy}
          submitLabel="Save"
        >
          {error ? <ErrorBanner message={error} /> : null}
          {modal === "quote" ? (
            <>
              <Field label="Quoted amount (₹)">
                <Input required value={quoted} onChange={(event) => setQuoted(event.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Final amount (optional)">
                <Input value={finalAmount} onChange={(event) => setFinalAmount(event.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Advance amount">
                <Input value={advance} onChange={(event) => setAdvance(event.target.value)} inputMode="decimal" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={awaiting} onChange={(event) => setAwaiting(event.target.checked)} />
                Move to awaiting confirmation
              </label>
            </>
          ) : null}
          {modal === "confirm" ? (
            <>
              <p className="text-sm text-muted">
                Confirmation updates this job. A new job is not created. Quoted amount is copied to
                final amount unless you override it.
              </p>
              <Field label="Final amount override (optional)">
                <Input value={finalAmount} onChange={(event) => setFinalAmount(event.target.value)} inputMode="decimal" />
              </Field>
              <AttributionSelect value={attribution} onChange={setAttribution} />
            </>
          ) : null}
          {modal === "stage" ? (
            <>
              <Field label="Move to stage">
                <Select required value={toStage} onChange={(event) => setToStage(event.target.value)}>
                  <option value="">Select stage</option>
                  {targets.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                      {stage.is_final ? " (final)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              {targets.length === 0 ? (
                <p className="text-sm text-muted">No further stage moves are available from the current workflow.</p>
              ) : null}
              <AttributionSelect value={attribution} onChange={setAttribution} />
            </>
          ) : null}
          <Field label="Notes">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </Modal>
      ) : null}
    </>
  );
}

export function PaymentModal({
  jobId,
  amountDue,
  totalPaid,
  balance,
  onClose,
  onSaved,
}: {
  jobId: string;
  amountDue: string;
  totalPaid: string;
  balance: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState("CASH");
  const [date, setDate] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || amount === "0" || amount === "0.00") {
      setError("Enter a positive amount with up to two decimal places.");
      setBusy(false);
      return;
    }
    try {
      await jobsApi.addPayment(jobId, {
        amount,
        payment_method: method,
        paid_at: shopDateTime(date, "12:00"),
        reference_number: reference.trim() || null,
        notes: notes.trim() || null,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Record payment" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Record payment">
      {error ? <ErrorBanner message={error} /> : null}
      <p className="text-sm text-muted">
        Due {formatInr(amountDue)} · Paid {formatInr(totalPaid)} · Outstanding {formatInr(balance)}.
        Overpayments are rejected by the server.
      </p>
      <Field label="Amount (₹)">
        <Input required value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
      </Field>
      <Field label="Method">
        <Select value={method} onChange={(event) => setMethod(event.target.value)}>
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
          <option value="BANK_TRANSFER">Bank transfer</option>
        </Select>
      </Field>
      <Field label="Payment date">
        <Input type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
      </Field>
      <Field label="Reference number">
        <Input value={reference} onChange={(event) => setReference(event.target.value)} />
      </Field>
      <Field label="Notes">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
    </Modal>
  );
}

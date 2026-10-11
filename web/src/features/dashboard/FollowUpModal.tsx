"use client";

import { useState } from "react";
import { jobsApi } from "@/lib/api/endpoints";
import { shopDateTime, toDateInput, todayIsoDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { ErrorBanner, Field, Input, Modal } from "@/components/ui";
import type { Job } from "@/types/api";

export function FollowUpModal({
  job,
  onClose,
  onSaved,
}: {
  job: Job;
  onClose: () => void;
  onSaved: (job: Job) => void;
}) {
  const [date, setDate] = useState(toDateInput(job.next_follow_up_at) || todayIsoDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await jobsApi.update(job.id, {
        next_follow_up_at: shopDateTime(date, "09:00"),
      });
      onSaved(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Record follow-up" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Save follow-up">
      {error ? <ErrorBanner message={error} /> : null}
      <p className="body-text text-muted">
        Updates the stored follow-up date on {job.job_number}. This does not send a message or confirm the order.
      </p>
      <Field label="Next follow-up date">
        <Input type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
      </Field>
    </Modal>
  );
}

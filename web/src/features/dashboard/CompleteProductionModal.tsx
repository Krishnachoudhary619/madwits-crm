"use client";

import { useState } from "react";
import { jobsApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/errors";
import { AttributionSelect } from "@/features/jobs/AttributionSelect";
import { ErrorBanner, Field, Modal, Textarea } from "@/components/ui";
import type { Job, WorkflowStage } from "@/types/api";

export function CompleteProductionModal({
  job,
  finalStage,
  onClose,
  onSaved,
}: {
  job: Job;
  finalStage: WorkflowStage;
  onClose: () => void;
  onSaved: (job: Job) => void;
}) {
  const [attribution, setAttribution] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await jobsApi.stage(job.id, {
        to_stage_id: finalStage.id,
        updated_by_user_id: attribution,
        expected_current_stage_id: job.current_stage_id,
        notes: notes.trim() || null,
      });
      onSaved(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Mark production complete" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Mark complete">
      {error ? <ErrorBanner message={error} /> : null}
      <p className="body-text text-muted">
        This moves {job.job_number} to the final stage <strong>{finalStage.name}</strong> and sets the order status
        to Completed. You can send the bill from the job page afterwards. It does not record payment.
      </p>
      <AttributionSelect value={attribution} onChange={setAttribution} />
      <Field label="Notes">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
    </Modal>
  );
}

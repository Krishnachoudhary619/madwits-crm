"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { jobsApi } from "@/lib/api/endpoints";
import { formatDate, todayIsoDate, toDateInput } from "@/lib/dates";
import { ApiError, errorMessage } from "@/lib/errors";
import { adjacentStage, listAllJobs } from "@/lib/jobs";
import { formatInr } from "@/lib/money";
import type { Job, PrintCategory, WorkflowStage } from "@/types/api";
import { Button, Card, EmptyState, ErrorBanner, Field, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { AttributionSelect } from "@/features/jobs/AttributionSelect";
import { useCatalogs, nameById } from "@/hooks/useCatalogs";
import { useToast } from "@/components/Toast";

function dueLabel(due: string | null): { text: string; urgent: boolean } {
  if (!due) return { text: "No due date", urgent: false };
  const day = toDateInput(due);
  const today = todayIsoDate();
  if (day < today) return { text: `Late · was due ${formatDate(due)}`, urgent: true };
  if (day === today) return { text: "Due today", urgent: true };
  return { text: `Due ${formatDate(due)}`, urgent: false };
}

function JobRow({
  job,
  customerName,
  moveLabel,
  onMove,
}: {
  job: Job;
  customerName: string;
  moveLabel: string | null;
  onMove: (job: Job) => void;
}) {
  const due = dueLabel(job.due_date);
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href={`/jobs/${job.id}`} className="font-medium text-charcoal hover:underline">
          {customerName}
        </Link>
        <p className="meta-text">
          {job.title ? `${job.title} · ` : ""}
          {job.job_number}
          {job.quantity > 1 ? ` · Qty ${job.quantity}` : ""}
        </p>
        <p className={`mt-0.5 text-sm ${due.urgent ? "font-medium text-danger" : "text-muted"}`}>{due.text}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <span className="money text-sm font-medium">{formatInr(job.final_amount ?? job.quoted_amount)}</span>
        {moveLabel ? (
          <Button variant="secondary" onClick={() => onMove(job)}>
            {moveLabel}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export default function ProductionPage() {
  const toast = useToast();
  const { customers, categories, stagesByCategory, reload } = useCatalogs();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState<Job | null>(null);
  const [toStage, setToStage] = useState("");
  const [attribution, setAttribution] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await listAllJobs({
        lead_status: ["CONFIRMED"],
        category_id: categoryId || undefined,
        sort: "due_date",
        order: "asc",
      });
      setJobs(items);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const groups = useMemo(() => {
    const chosen = categories.filter((category) => !categoryId || category.id === categoryId);
    return chosen
      .map((category) => {
        const stages = (stagesByCategory[category.id] ?? [])
          .filter((stage) => stage.is_active)
          .sort((a, b) => a.sequence - b.sequence);
        const categoryJobs = jobs.filter((job) => job.category_id === category.id);
        return { category, stages, jobs: categoryJobs };
      })
      .filter((group) => (categoryId ? group.stages.length > 0 || group.jobs.length > 0 : group.jobs.length > 0));
  }, [categories, categoryId, jobs, stagesByCategory]);

  function stageName(list: WorkflowStage[], id: string | null) {
    return nameById(
      list.map((stage) => ({ id: stage.id, name: stage.name })),
      id,
    );
  }

  function moveLabelFor(job: Job) {
    const list = stagesByCategory[job.category_id] ?? [];
    const next = adjacentStage(list, job.current_stage_id, 1);
    if (next) return `Send to ${next.name}`;
    const previous = adjacentStage(list, job.current_stage_id, -1);
    return previous ? `Send back to ${previous.name}` : null;
  }

  function beginMove(job: Job) {
    const list = stagesByCategory[job.category_id] ?? [];
    const target = adjacentStage(list, job.current_stage_id, 1) ?? adjacentStage(list, job.current_stage_id, -1);
    if (!target) return;
    setMoving(job);
    setToStage(target.id);
    setNotes("");
    setError("");
  }

  async function submitMove() {
    if (!moving || busy) return;
    setBusy(true);
    setError("");
    try {
      await jobsApi.stage(moving.id, {
        to_stage_id: toStage,
        updated_by_user_id: attribution,
        expected_current_stage_id: moving.current_stage_id,
        notes: notes || null,
      });
      toast("Job moved");
      setMoving(null);
      setNotes("");
      await loadJobs();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(`${errorMessage(err)} Refresh the list and try again.`);
        await loadJobs();
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const movingStages = moving ? (stagesByCategory[moving.category_id] ?? []) : [];
  const movingNext = moving ? adjacentStage(movingStages, moving.current_stage_id, 1) : null;
  const movingPrevious = moving ? adjacentStage(movingStages, moving.current_stage_id, -1) : null;
  const movingAlternate =
    movingNext && movingPrevious && movingNext.id !== movingPrevious.id
      ? toStage === movingPrevious.id
        ? movingNext
        : movingPrevious
      : null;

  return (
    <div>
      <PageHeader
        title="Work in progress"
        description="Confirmed jobs the shop is making. Read down the page: each print type, then its steps in order. When a step is finished, send the job to the next step."
        actions={
          <Button variant="secondary" onClick={() => void Promise.all([reload(), loadJobs()])}>
            Refresh
          </Button>
        }
      />
      <div className="mb-4 max-w-sm">
        <Field label="Print type">
          <Select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            aria-label="Print type"
          >
            <option value="">All print types with jobs</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error && !moving ? <ErrorBanner message={error} /> : null}
      {loading ? (
        <Spinner />
      ) : jobs.length === 0 ? (
        <EmptyState
          title="Nothing is being made"
          description="Confirmed jobs appear here, listed under the step they are on."
        />
      ) : (
        <div className="space-y-4">
          <p className="body-text text-muted">
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"} in the shop
            {groups.length > 1 ? ` · ${groups.length} print types` : ""}. Late jobs are marked in red.
          </p>
          {groups.map((group) => (
            <CategorySection
              key={group.category.id}
              category={group.category}
              stages={group.stages}
              jobs={group.jobs}
              customerName={(id) => nameById(customers, id)}
              moveLabelFor={moveLabelFor}
              onMove={beginMove}
            />
          ))}
          <OrphanJobs
            jobs={jobs.filter((job) => !groups.some((group) => group.category.id === job.category_id))}
            customerName={(id) => nameById(customers, id)}
            moveLabelFor={moveLabelFor}
            onMove={beginMove}
          />
        </div>
      )}
      {moving ? (
        <Modal
          title={`Move ${nameById(customers, moving.customer_id)}`}
          onClose={() => setMoving(null)}
          onSubmit={submitMove}
          busy={busy}
          submitLabel="Move this job"
        >
          {error ? <ErrorBanner message={error} /> : null}
          <p className="body-text text-muted">
            {stageName(movingStages, moving.current_stage_id)} moves to{" "}
            <span className="font-medium text-charcoal">{stageName(movingStages, toStage)}</span>.
          </p>
          {movingAlternate ? (
            <button type="button" className="text-sm text-charcoal underline" onClick={() => setToStage(movingAlternate.id)}>
              {movingAlternate.id === movingPrevious?.id
                ? `Send back to ${movingPrevious.name} instead`
                : `Send on to ${movingNext?.name} instead`}
            </button>
          ) : null}
          <AttributionSelect value={attribution} onChange={setAttribution} />
          <Field label="Notes">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

function OrphanJobs({
  jobs,
  customerName,
  moveLabelFor,
  onMove,
}: {
  jobs: Job[];
  customerName: (id: string) => string;
  moveLabelFor: (job: Job) => string | null;
  onMove: (job: Job) => void;
}) {
  if (jobs.length === 0) return null;
  return (
    <Card className="px-4 py-3">
      <h2 className="section-title text-charcoal">Other jobs</h2>
      <p className="meta-text">These jobs are confirmed, but their print type is no longer on the list.</p>
      <ul className="divide-y divide-line">
        {jobs.map((job) => (
          <JobRow
            key={job.id}
            job={job}
            customerName={customerName(job.customer_id)}
            moveLabel={moveLabelFor(job)}
            onMove={onMove}
          />
        ))}
      </ul>
    </Card>
  );
}

function CategorySection({
  category,
  stages,
  jobs,
  customerName,
  moveLabelFor,
  onMove,
}: {
  category: PrintCategory;
  stages: WorkflowStage[];
  jobs: Job[];
  customerName: (id: string) => string;
  moveLabelFor: (job: Job) => string | null;
  onMove: (job: Job) => void;
}) {
  const waiting = jobs.filter((job) => !job.current_stage_id);
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <h2 className="section-title text-charcoal">{category.name}</h2>
        <p className="meta-text">
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"} · {stages.length}{" "}
          {stages.length === 1 ? "step" : "steps"}
        </p>
      </div>
      {waiting.length > 0 ? (
        <div className="border-b border-line px-4 py-3">
          <h3 className="card-title text-charcoal">Not on a step yet</h3>
          <ul className="divide-y divide-line">
            {waiting.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                customerName={customerName(job.customer_id)}
                moveLabel={moveLabelFor(job)}
                onMove={onMove}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {stages.length === 0 ? (
        <div className="px-4 py-3">
          <p className="body-text text-muted">This print type has no steps yet.</p>
          <ul className="divide-y divide-line">
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                customerName={customerName(job.customer_id)}
                moveLabel={moveLabelFor(job)}
                onMove={onMove}
              />
            ))}
          </ul>
        </div>
      ) : (
        <ol>
          {stages.map((stage, index) => {
            const stageJobs = jobs.filter((job) => job.current_stage_id === stage.id);
            const count = stageJobs.length;
            return (
              <li key={stage.id} className="border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className={`card-title ${count > 0 ? "text-charcoal" : "text-muted"}`}>
                    Step {index + 1}. {stage.name}
                    {stage.is_final ? <span className="ml-2 font-normal text-muted">Last step</span> : null}
                  </h3>
                  <span className={`shrink-0 text-sm ${count > 0 ? "font-medium text-charcoal" : "text-muted"}`}>
                    {count === 0 ? "Nothing here" : count === 1 ? "1 job" : `${count} jobs`}
                  </span>
                </div>
                {count > 0 ? (
                  <ul className="divide-y divide-line">
                    {stageJobs.map((job) => (
                      <JobRow
                        key={job.id}
                        job={job}
                        customerName={customerName(job.customer_id)}
                        moveLabel={moveLabelFor(job)}
                        onMove={onMove}
                      />
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

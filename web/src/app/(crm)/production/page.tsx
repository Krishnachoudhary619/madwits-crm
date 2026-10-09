"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { jobsApi } from "@/lib/api/endpoints";
import { formatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { allowedStageTargets, listAllJobs } from "@/lib/jobs";
import { formatInr } from "@/lib/money";
import type { Job, WorkflowStage } from "@/types/api";
import { Button, Card, EmptyState, ErrorBanner, Field, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { AttributionSelect } from "@/features/jobs/AttributionSelect";
import { useCatalogs, nameById } from "@/hooks/useCatalogs";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/errors";

function JobCard({
  job,
  customerName,
  categoryName,
  onMove,
}: {
  job: Job;
  customerName: string;
  categoryName: string;
  onMove: (job: Job) => void;
}) {
  return (
    <Card className="p-3">
      <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
        {job.job_number}
      </Link>
      <p className="body-text">{customerName}</p>
      <p className="meta-text">{categoryName}</p>
      <p className="mt-1 meta-text">Due {formatDate(job.due_date)}</p>
      <p className="money body-text font-medium">{formatInr(job.final_amount ?? job.quoted_amount)}</p>
      <Button className="mt-2 w-full" variant="secondary" onClick={() => onMove(job)}>
        Change stage
      </Button>
    </Card>
  );
}

export default function ProductionPage() {
  const toast = useToast();
  const { customers, categories, stagesByCategory, reload } = useCatalogs();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [mobileStage, setMobileStage] = useState("");
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
        current_stage_id: stageFilter || undefined,
        sort: "due_date",
        order: "asc",
      });
      setJobs(items);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [categoryId, stageFilter]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const columns = useMemo(() => {
    const source = categoryId
      ? (stagesByCategory[categoryId] ?? []).filter((stage) => stage.is_active)
      : Object.values(stagesByCategory)
          .flat()
          .filter((stage) => stage.is_active);
    const unique = new Map<string, WorkflowStage & { categoryName: string }>();
    for (const stage of source.sort((a, b) => a.sequence - b.sequence)) {
      unique.set(stage.id, {
        ...stage,
        categoryName: nameById(categories, stage.category_id),
      });
    }
    return [...unique.values()];
  }, [stagesByCategory, categoryId, categories]);

  const jobsByStage = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const job of jobs) {
      const key = job.current_stage_id ?? "unassigned";
      map.set(key, [...(map.get(key) ?? []), job]);
    }
    return map;
  }, [jobs]);

  useEffect(() => {
    if (!mobileStage && columns[0]) setMobileStage(columns[0].id);
  }, [columns, mobileStage]);

  function beginMove(job: Job) {
    const targets = allowedStageTargets(stagesByCategory[job.category_id] ?? [], job.current_stage_id);
    setMoving(job);
    setToStage(targets[0]?.id ?? "");
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
      toast("Stage updated");
      setMoving(null);
      setNotes("");
      await loadJobs();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(`${errorMessage(err)} Refresh the board and retry.`);
        await loadJobs();
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const unassigned = jobsByStage.get("unassigned") ?? [];
  const selectedMobileJobs =
    mobileStage === "unassigned" ? unassigned : (jobsByStage.get(mobileStage) ?? []);

  return (
    <div>
      <PageHeader
        title="Production board"
        description="Confirmed jobs grouped by each category's configured workflow stages. Stage names come from the backend, not a fixed Design/Print list."
        actions={
          <Button variant="secondary" onClick={() => void Promise.all([reload(), loadJobs()])}>
            Refresh
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Select
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setStageFilter("");
            setMobileStage("");
          }}
          aria-label="Filter category"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} aria-label="Filter stage">
          <option value="">All stages</option>
          {columns.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {"categoryName" in stage ? `${stage.categoryName} · ` : ""}
              {stage.name}
            </option>
          ))}
        </Select>
      </div>
      {error && !moving ? <ErrorBanner message={error} /> : null}
      {loading ? (
        <Spinner />
      ) : columns.length === 0 ? (
        <EmptyState
          title="No workflow stages"
          description="Configure print categories and stages before using the production board."
        />
      ) : (
        <>
          <div className="lg:hidden">
            <Select
              aria-label="Production stage"
              value={mobileStage}
              onChange={(event) => setMobileStage(event.target.value)}
            >
              {unassigned.length > 0 ? (
                <option value="unassigned">Unassigned ({unassigned.length})</option>
              ) : null}
              {columns.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name} · {nameById(categories, stage.category_id)} (
                  {(jobsByStage.get(stage.id) ?? []).length})
                </option>
              ))}
            </Select>
            <div className="mt-3 space-y-2">
              {selectedMobileJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  customerName={nameById(customers, job.customer_id)}
                  categoryName={nameById(categories, job.category_id)}
                  onMove={beginMove}
                />
              ))}
              {selectedMobileJobs.length === 0 ? (
                <p className="body-text text-muted">No confirmed jobs in this stage.</p>
              ) : null}
            </div>
          </div>
          <div className="hidden gap-3 overflow-x-auto pb-4 lg:flex">
            {unassigned.length > 0 ? (
              <section className="w-72 shrink-0">
                <h2 className="card-title mb-2">
                  Unassigned <span className="ml-1 font-normal text-muted">{unassigned.length}</span>
                </h2>
                <div className="space-y-2">
                  {unassigned.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      customerName={nameById(customers, job.customer_id)}
                      categoryName={nameById(categories, job.category_id)}
                      onMove={beginMove}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {columns.map((stage) => {
              const columnJobs = jobsByStage.get(stage.id) ?? [];
              return (
                <section key={stage.id} className="w-72 shrink-0">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h2 className="card-title text-charcoal">
                      {stage.name}
                      <span className="ml-2 font-normal text-muted">{columnJobs.length}</span>
                    </h2>
                    <span className="meta-text">{nameById(categories, stage.category_id)}</span>
                  </div>
                  <div className="space-y-2">
                    {columnJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        customerName={nameById(customers, job.customer_id)}
                        categoryName={nameById(categories, job.category_id)}
                        onMove={beginMove}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
      {moving ? (
        <Modal
          title={`Move ${moving.job_number}`}
          onClose={() => setMoving(null)}
          onSubmit={submitMove}
          busy={busy}
          submitLabel="Update stage"
        >
          {error ? <ErrorBanner message={error} /> : null}
          <p className="body-text text-muted">
            Current stage:{" "}
            {nameById(
              (stagesByCategory[moving.category_id] ?? []).map((s) => ({ id: s.id, name: s.name })),
              moving.current_stage_id,
            )}
          </p>
          <Field label="Next stage">
            <Select value={toStage} onChange={(event) => setToStage(event.target.value)}>
              {allowedStageTargets(stagesByCategory[moving.category_id] ?? [], moving.current_stage_id).map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                  {stage.is_final ? " (final)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <AttributionSelect value={attribution} onChange={setAttribution} />
          <Field label="Notes">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

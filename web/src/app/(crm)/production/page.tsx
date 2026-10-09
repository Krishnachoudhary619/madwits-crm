"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { jobsApi } from "@/lib/api/endpoints";
import { formatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { allowedStageTargets, listAllJobs } from "@/lib/jobs";
import { formatInr } from "@/lib/money";
import type { Job, WorkflowStage } from "@/types/api";
import { Button, Card, EmptyState, ErrorBanner, Field, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { AttributionSelect } from "@/features/jobs/AttributionSelect";
import { useCatalogs, nameById } from "@/hooks/useCatalogs";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/errors";

export default function ProductionPage() {
  const toast = useToast();
  const { customers, categories, stagesByCategory, reload } = useCatalogs();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [stageFilter, setStageFilter] = useState("");
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

  async function submitMove() {
    if (!moving) return;
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
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? (
        <Spinner />
      ) : columns.length === 0 ? (
        <EmptyState
          title="No workflow stages"
          description="Configure print categories and stages before using the production board."
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {(jobsByStage.get("unassigned") ?? []).length > 0 ? (
            <section className="w-72 shrink-0">
              <h2 className="mb-2 text-sm font-medium">Unassigned</h2>
              <div className="space-y-2">
                {(jobsByStage.get("unassigned") ?? []).map((job) => (
                  <Card key={job.id} className="p-3">
                    <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                      {job.job_number}
                    </Link>
                    <p className="text-sm">{nameById(customers, job.customer_id)}</p>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
          {columns.map((stage) => {
            const columnJobs = jobsByStage.get(stage.id) ?? [];
            return (
              <section key={stage.id} className="w-72 shrink-0">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-sm font-medium text-charcoal">
                    {stage.name}
                    <span className="ml-2 text-xs font-normal text-muted">{columnJobs.length}</span>
                  </h2>
                  <span className="text-[11px] text-muted">{nameById(categories, stage.category_id)}</span>
                </div>
                <div className="space-y-2">
                  {columnJobs.map((job) => (
                    <Card key={job.id} className="p-3">
                      <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                        {job.job_number}
                      </Link>
                      <p className="text-sm">{nameById(customers, job.customer_id)}</p>
                      <p className="text-xs text-muted">{nameById(categories, job.category_id)}</p>
                      <p className="mt-1 text-xs text-muted">Due {formatDate(job.due_date)}</p>
                      <p className="text-xs">{formatInr(job.final_amount ?? job.quoted_amount)}</p>
                      <Button
                        className="mt-2 w-full"
                        variant="secondary"
                        onClick={() => {
                          const targets = allowedStageTargets(stagesByCategory[job.category_id] ?? [], job.current_stage_id);
                          setMoving(job);
                          setToStage(targets[0]?.id ?? "");
                          setNotes("");
                        }}
                      >
                        Change stage
                      </Button>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {moving ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Move {moving.job_number}</h2>
            <p className="mt-1 text-sm text-muted">
              Current stage: {nameById((stagesByCategory[moving.category_id] ?? []).map((s) => ({ id: s.id, name: s.name })), moving.current_stage_id)}
            </p>
            <div className="mt-4 space-y-4">
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
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setMoving(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" disabled={busy || !toStage || !attribution} onClick={() => void submitMove()}>
                {busy ? "Saving…" : "Update stage"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

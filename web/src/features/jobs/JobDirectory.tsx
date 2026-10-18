"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { jobsApi } from "@/lib/api/endpoints";
import { dateToIsoEnd, dateToIsoStart, formatDate, todayIsoDate, toDateInput } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { formatInr } from "@/lib/money";
import { LEAD_LABELS, OPEN_ENQUIRY_STATUSES } from "@/lib/lifecycle";
import type { Job, LeadStatus } from "@/types/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  FilterPanel,
  Input,
  PageHeader,
  Pagination,
  RecordCard,
  ResponsiveRecords,
  Select,
  Spinner,
} from "@/components/ui";
import { LeadBadge } from "@/components/StatusBadge";
import { useCatalogs, nameById } from "@/hooks/useCatalogs";
import { JobForm } from "@/features/jobs/JobForm";
import { useToast } from "@/components/Toast";

const ALL_STATUSES: LeadStatus[] = [
  "NEW_INQUIRY",
  "QUOTATION_PREPARED",
  "AWAITING_CONFIRMATION",
  "CONFIRMED",
  "COMPLETED",
  "LOST",
  "CANCELLED",
];

export function JobDirectory({
  title,
  description,
  mode,
}: {
  title: string;
  description: string;
  mode: "enquiries" | "jobs";
}) {
  const params = useSearchParams();
  const toast = useToast();
  const { customers, categories, stagesByCategory } = useCatalogs();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? params.get("lead_status") ?? "");
  const [customerId, setCustomerId] = useState(params.get("customer_id") ?? "");
  const [categoryId, setCategoryId] = useState(params.get("category_id") ?? "");
  const [stageId, setStageId] = useState(params.get("current_stage_id") ?? "");
  const [from, setFrom] = useState(params.get("created_from") ?? "");
  const [to, setTo] = useState(params.get("created_to") ?? "");
  const [dueFrom, setDueFrom] = useState(params.get("due_from") ?? "");
  const [dueTo, setDueTo] = useState(params.get("due_to") ?? "");
  const [overdue, setOverdue] = useState(params.get("follow_up_overdue") === "true");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [listVersion, setListVersion] = useState(0);

  const stageOptions = useMemo(
    () =>
      Object.values(stagesByCategory)
        .flat()
        .filter((stage) => !categoryId || stage.category_id === categoryId)
        .sort((a, b) => a.sequence - b.sequence),
    [stagesByCategory, categoryId],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const leadStatus = status
        ? [status]
        : mode === "enquiries"
          ? OPEN_ENQUIRY_STATUSES
          : undefined;
      try {
        const result = await jobsApi.list({
          q: q || undefined,
          lead_status: leadStatus,
          customer_id: customerId || undefined,
          category_id: categoryId || undefined,
          current_stage_id: stageId || undefined,
          created_from: dateToIsoStart(from),
          created_to: dateToIsoEnd(to),
          due_from: dateToIsoStart(dueFrom),
          due_to: dateToIsoEnd(dueTo),
          follow_up_overdue: overdue || undefined,
          page,
          page_size: 20,
          sort: "created_at",
          order: "desc",
        });
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [q, status, customerId, categoryId, stageId, from, to, dueFrom, dueTo, overdue, page, mode, listVersion]);

  function stepName(job: Job): string {
    if (job.current_stage_id) {
      const stage = Object.values(stagesByCategory)
        .flat()
        .find((item) => item.id === job.current_stage_id);
      if (stage) return stage.name;
    }
    return LEAD_LABELS[job.lead_status];
  }

  function dueText(due: string | null): { text: string; late: boolean } {
    if (!due) return { text: "No due date", late: false };
    const day = toDateInput(due);
    const today = todayIsoDate();
    if (day < today) return { text: `Late · ${formatDate(due)}`, late: true };
    if (day === today) return { text: "Due today", late: true };
    return { text: formatDate(due), late: false };
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button onClick={() => setCreating(true)}>
            {mode === "enquiries" ? "New enquiry" : "New enquiry"}
          </Button>
        }
      />
      <FilterPanel>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Input
            placeholder="Search job number, title, customer"
            value={q}
            onChange={(event) => {
              setPage(1);
              setQ(event.target.value);
            }}
          />
          <Select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
          >
            <option value="">{mode === "enquiries" ? "Open statuses" : "All statuses"}</option>
            {(mode === "enquiries" ? OPEN_ENQUIRY_STATUSES : ALL_STATUSES).map((item) => (
              <option key={item} value={item}>
                {LEAD_LABELS[item]}
              </option>
            ))}
          </Select>
          <Select
            value={categoryId}
            onChange={(event) => {
              setPage(1);
              setCategoryId(event.target.value);
              setStageId("");
            }}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          {mode === "jobs" ? (
            <Select
              value={stageId}
              onChange={(event) => {
                setPage(1);
                setStageId(event.target.value);
              }}
            >
              <option value="">All stages</option>
              {stageOptions.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {nameById(categories, stage.category_id)} · {stage.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Field label="Opened from">
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setPage(1);
                setFrom(event.target.value);
              }}
            />
          </Field>
          <Field label="Opened to">
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setPage(1);
                setTo(event.target.value);
              }}
            />
          </Field>
        </div>
        {customerId ? (
          <p className="mt-3 body-text text-muted">
            Showing jobs for one customer.{" "}
            <button type="button" className="underline" onClick={() => { setPage(1); setCustomerId(""); }}>
              Clear customer filter
            </button>
          </p>
        ) : null}
        {mode === "jobs" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Due from">
              <Input
                type="date"
                value={dueFrom}
                onChange={(event) => {
                  setPage(1);
                  setDueFrom(event.target.value);
                }}
              />
            </Field>
            <Field label="Due to">
              <Input
                type="date"
                value={dueTo}
                onChange={(event) => {
                  setPage(1);
                  setDueTo(event.target.value);
                }}
              />
            </Field>
          </div>
        ) : null}
        {mode === "jobs" ? (
          <label className="mt-3 flex min-h-11 items-center gap-2 body-text text-charcoal">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={overdue}
              onChange={(event) => {
                setPage(1);
                setOverdue(event.target.checked);
              }}
            />
            Follow-up is late
          </label>
        ) : null}
      </FilterPanel>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          title={mode === "enquiries" ? "No enquiries match" : "No jobs match"}
          description="Adjust filters or create a new enquiry from an existing customer."
          action={<Button onClick={() => setCreating(true)}>New enquiry</Button>}
        />
      ) : (
        <Card>
          <div className="p-3 md:p-0">
            <ResponsiveRecords
              cards={items.map((job) => {
                const due = dueText(job.due_date);
                return (
                  <RecordCard
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    title={mode === "jobs" ? nameById(customers, job.customer_id) : job.job_number}
                    subtitle={
                      mode === "jobs"
                        ? `${job.title || nameById(categories, job.category_id)} · ${job.job_number}`
                        : `${nameById(customers, job.customer_id)} · ${nameById(categories, job.category_id)}`
                    }
                    extra={
                      mode === "jobs" ? (
                        <span className="shrink-0 text-sm font-medium text-charcoal">{stepName(job)}</span>
                      ) : (
                        <LeadBadge status={job.lead_status} />
                      )
                    }
                    meta={
                      <>
                        <span className="money">{formatInr(job.final_amount ?? job.quoted_amount)}</span>
                        <span className={due.late ? "font-medium text-danger" : undefined}>{due.text}</span>
                        {mode === "jobs" ? <span>{nameById(categories, job.category_id)}</span> : job.title ? <span className="truncate">{job.title}</span> : null}
                      </>
                    }
                  />
                );
              })}
              table={
                <table className="table-grid">
                  <thead>
                    <tr>
                      {mode === "jobs" ? (
                        <>
                          <th>Customer</th>
                          <th>What to print</th>
                          <th>Step</th>
                          <th>Due</th>
                          <th>Amount</th>
                        </>
                      ) : (
                        <>
                          <th>Job</th>
                          <th>Customer</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Amount</th>
                          <th>Due</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((job) => {
                      const due = dueText(job.due_date);
                      return mode === "jobs" ? (
                        <tr key={job.id}>
                          <td>
                            <Link className="font-medium hover:underline" href={`/jobs/${job.id}`}>
                              {nameById(customers, job.customer_id)}
                            </Link>
                            <div className="meta-text">{job.job_number}</div>
                          </td>
                          <td>
                            {job.title || "—"}
                            <div className="meta-text">{nameById(categories, job.category_id)}</div>
                          </td>
                          <td>{stepName(job)}</td>
                          <td className={due.late ? "font-medium text-danger" : undefined}>{due.text}</td>
                          <td className="money">{formatInr(job.final_amount ?? job.quoted_amount)}</td>
                        </tr>
                      ) : (
                        <tr key={job.id}>
                          <td>
                            <Link className="font-medium hover:underline" href={`/jobs/${job.id}`}>
                              {job.job_number}
                            </Link>
                            <div className="meta-text">{job.title}</div>
                          </td>
                          <td>{nameById(customers, job.customer_id)}</td>
                          <td>{nameById(categories, job.category_id)}</td>
                          <td>
                            <LeadBadge status={job.lead_status} />
                          </td>
                          <td className="money">{formatInr(job.final_amount ?? job.quoted_amount)}</td>
                          <td>{formatDate(job.due_date)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              }
            />
          </div>
          <Pagination page={page} pageSize={20} total={total} onPage={setPage} />
        </Card>
      )}
      {creating ? (
        <JobForm
          categories={categories}
          onClose={() => setCreating(false)}
          onSaved={(job, options) => {
            if (options?.continue) {
              toast(`Enquiry ${job.job_number} saved`);
              setPage(1);
              setListVersion((version) => version + 1);
              return;
            }
            setCreating(false);
            toast("Enquiry created");
            window.location.href = `/jobs/${job.id}`;
          }}
        />
      ) : null}
    </div>
  );
}

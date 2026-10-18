"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { dashboardApi, jobsApi } from "@/lib/api/endpoints";
import { dateToIsoEnd, dateToIsoStart, formatDate, monthStartIsoDate, todayIsoDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { formatInr } from "@/lib/money";
import { LEAD_LABELS } from "@/lib/lifecycle";
import type { DashboardSummary, Job, JobsByStageItem, PaymentsSummary } from "@/types/api";
import { buttonClass, Card, ErrorBanner, Spinner } from "@/components/ui";
import { useCatalogs, nameById } from "@/hooks/useCatalogs";

function placeLabel(job: Job, stageName: string | undefined): string {
  if ((job.lead_status === "CONFIRMED" || job.lead_status === "COMPLETED") && stageName) {
    return stageName;
  }
  return LEAD_LABELS[job.lead_status];
}

export default function DashboardPage() {
  const { customers, categories, stagesByCategory } = useCatalogs();
  const today = todayIsoDate();
  const monthStart = monthStartIsoDate();
  const [todaySummary, setTodaySummary] = useState<DashboardSummary | null>(null);
  const [monthSummary, setMonthSummary] = useState<DashboardSummary | null>(null);
  const [payments, setPayments] = useState<PaymentsSummary | null>(null);
  const [byStage, setByStage] = useState<JobsByStageItem[]>([]);
  const [recent, setRecent] = useState<Job[]>([]);
  const [dueToday, setDueToday] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const stageNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const stages of Object.values(stagesByCategory)) {
      for (const stage of stages) map.set(stage.id, stage.name);
    }
    return map;
  }, [stagesByCategory]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [todaySum, monthSum, pay, stages, latest, due] = await Promise.all([
          dashboardApi.summary(today, today),
          dashboardApi.summary(monthStart, today),
          dashboardApi.paymentsSummary(monthStart, today),
          dashboardApi.jobsByStage(),
          jobsApi.list({ page: 1, page_size: 5, sort: "created_at", order: "desc" }),
          jobsApi.list({
            lead_status: ["CONFIRMED"],
            due_from: dateToIsoStart(today),
            due_to: dateToIsoEnd(today),
            page: 1,
            page_size: 1,
          }),
        ]);
        if (cancelled) return;
        setTodaySummary(todaySum);
        setMonthSummary(monthSum);
        setPayments(pay);
        setByStage(stages.items);
        setRecent(latest.items);
        setDueToday(due.total);
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
  }, [monthStart, today]);

  const activeStages = byStage
    .filter((item) => item.job_count > 0)
    .sort((a, b) => b.job_count - a.job_count || a.stage_name.localeCompare(b.stage_name));
  const busiest = activeStages[0]?.job_count ?? 0;
  const activeJobCount = activeStages.reduce((sum, item) => sum + item.job_count, 0);

  return (
    <div>
      <h1 className="page-title text-charcoal">Dashboard</h1>
      {error ? (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      ) : null}
      {loading || !todaySummary || !monthSummary ? (
        <div className="mt-6">
          <Spinner />
        </div>
      ) : (
        <>
          <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <NumberCard
              href="/jobs"
              label="Orders today"
              value={String(todaySummary.confirmed_created_in_period)}
              hint="Confirmed jobs opened today"
            />
            <NumberCard
              href="/production"
              label="In the shop"
              value={String(monthSummary.in_production)}
              hint={dueToday === 0 ? "None due today" : `${dueToday} due today`}
            />
            <NumberCard
              href="/payments"
              label="Received this month"
              value={formatInr(payments?.total_received)}
              hint={`${payments?.payment_count ?? 0} payment${payments?.payment_count === 1 ? "" : "s"}`}
            />
            <NumberCard
              href="/payments"
              label="Still to collect"
              value={formatInr(monthSummary.outstanding_balance)}
              hint="Owed on confirmed jobs"
            />
          </section>

          <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
            <Card className="p-4 sm:p-5 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="section-title text-charcoal">Recent jobs</h2>
                <Link href="/jobs" className="text-sm font-medium text-charcoal hover:underline">
                  View all
                </Link>
              </div>
              {recent.length === 0 ? (
                <p className="body-text text-muted">No jobs yet. A new enquiry will show up here.</p>
              ) : (
                <>
                  <ul className="divide-y divide-line md:hidden">
                    {recent.map((job) => (
                      <li key={job.id} className="py-3">
                        <Link href={`/jobs/${job.id}`} className="font-medium text-charcoal hover:underline">
                          {nameById(customers, job.customer_id)}
                        </Link>
                        <p className="meta-text">
                          {job.job_number} · {nameById(categories, job.category_id)}
                        </p>
                        <p className="mt-0.5 text-sm text-charcoal">
                          {placeLabel(job, stageNameById.get(job.current_stage_id ?? ""))}
                          {" · "}
                          {job.due_date ? formatDate(job.due_date) : "No due date"}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="table-grid">
                      <thead>
                        <tr>
                          <th>Job</th>
                          <th>Customer</th>
                          <th>Print type</th>
                          <th>Where it is</th>
                          <th>Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recent.map((job) => (
                          <tr key={job.id}>
                            <td>
                              <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                                {job.job_number}
                              </Link>
                            </td>
                            <td>{nameById(customers, job.customer_id)}</td>
                            <td>{nameById(categories, job.category_id)}</td>
                            <td>{placeLabel(job, stageNameById.get(job.current_stage_id ?? ""))}</td>
                            <td>{job.due_date ? formatDate(job.due_date) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>

            <Card className="p-4 sm:p-5">
              <h2 className="section-title text-charcoal">Start here</h2>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <Link href="/enquiries" className={buttonClass()}>
                  New enquiry
                </Link>
                <Link href="/customers" className={buttonClass("secondary")}>
                  Customers
                </Link>
                <Link href="/production" className={buttonClass("secondary")}>
                  Work in progress
                </Link>
                <Link href="/payments" className={buttonClass("secondary")}>
                  Payments
                </Link>
                <Link href="/jobs" className={buttonClass("secondary")}>
                  All jobs
                </Link>
                <Link href="/reports" className={buttonClass("secondary")}>
                  Reports
                </Link>
              </div>
            </Card>
          </div>

          <Card className="mt-4 p-4 sm:p-5">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="section-title text-charcoal">On the shop floor</h2>
              <span className="meta-text">
                {activeJobCount} active {activeJobCount === 1 ? "job" : "jobs"}
              </span>
            </div>
            {activeStages.length === 0 ? (
              <p className="body-text text-muted">No confirmed jobs are on a production step.</p>
            ) : (
              <ul className="space-y-3">
                {activeStages.map((item) => {
                  const width = busiest > 0 ? Math.max(8, Math.round((item.job_count / busiest) * 100)) : 0;
                  return (
                    <li key={item.stage_id}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-charcoal">
                          {item.stage_name}
                          <span className="font-normal text-muted"> · {item.category_name}</span>
                        </span>
                        <span className="text-muted">{item.job_count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-canvas">
                        <div className="h-full rounded-full bg-amber" style={{ width: `${width}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function NumberCard({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link href={href} className="min-w-0">
      <Card className="h-full p-4 transition-colors hover:border-charcoal/25">
        <p className="label-text text-muted">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-charcoal">{value}</p>
        <p className="mt-1 meta-text">{hint}</p>
      </Card>
    </Link>
  );
}

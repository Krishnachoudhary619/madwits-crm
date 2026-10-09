"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ClipboardList,
  Factory,
  FileWarning,
  PhoneCall,
} from "lucide-react";
import { dashboardApi, jobsApi } from "@/lib/api/endpoints";
import { monthStartIsoDate, todayIsoDate } from "@/lib/dates";
import { formatInr } from "@/lib/money";
import { errorMessage } from "@/lib/errors";
import type { DashboardSummary, Job, JobsByCategoryItem, JobsByStageItem, PaymentsSummary } from "@/types/api";
import { Card, ErrorBanner, Input, PageHeader, Spinner } from "@/components/ui";
import { LeadBadge } from "@/components/StatusBadge";
import { useCatalogs, nameById } from "@/hooks/useCatalogs";

const kpis = [
  { key: "open_inquiries", label: "Open enquiries", href: "/enquiries", icon: ClipboardList },
  { key: "quotations_awaiting_confirmation", label: "Awaiting confirmation", href: "/enquiries?status=AWAITING_CONFIRMATION", icon: FileWarning },
  { key: "in_production", label: "In production", href: "/production", icon: Factory },
  { key: "completed_in_period", label: "Completed in period", href: "/jobs?lead_status=CONFIRMED", icon: CheckCircle2 },
  { key: "payments_received_in_period", label: "Payments received", href: "/payments", money: true, icon: Banknote },
  { key: "outstanding_balance", label: "Outstanding balances", href: "/payments", money: true, icon: Banknote },
  { key: "follow_ups_due_today", label: "Follow-ups due today", href: "/jobs", icon: PhoneCall },
  { key: "follow_ups_overdue", label: "Follow-ups overdue", href: "/jobs?follow_up_overdue=true", icon: PhoneCall },
] as const;

export default function DashboardPage() {
  const { customers } = useCatalogs();
  const [from, setFrom] = useState(monthStartIsoDate());
  const [to, setTo] = useState(todayIsoDate());
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [stages, setStages] = useState<JobsByStageItem[]>([]);
  const [byCategory, setByCategory] = useState<JobsByCategoryItem[]>([]);
  const [payments, setPayments] = useState<PaymentsSummary | null>(null);
  const [recent, setRecent] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [sum, stage, cat, pay, jobs] = await Promise.all([
          dashboardApi.summary(from, to),
          dashboardApi.jobsByStage(),
          dashboardApi.jobsByCategory(),
          dashboardApi.paymentsSummary(from, to),
          jobsApi.list({ page: 1, page_size: 8, sort: "created_at", order: "desc" }),
        ]);
        if (cancelled) return;
        setSummary(sum);
        setStages(stage.items);
        setByCategory(cat.items);
        setPayments(pay);
        setRecent(jobs.items);
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
  }, [from, to]);

  const maxStage = Math.max(1, ...stages.map((item) => item.job_count));
  const maxCat = Math.max(1, ...byCategory.map((item) => item.job_count));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live shop activity from the MadWits CRM database. Date filters apply to completed jobs, conversion, and payments in the selected shop-local period."
        actions={
          <div className="flex gap-2">
            <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      {loading || !summary ? (
        <Spinner />
      ) : (
        <>
          <p className="mb-4 text-xs text-muted">
            Period {summary.period.from_date} to {summary.period.to_date} ({summary.period.timezone})
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              const raw = summary[kpi.key];
              const value = "money" in kpi && kpi.money ? formatInr(String(raw)) : String(raw);
              return (
                <Link key={kpi.key} href={kpi.href}>
                  <Card className="h-full p-4 hover:border-charcoal/30">
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-muted">{kpi.label}</p>
                      <Icon size={16} className="text-muted" aria-hidden />
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-charcoal">{value}</p>
                  </Card>
                </Link>
              );
            })}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="font-medium text-charcoal">Jobs by production stage</h2>
              <p className="mb-3 text-xs text-muted">Confirmed jobs on each active stage. Empty stages show zero.</p>
              <ul className="space-y-2">
                {stages.map((item) => (
                  <li key={item.stage_id} className="text-sm">
                    <div className="flex justify-between gap-2">
                      <span>
                        {item.category_name} · {item.stage_name}
                      </span>
                      <span className="font-medium">{item.job_count}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-canvas">
                      <div className="h-1.5 rounded bg-amber" style={{ width: `${(item.job_count / maxStage) * 100}%` }} />
                    </div>
                  </li>
                ))}
                {stages.length === 0 ? <li className="text-sm text-muted">No stages configured yet.</li> : null}
              </ul>
            </Card>
            <Card className="p-4">
              <h2 className="font-medium text-charcoal">Jobs by print category</h2>
              <ul className="mt-3 space-y-2">
                {byCategory.map((item) => (
                  <li key={item.category_id} className="text-sm">
                    <div className="flex justify-between">
                      <span>{item.category_name}</span>
                      <span>{item.job_count} total · {item.in_production_count} in production</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-canvas">
                      <div className="h-1.5 rounded bg-charcoal" style={{ width: `${(item.job_count / maxCat) * 100}%` }} />
                    </div>
                  </li>
                ))}
                {byCategory.length === 0 ? <li className="text-sm text-muted">No categories yet.</li> : null}
              </ul>
            </Card>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="font-medium text-charcoal">Payments in period</h2>
              <p className="mt-2 text-2xl font-semibold">{formatInr(payments?.total_received)}</p>
              <p className="text-sm text-muted">{payments?.payment_count ?? 0} payment records</p>
              <ul className="mt-3 space-y-1 text-sm">
                {(payments?.by_method ?? []).map((method) => (
                  <li key={method.payment_method} className="flex justify-between">
                    <span>{method.payment_method}</span>
                    <span>
                      {formatInr(method.total_amount)} ({method.payment_count})
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-4">
              <h2 className="font-medium text-charcoal">Recent jobs</h2>
              <p className="mb-3 text-xs text-muted">Latest eight jobs from the jobs API, not a global metric.</p>
              <ul className="space-y-2">
                {recent.map((job) => (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`} className="flex items-center justify-between gap-2 text-sm hover:underline">
                      <span>
                        {job.job_number} · {nameById(customers, job.customer_id)}
                      </span>
                      <LeadBadge status={job.lead_status} />
                    </Link>
                  </li>
                ))}
                {recent.length === 0 ? <li className="text-sm text-muted">No jobs yet.</li> : null}
              </ul>
            </Card>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link className="rounded-md bg-amber px-3 py-2 font-medium text-charcoal" href="/customers">
              New customer
            </Link>
            <Link className="rounded-md border border-line bg-white px-3 py-2" href="/enquiries">
              New enquiry
            </Link>
            <Link className="rounded-md border border-line bg-white px-3 py-2" href="/payments">
              Record payment
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">
            Conversion in this period: {summary.confirmed_created_in_period} of {summary.jobs_created_in_period} created jobs
            ({summary.conversion_rate}). Pipeline value {formatInr(summary.open_quotation_pipeline_value)}.
          </p>
        </>
      )}
    </div>
  );
}

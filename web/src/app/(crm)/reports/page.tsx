"use client";

import { useEffect, useState } from "react";
import { dashboardApi } from "@/lib/api/endpoints";
import { monthStartIsoDate, todayIsoDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { formatInr } from "@/lib/money";
import type { DashboardSummary, JobsByCategoryItem, JobsByStageItem, PaymentsSummary } from "@/types/api";
import { Card, ErrorBanner, Input, PageHeader, Spinner } from "@/components/ui";

export default function ReportsPage() {
  const [from, setFrom] = useState(monthStartIsoDate());
  const [to, setTo] = useState(todayIsoDate());
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [stages, setStages] = useState<JobsByStageItem[]>([]);
  const [categories, setCategories] = useState<JobsByCategoryItem[]>([]);
  const [payments, setPayments] = useState<PaymentsSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [sum, stage, cat, pay] = await Promise.all([
          dashboardApi.summary(from, to),
          dashboardApi.jobsByStage(),
          dashboardApi.jobsByCategory(),
          dashboardApi.paymentsSummary(from, to),
        ]);
        if (cancelled) return;
        setSummary(sum);
        setStages(stage.items);
        setCategories(cat.items);
        setPayments(pay);
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

  return (
    <div>
      <PageHeader
        title="Reports & analytics"
        description="Figures are the same backend dashboard aggregations used on the home page. Profit, GST, inventory, and staff performance are not available from the API."
        actions={
          <div className="flex gap-2">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To" />
          </div>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      {loading || !summary ? (
        <Spinner />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-sm text-muted">Jobs created</p>
              <p className="text-2xl font-semibold">{summary.jobs_created_in_period}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted">Confirmed (created in period)</p>
              <p className="text-2xl font-semibold">{summary.confirmed_created_in_period}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted">Conversion rate</p>
              <p className="text-2xl font-semibold">{summary.conversion_rate}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted">Pipeline value</p>
              <p className="text-2xl font-semibold">{formatInr(summary.open_quotation_pipeline_value)}</p>
            </Card>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="overflow-x-auto">
              <h2 className="p-4 font-medium">Jobs by category</h2>
              <table className="table-grid">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Total</th>
                    <th>Confirmed</th>
                    <th>In production</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((item) => (
                    <tr key={item.category_id}>
                      <td>{item.category_name}</td>
                      <td>{item.job_count}</td>
                      <td>{item.confirmed_count}</td>
                      <td>{item.in_production_count}</td>
                      <td>{item.completed_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card className="overflow-x-auto">
              <h2 className="p-4 font-medium">Production workload by stage</h2>
              <table className="table-grid">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Stage</th>
                    <th>Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((item) => (
                    <tr key={item.stage_id}>
                      <td>{item.category_name}</td>
                      <td>{item.stage_name}</td>
                      <td>{item.job_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
          <Card className="mt-4 overflow-x-auto">
            <h2 className="p-4 font-medium">Payments received in period</h2>
            <p className="px-4 text-2xl font-semibold">{formatInr(payments?.total_received)}</p>
            <p className="px-4 text-sm text-muted">{payments?.payment_count ?? 0} records · outstanding {formatInr(summary.outstanding_balance)}</p>
            <table className="mt-3 table-grid">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Count</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(payments?.by_method ?? []).map((item) => (
                  <tr key={item.payment_method}>
                    <td>{item.payment_method}</td>
                    <td>{item.payment_count}</td>
                    <td>{formatInr(item.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="mt-4 p-4 text-sm text-muted">
            <h2 className="mb-2 font-medium text-charcoal">Not in this release</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>GST / invoice reports</li>
              <li>Profit margins, material costs, inventory</li>
              <li>Employee performance scores</li>
              <li>Multi-period trend charts (no historical snapshot API)</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

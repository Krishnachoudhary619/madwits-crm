"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { dashboardApi, jobsApi, paymentsApi } from "@/lib/api/endpoints";
import { dateToIsoEnd, dateToIsoStart, formatDateTime } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { formatInr } from "@/lib/money";
import type { Job, JobBalance, Payment } from "@/types/api";
import { Button, Card, EmptyState, ErrorBanner, Input, PageHeader, Pagination, Select, Spinner } from "@/components/ui";
import { PaymentBadge } from "@/components/StatusBadge";
import { PaymentModal } from "@/features/jobs/JobActions";
import { useCatalogs, nameById } from "@/hooks/useCatalogs";
import { useToast } from "@/components/Toast";

export default function PaymentsPage() {
  const toast = useToast();
  const { customers } = useCatalogs();
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Payment[]>([]);
  const [jobMap, setJobMap] = useState<Record<string, Job>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [outstandingTotal, setOutstandingTotal] = useState("0");
  const [outstandingJobs, setOutstandingJobs] = useState<(Job & { balance?: JobBalance })[]>([]);
  const [outPage, setOutPage] = useState(1);
  const [outTotal, setOutTotal] = useState(0);
  const [payingJob, setPayingJob] = useState<(Job & { balance: JobBalance }) | null>(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await paymentsApi.list({
        payment_method: method || undefined,
        paid_from: dateToIsoStart(from),
        paid_to: dateToIsoEnd(to),
        page,
        page_size: 20,
      });
      setItems(result.items);
      setTotal(result.total);
      const uniqueIds = [...new Set(result.items.map((item) => item.job_id))];
      const jobs = await Promise.all(uniqueIds.map((id) => jobsApi.get(id).catch(() => null)));
      const next: Record<string, Job> = {};
      jobs.forEach((job) => {
        if (job) next[job.id] = job;
      });
      setJobMap(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [method, from, to, page]);

  const loadOutstanding = useCallback(async () => {
    const [summary, jobs] = await Promise.all([
      dashboardApi.summary(),
      jobsApi.list({
        lead_status: ["CONFIRMED"],
        page: outPage,
        page_size: 20,
        sort: "updated_at",
        order: "desc",
      }),
    ]);
    setOutstandingTotal(summary.outstanding_balance);
    const withBalances = await Promise.all(
      jobs.items.map(async (job) => {
        const balance = await jobsApi.balance(job.id).catch(() => undefined);
        return { ...job, balance };
      }),
    );
    setOutstandingJobs(withBalances);
    setOutTotal(jobs.total);
  }, [outPage]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    void loadOutstanding().catch((err) => setError(errorMessage(err)));
  }, [loadOutstanding]);

  return (
    <div>
      <PageHeader
        title="Payments & outstanding"
        description="Payment rows come from /payments. Outstanding totals come from the dashboard; the table below shows balances for the current confirmed-job page only."
        actions={<Button onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}>Outstanding</Button>}
      />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Select
            value={method}
            onChange={(event) => {
              setPage(1);
              setMethod(event.target.value);
            }}
          >
            <option value="">All methods</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
          </Select>
          <Input type="date" value={from} onChange={(event) => { setPage(1); setFrom(event.target.value); }} aria-label="Paid from" />
          <Input type="date" value={to} onChange={(event) => { setPage(1); setTo(event.target.value); }} aria-label="Paid to" />
        </div>
      </Card>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="No payments in this view" description="Record a payment from a confirmed job card." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="table-grid">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Job</th>
                  <th>Customer</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((payment) => {
                  const job = jobMap[payment.job_id];
                  return (
                    <tr key={payment.id}>
                      <td>{formatDateTime(payment.paid_at)}</td>
                      <td>
                        {job ? (
                          <Link className="hover:underline" href={`/jobs/${job.id}`}>
                            {job.job_number}
                          </Link>
                        ) : (
                          payment.job_id
                        )}
                      </td>
                      <td>{job ? nameById(customers, job.customer_id) : "—"}</td>
                      <td>{payment.payment_method}</td>
                      <td>{payment.reference_number || "—"}</td>
                      <td>{formatInr(payment.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={20} total={total} onPage={setPage} />
        </Card>
      )}

      <h2 className="mt-8 text-lg font-semibold">Outstanding confirmed jobs</h2>
      <p className="mb-3 text-sm text-muted">
        Shop-wide outstanding balance: <strong>{formatInr(outstandingTotal)}</strong>
      </p>
      <Card>
        <div className="overflow-x-auto">
          <table className="table-grid">
            <thead>
              <tr>
                <th>Job</th>
                <th>Customer</th>
                <th>Due</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {outstandingJobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link className="hover:underline" href={`/jobs/${job.id}`}>
                      {job.job_number}
                    </Link>
                  </td>
                  <td>{nameById(customers, job.customer_id)}</td>
                  <td>{formatInr(job.balance?.amount_due)}</td>
                  <td>{formatInr(job.balance?.total_paid)}</td>
                  <td>{formatInr(job.balance?.balance)}</td>
                  <td>{job.balance ? <PaymentBadge status={job.balance.payment_status} /> : "—"}</td>
                  <td>
                    {job.balance && job.balance.payment_status !== "PAID" ? (
                      <Button
                        variant="secondary"
                        onClick={() => setPayingJob({ ...job, balance: job.balance as JobBalance })}
                      >
                        Record
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={outPage} pageSize={20} total={outTotal} onPage={setOutPage} />
      </Card>
      {payingJob?.balance ? (
        <PaymentModal
          jobId={payingJob.id}
          amountDue={payingJob.balance.amount_due}
          totalPaid={payingJob.balance.total_paid}
          balance={payingJob.balance.balance}
          onClose={() => setPayingJob(null)}
          onSaved={() => {
            setPayingJob(null);
            toast("Payment recorded");
            void loadPayments();
            void loadOutstanding();
          }}
        />
      ) : null}
    </div>
  );
}

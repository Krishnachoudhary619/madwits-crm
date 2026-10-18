"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { dashboardApi, jobsApi, paymentsApi } from "@/lib/api/endpoints";
import { dateToIsoEnd, dateToIsoStart, formatDateTime } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { listAllJobs } from "@/lib/jobs";
import { formatInr } from "@/lib/money";
import type { Job, JobBalance, Payment } from "@/types/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  Pagination,
  RecordCard,
  ResponsiveRecords,
  Select,
  Spinner,
} from "@/components/ui";
import { PaymentBadge } from "@/components/StatusBadge";
import { PaymentModal } from "@/features/jobs/JobActions";
import { useCatalogs, nameById } from "@/hooks/useCatalogs";
import { useToast } from "@/components/Toast";

function methodLabel(method: string) {
  if (method === "CASH") return "Cash";
  if (method === "UPI") return "UPI";
  if (method === "BANK_TRANSFER") return "Bank transfer";
  return method;
}

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
  const [owingJobs, setOwingJobs] = useState<(Job & { balance: JobBalance })[]>([]);
  const [owingLoading, setOwingLoading] = useState(true);
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
    setOwingLoading(true);
    try {
      const [summary, jobs] = await Promise.all([
        dashboardApi.summary(),
        listAllJobs({
          lead_status: ["CONFIRMED", "COMPLETED"],
          sort: "updated_at",
          order: "desc",
        }),
      ]);
      setOutstandingTotal(summary.outstanding_balance);
      const withBalances = await Promise.all(
        jobs.map(async (job) => {
          const balance = await jobsApi.balance(job.id).catch(() => undefined);
          return balance && balance.payment_status !== "PAID" ? { ...job, balance } : null;
        }),
      );
      setOwingJobs(withBalances.filter((job): job is Job & { balance: JobBalance } => job !== null));
    } finally {
      setOwingLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    void loadOutstanding().catch((err) => setError(errorMessage(err)));
  }, [loadOutstanding]);

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Who still owes, and the money already received."
      />
      <Card className="mb-6 p-4">
        <p className="label-text text-muted">Still to collect</p>
        <p className="money mt-1 text-2xl font-semibold text-charcoal">{formatInr(outstandingTotal)}</p>
        <p className="mt-1 meta-text">Confirmed jobs that are not fully paid</p>
      </Card>
      {error ? <ErrorBanner message={error} /> : null}

      <h2 className="section-title text-charcoal">Who still owes</h2>
      <p className="mb-3 body-text text-muted">Record the next payment against the job.</p>
      {owingLoading ? (
        <Spinner />
      ) : owingJobs.length === 0 ? (
        <EmptyState title="Nothing left to collect" description="Every confirmed job is fully paid." />
      ) : (
        <div className="space-y-2">
          {owingJobs.map((job) => (
            <Card key={job.id} className="p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/jobs/${job.id}`} className="font-medium text-charcoal hover:underline">
                    {nameById(customers, job.customer_id)}
                  </Link>
                  <p className="mt-0.5 break-words body-text text-muted">
                    {job.title} · {job.job_number}
                  </p>
                </div>
                <PaymentBadge status={job.balance.payment_status} />
              </div>
              <p className="money mt-2 text-lg font-semibold text-charcoal">{formatInr(job.balance.balance)} left</p>
              <p className="meta-text">
                Paid {formatInr(job.balance.total_paid)} of {formatInr(job.balance.amount_due)}
              </p>
              <Button className="mt-3 w-full sm:w-auto" variant="secondary" onClick={() => setPayingJob(job)}>
                Record payment
              </Button>
            </Card>
          ))}
        </div>
      )}

      <h2 className="section-title mt-8 text-charcoal">Money received</h2>
      <p className="mb-3 body-text text-muted">Each row is one payment already taken.</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="How they paid">
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
        </Field>
        <Field label="From">
          <Input type="date" className="min-w-0" value={from} onChange={(event) => { setPage(1); setFrom(event.target.value); }} />
        </Field>
        <Field label="To">
          <Input type="date" className="min-w-0" value={to} onChange={(event) => { setPage(1); setTo(event.target.value); }} />
        </Field>
      </div>
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="No payments in this view" description="Change the dates or record a payment on a job above." />
      ) : (
        <Card>
          <div className="p-3 md:p-0">
            <ResponsiveRecords
              cards={items.map((payment) => {
                const job = jobMap[payment.job_id];
                const customer = job ? nameById(customers, job.customer_id) : "Payment";
                return (
                  <RecordCard
                    key={payment.id}
                    href={job ? `/jobs/${job.id}` : "/payments"}
                    title={customer}
                    subtitle={formatInr(payment.amount)}
                    extra={<span className="meta-text">{methodLabel(payment.payment_method)}</span>}
                    meta={
                      <>
                        <span>{formatDateTime(payment.paid_at)}</span>
                        {job ? <span>{job.job_number}</span> : null}
                        {payment.reference_number ? <span>{payment.reference_number}</span> : null}
                      </>
                    }
                  />
                );
              })}
              table={
                <table className="table-grid">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>When</th>
                      <th>How paid</th>
                      <th>Job</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((payment) => {
                      const job = jobMap[payment.job_id];
                      return (
                        <tr key={payment.id}>
                          <td>{job ? nameById(customers, job.customer_id) : "—"}</td>
                          <td>
                            {formatDateTime(payment.paid_at)}
                            {payment.reference_number ? (
                              <span className="mt-0.5 block meta-text">{payment.reference_number}</span>
                            ) : null}
                          </td>
                          <td>{methodLabel(payment.payment_method)}</td>
                          <td>
                            {job ? (
                              <Link className="hover:underline" href={`/jobs/${job.id}`}>
                                {job.job_number}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="money">{formatInr(payment.amount)}</td>
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

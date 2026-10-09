"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { categoriesApi, customersApi, jobsApi, usersApi } from "@/lib/api/endpoints";
import { formatDate, formatDateTime } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { specText } from "@/lib/jobs";
import { formatInr } from "@/lib/money";
import { canRecordPayment } from "@/lib/lifecycle";
import type {
  AttributionOption,
  Customer,
  Job,
  JobBalance,
  JobHistory,
  Payment,
  PrintCategory,
  WorkflowStage,
} from "@/types/api";
import { Button, Card, ErrorBanner, PageHeader, Spinner } from "@/components/ui";
import { LeadBadge, PaymentBadge } from "@/components/StatusBadge";
import { JobForm } from "@/features/jobs/JobForm";
import { JobActions, PaymentModal } from "@/features/jobs/JobActions";
import { useToast } from "@/components/Toast";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="meta-text">{label}</dt>
      <dd className="mt-0.5 body-text font-medium text-charcoal">{children}</dd>
    </div>
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [category, setCategory] = useState<PrintCategory | null>(null);
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [history, setHistory] = useState<JobHistory[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState<JobBalance | null>(null);
  const [users, setUsers] = useState<AttributionOption[]>([]);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState("");
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const detail = await jobsApi.get(id);
    const [cust, cat, stageList, hist, pay, attr] = await Promise.all([
      customersApi.get(detail.customer_id),
      categoriesApi.get(detail.category_id),
      categoriesApi.stages(detail.category_id),
      jobsApi.history(id),
      jobsApi.payments(id).catch(() => null),
      usersApi.attribution(),
    ]);
    setJob(detail);
    setCustomer(cust);
    setCategory(cat);
    setStages(stageList);
    setHistory(hist);
    setUsers(attr);
    if (pay) {
      setPayments(pay.items);
      setBalance({
        job_id: pay.job_id,
        amount_due: pay.amount_due,
        total_paid: pay.total_paid,
        balance: pay.balance,
        payment_status: pay.payment_status,
      });
    } else {
      setPayments([]);
      setBalance(null);
    }
  }, [id]);

  useEffect(() => {
    void load().catch((err) => setError(errorMessage(err)));
  }, [load]);

  if (error && !job) return <ErrorBanner message={error} />;
  if (!job) return <Spinner />;

  const stageName = (stageId: string | null) =>
    stages.find((stage) => stage.id === stageId)?.name ?? (stageId ? "Unknown stage" : "—");
  const userName = (userId: string) =>
    users.find((user) => user.id === userId)?.display_name ?? userId;
  const specs = specText(job.specifications);
  const hasDetails = Boolean(job.description || specs || job.notes);

  return (
    <div>
      <PageHeader
        title={job.job_number}
        description={job.title || category?.name}
        breadcrumb={
          <>
            <Link href="/jobs" className="hover:underline">
              Jobs
            </Link>
            {" / "}
            {job.job_number}
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit job
            </Button>
            {canRecordPayment(job.lead_status) ? (
              <Button onClick={() => setPaying(true)}>Record payment</Button>
            ) : null}
          </>
        }
      />
      {conflict ? (
        <div className="mb-4">
          <ErrorBanner message={conflict} />
          <Button className="mt-2" variant="secondary" onClick={() => void load().then(() => setConflict(""))}>
            Refresh job
          </Button>
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}

      <div className="mb-5">
        <JobActions
          job={job}
          stages={stages}
          onUpdated={(updated, hadConflict) => {
            if (hadConflict) {
              setConflict("This job changed since it was loaded. Refresh and try again.");
              return;
            }
            toast("Job updated");
            setJob(updated);
            void load();
          }}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <h2 className="section-title mb-4 text-charcoal">Overview</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Detail label="Customer">
              <Link className="hover:underline" href={`/customers/${job.customer_id}`}>
                {customer?.name}
              </Link>
              {customer?.phone ? <div className="font-normal text-muted">{customer.phone}</div> : null}
            </Detail>
            <Detail label="Print category">{category?.name}</Detail>
            <Detail label="Lifecycle">
              <LeadBadge status={job.lead_status} />
            </Detail>
            <Detail label="Quantity">{job.quantity}</Detail>
            <Detail label="Quoted">
              <span className="money">{formatInr(job.quoted_amount)}</span>
            </Detail>
            <Detail label="Final amount">
              <span className="money">{formatInr(job.final_amount)}</span>
            </Detail>
            <Detail label="Due date">{formatDate(job.due_date)}</Detail>
            <Detail label="Follow-up">{formatDateTime(job.next_follow_up_at)}</Detail>
          </dl>
          {hasDetails ? (
            <div className="mt-5 space-y-3 border-t border-line pt-4">
              {job.description ? (
                <div>
                  <h3 className="label-text text-muted">Description</h3>
                  <p className="mt-1 whitespace-pre-wrap body-text">{job.description}</p>
                </div>
              ) : null}
              {specs ? (
                <div>
                  <h3 className="label-text text-muted">Specifications</h3>
                  <p className="mt-1 whitespace-pre-wrap body-text">{specs}</p>
                </div>
              ) : null}
              {job.notes ? (
                <div>
                  <h3 className="label-text text-muted">Notes</h3>
                  <p className="mt-1 whitespace-pre-wrap body-text">{job.notes}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="section-title text-charcoal">Payments</h2>
            {balance ? <PaymentBadge status={balance.payment_status} /> : null}
          </div>
          {balance ? (
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between body-text">
                <dt className="text-muted">Amount due</dt>
                <dd className="money">{formatInr(balance.amount_due)}</dd>
              </div>
              <div className="flex justify-between body-text">
                <dt className="text-muted">Paid</dt>
                <dd className="money">{formatInr(balance.total_paid)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <dt className="label-text">Outstanding</dt>
                <dd className="money text-lg font-semibold">{formatInr(balance.balance)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 body-text text-muted">Payment balances are available after the job is confirmed.</p>
          )}
          {canRecordPayment(job.lead_status) && balance?.payment_status !== "PAID" ? (
            <Button className="mt-4 w-full" onClick={() => setPaying(true)}>
              Record payment
            </Button>
          ) : null}
          {payments.length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-line pt-3">
              {payments.map((payment) => (
                <li key={payment.id} className="flex justify-between gap-3 body-text">
                  <span className="min-w-0">
                    <span className="block">{payment.payment_method}</span>
                    <span className="meta-text">
                      {formatDateTime(payment.paid_at)}
                      {payment.reference_number ? ` · ${payment.reference_number}` : ""}
                    </span>
                  </span>
                  <span className="money shrink-0 font-medium">{formatInr(payment.amount)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      <Card className="mt-4 p-4 sm:p-5">
        <h2 className="section-title text-charcoal">Production</h2>
        <p className="mt-2 body-text">
          Current stage: <strong>{stageName(job.current_stage_id)}</strong>
        </p>
        <p className="mt-1 meta-text">
          Workflow: {stages.filter((stage) => stage.is_active).map((stage) => stage.name).join(" → ") || "None configured"}
        </p>
        <ol className="mt-4 space-y-3">
          {history.map((entry) => (
            <li key={entry.id} className="border-l-2 border-amber pl-3">
              <div className="body-text font-medium">
                {entry.from_stage_id ? stageName(entry.from_stage_id) : "—"} → {stageName(entry.to_stage_id)}
              </div>
              <div className="meta-text">
                {formatDateTime(entry.created_at)} · {userName(entry.updated_by_user_id)}
              </div>
              {entry.notes ? <p className="mt-0.5 body-text text-muted">{entry.notes}</p> : null}
            </li>
          ))}
          {history.length === 0 ? <li className="body-text text-muted">No production history yet.</li> : null}
        </ol>
      </Card>

      {editing && category ? (
        <JobForm
          job={job}
          categories={[category]}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false);
            setJob(updated);
            toast("Job saved");
          }}
        />
      ) : null}
      {paying && balance ? (
        <PaymentModal
          jobId={job.id}
          amountDue={balance.amount_due}
          totalPaid={balance.total_paid}
          balance={balance.balance}
          onClose={() => setPaying(false)}
          onSaved={() => {
            setPaying(false);
            toast("Payment recorded");
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

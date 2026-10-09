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

  return (
    <div>
      <PageHeader
        title={job.job_number}
        description={job.title}
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
      <p className="mb-4 text-sm text-muted">
        <Link href="/jobs" className="hover:underline">
          Jobs
        </Link>
        {" / "}
        {job.job_number}
      </p>
      {conflict ? (
        <div className="mb-4">
          <ErrorBanner message={conflict} />
          <Button className="mt-2" variant="secondary" onClick={() => void load().then(() => setConflict(""))}>
            Refresh job
          </Button>
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}

      <div className="mb-4">
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 font-medium">Overview</h2>
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-muted">Customer</dt>
              <dd>
                <Link className="hover:underline" href={`/customers/${job.customer_id}`}>
                  {customer?.name}
                </Link>
                <div className="text-muted">{customer?.phone}</div>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Print category</dt>
              <dd>{category?.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Lifecycle</dt>
              <dd>
                <LeadBadge status={job.lead_status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted">Quantity</dt>
              <dd>{job.quantity}</dd>
            </div>
            <div>
              <dt className="text-muted">Quoted</dt>
              <dd>{formatInr(job.quoted_amount)}</dd>
            </div>
            <div>
              <dt className="text-muted">Final amount</dt>
              <dd>{formatInr(job.final_amount)}</dd>
            </div>
            <div>
              <dt className="text-muted">Due date</dt>
              <dd>{formatDate(job.due_date)}</dd>
            </div>
            <div>
              <dt className="text-muted">Follow-up</dt>
              <dd>{formatDateTime(job.next_follow_up_at)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">Description</dt>
              <dd className="whitespace-pre-wrap">{job.description}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">Specifications</dt>
              <dd className="whitespace-pre-wrap">{specText(job.specifications) || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">Notes</dt>
              <dd className="whitespace-pre-wrap">{job.notes || "—"}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Payments</h2>
          {balance ? (
            <>
              <p className="text-sm">Due {formatInr(balance.amount_due)}</p>
              <p className="text-sm">Paid {formatInr(balance.total_paid)}</p>
              <p className="text-lg font-semibold">Outstanding {formatInr(balance.balance)}</p>
              <div className="mt-2">
                <PaymentBadge status={balance.payment_status} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">
              Payment balances are available after the job is confirmed.
            </p>
          )}
          <ul className="mt-4 space-y-2 text-sm">
            {payments.map((payment) => (
              <li key={payment.id} className="flex justify-between gap-2 border-b border-line pb-2">
                <span>
                  {formatDateTime(payment.paid_at)} · {payment.payment_method}
                  {payment.reference_number ? ` · ${payment.reference_number}` : ""}
                </span>
                <span>{formatInr(payment.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <h2 className="mb-3 font-medium">Production</h2>
        <p className="text-sm">
          Current stage: <strong>{stageName(job.current_stage_id)}</strong>
        </p>
        <p className="mt-1 text-xs text-muted">
          Workflow: {stages.filter((stage) => stage.is_active).map((stage) => stage.name).join(" → ") || "None configured"}
        </p>
        <ol className="mt-4 space-y-2 text-sm">
          {history.map((entry) => (
            <li key={entry.id} className="border-l-2 border-amber pl-3">
              <div>
                {entry.from_stage_id ? stageName(entry.from_stage_id) : "—"} → {stageName(entry.to_stage_id)}
              </div>
              <div className="text-xs text-muted">
                {formatDateTime(entry.created_at)} · {userName(entry.updated_by_user_id)}
                {entry.notes ? ` · ${entry.notes}` : ""}
              </div>
            </li>
          ))}
          {history.length === 0 ? <li className="text-muted">No production history yet.</li> : null}
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

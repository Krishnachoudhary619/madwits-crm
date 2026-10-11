"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  PackageCheck,
  Truck,
} from "lucide-react";
import { dashboardApi, jobsApi } from "@/lib/api/endpoints";
import { formatDate, formatDateTime, monthStartIsoDate, todayIsoDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { listAllJobs } from "@/lib/jobs";
import { formatInr } from "@/lib/money";
import { OPEN_ENQUIRY_STATUSES } from "@/lib/lifecycle";
import type { DashboardSummary, Job, JobBalance, JobsByStageItem, PaymentsSummary, WorkflowStage } from "@/types/api";
import { buttonClass, Button, Card, ErrorBanner, Input, Spinner } from "@/components/ui";
import { LeadBadge, PaymentBadge } from "@/components/StatusBadge";
import { useCatalogs, nameById } from "@/hooks/useCatalogs";
import { useToast } from "@/components/Toast";
import { CompleteProductionModal } from "@/features/dashboard/CompleteProductionModal";
import { FollowUpModal } from "@/features/dashboard/FollowUpModal";
import {
  buildPlannerTasks,
  canMarkProductionComplete,
  completionEnteredAt,
  greetingForHour,
  isDeliveryStageName,
  isDueOn,
  isFollowUpOn,
  isFollowUpOverdueOn,
  isOverdueOn,
  moneyGreaterThanZero,
  shopDay,
  shopHourNow,
  type PlannerTask,
} from "@/features/dashboard/classify";

const labelClass = {
  danger: "bg-rose-50 text-rose-900 ring-rose-200",
  warning: "bg-amber-50 text-amber-950 ring-amber-200",
  success: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  neutral: "bg-slate-100 text-slate-800 ring-slate-300",
};

function TaskLabel({ text, tone }: { text: string; tone: keyof typeof labelClass }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ring-1 ring-inset ${labelClass[tone]}`}>
      {text}
    </span>
  );
}

function JobLine({
  job,
  customer,
  extra,
  href,
}: {
  job: Job;
  customer: string;
  extra?: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="font-medium text-charcoal">{job.job_number}</span>
      <span className="text-muted"> · {customer}</span>
      {extra ? <span className="block meta-text">{extra}</span> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="min-w-0 hover:underline">
        {content}
      </Link>
    );
  }
  return <div className="min-w-0">{content}</div>;
}

export default function DashboardPage() {
  const toast = useToast();
  const { customers, categories, stagesByCategory } = useCatalogs();
  const today = todayIsoDate();
  const [from, setFrom] = useState(monthStartIsoDate());
  const [to, setTo] = useState(today);
  const [todaySummary, setTodaySummary] = useState<DashboardSummary | null>(null);
  const [periodSummary, setPeriodSummary] = useState<DashboardSummary | null>(null);
  const [payments, setPayments] = useState<PaymentsSummary | null>(null);
  const [byStage, setByStage] = useState<JobsByStageItem[]>([]);
  const [openJobs, setOpenJobs] = useState<Job[]>([]);
  const [confirmedJobs, setConfirmedJobs] = useState<Job[]>([]);
  const [completedAt, setCompletedAt] = useState<Record<string, string | null>>({});
  const [balances, setBalances] = useState<Record<string, JobBalance | null>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [completeJob, setCompleteJob] = useState<{ job: Job; finalStage: WorkflowStage } | null>(null);
  const [followJob, setFollowJob] = useState<Job | null>(null);

  const stageById = useMemo(() => {
    const map = new Map<string, WorkflowStage>();
    for (const stages of Object.values(stagesByCategory)) {
      for (const stage of stages) map.set(stage.id, stage);
    }
    return map;
  }, [stagesByCategory]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [todaySum, periodSum, pay, stages, open, confirmed] = await Promise.all([
          dashboardApi.summary(today, today),
          dashboardApi.summary(from, to),
          dashboardApi.paymentsSummary(from, to),
          dashboardApi.jobsByStage(),
          listAllJobs({ lead_status: OPEN_ENQUIRY_STATUSES, sort: "created_at", order: "desc" }),
          listAllJobs({ lead_status: ["CONFIRMED", "COMPLETED"], sort: "due_date", order: "asc" }),
        ]);
        if (cancelled) return;
        setTodaySummary(todaySum);
        setPeriodSummary(periodSum);
        setPayments(pay);
        setByStage(stages.items);
        setOpenJobs(open);
        setConfirmedJobs(confirmed);

        const finalJobs = confirmed.filter((job) => {
          const stage = job.current_stage_id
            ? Object.values(stagesByCategory)
                .flat()
                .find((item) => item.id === job.current_stage_id)
            : undefined;
          return Boolean(stage?.is_final);
        });
        if (finalJobs.length) {
          const [histories, pays] = await Promise.all([
            Promise.all(finalJobs.map((job) => jobsApi.history(job.id).catch(() => []))),
            Promise.all(finalJobs.map((job) => jobsApi.balance(job.id).catch(() => null))),
          ]);
          if (cancelled) return;
          const nextCompleted: Record<string, string | null> = {};
          const nextBalances: Record<string, JobBalance | null> = {};
          finalJobs.forEach((job, index) => {
            nextCompleted[job.id] = job.current_stage_id
              ? completionEnteredAt(histories[index], job.current_stage_id)
              : null;
            nextBalances[job.id] = pays[index];
          });
          setCompletedAt(nextCompleted);
          setBalances(nextBalances);
        } else {
          setCompletedAt({});
          setBalances({});
        }
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
  }, [from, to, today, stagesByCategory]);

  const allActive = useMemo(() => [...openJobs, ...confirmedJobs], [openJobs, confirmedJobs]);

  const tasks = useMemo(
    () =>
      buildPlannerTasks({
        jobs: allActive,
        today,
        stageById,
        stagesByCategory,
      }),
    [allActive, today, stageById, stagesByCategory],
  );

  const unfinished = confirmedJobs.filter((job) => !stageById.get(job.current_stage_id ?? "")?.is_final);
  const wipStages = byStage.filter(
    (item) =>
      item.job_count > 0 &&
      !isDeliveryStageName(item.stage_name) &&
      !stageById.get(item.stage_id)?.is_final,
  );
  const dueTodayJobs = unfinished.filter((job) => isDueOn(job, today));
  const overdueJobs = unfinished.filter((job) => isOverdueOn(job, today));
  const readyJobs = confirmedJobs.filter((job) => {
    const stage = stageById.get(job.current_stage_id ?? "");
    return Boolean(stage && isDeliveryStageName(stage.name));
  });
  const completedTodayJobs = confirmedJobs.filter((job) => {
    const at = completedAt[job.id];
    return Boolean(at && shopDay(at) === today);
  });
  const recentCompleted = confirmedJobs
    .filter((job) => {
      const at = completedAt[job.id];
      return Boolean(at && shopDay(at) && shopDay(at) !== today);
    })
    .sort((a, b) => (completedAt[b.id] ?? "").localeCompare(completedAt[a.id] ?? ""))
    .slice(0, 6);
  const unpaidCompleted = confirmedJobs.filter((job) => {
    const stage = stageById.get(job.current_stage_id ?? "");
    return Boolean(stage?.is_final && moneyGreaterThanZero(balances[job.id]?.balance));
  });
  const newEnquiries = openJobs.filter((job) => job.lead_status === "NEW_INQUIRY");
  const quotesToPrepare = openJobs.filter((job) => job.lead_status === "QUOTATION_PREPARED");
  const waiting = openJobs.filter((job) => job.lead_status === "AWAITING_CONFIRMATION");
  const followUps = allActive.filter(
    (job) => isFollowUpOn(job, today) || isFollowUpOverdueOn(job, today),
  );
  const attentionCount = new Set(
    [
      ...overdueJobs,
      ...dueTodayJobs,
      ...followUps,
      ...newEnquiries,
      ...quotesToPrepare,
      ...waiting,
      ...readyJobs,
    ].map((job) => job.id),
  ).size;

  function runTaskAction(task: PlannerTask) {
    if (task.action === "followup") {
      setFollowJob(task.job);
      return;
    }
    if (task.action === "complete") {
      const finalStage = canMarkProductionComplete(task.job, stagesByCategory[task.job.category_id] ?? []);
      if (finalStage) setCompleteJob({ job: task.job, finalStage });
      return;
    }
    window.location.href = `/jobs/${task.job.id}`;
  }

  function replaceJob(updated: Job) {
    setOpenJobs((current) => current.map((job) => (job.id === updated.id ? updated : job)));
    setConfirmedJobs((current) => current.map((job) => (job.id === updated.id ? updated : job)));
  }

  const todayLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return (
    <div>
      <div className="mb-5">
        <p className="meta-text">{todayLabel}</p>
        <h1 className="page-title mt-1 text-charcoal">
          {greetingForHour(shopHourNow())}! Here&apos;s what needs your attention today.
        </h1>
        <p className="mt-1 max-w-2xl body-text text-muted">
          Start with overdue and due work, then quotations and follow-ups. Production complete means the job reached
          its category&apos;s final stage — not that it was delivered.
        </p>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {loading || !todaySummary || !periodSummary ? (
        <Spinner label="Loading today's work" />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              href="#today-tasks"
              icon={AlertTriangle}
              title="Needs attention"
              value={attentionCount}
              explanation="Jobs and enquiries that need a next step."
              empty="Nothing urgent right now."
            />
            <SummaryCard
              href="#delivery-today"
              icon={CalendarClock}
              title="Due today"
              value={dueTodayJobs.length}
              explanation="Unfinished confirmed jobs due today."
              empty="No unfinished jobs due today."
            />
            <SummaryCard
              href="#ready-for-delivery"
              icon={Truck}
              title="Ready for delivery"
              value={readyJobs.length}
              explanation="Jobs on a delivery or pickup stage."
              empty="No delivery-named stages have jobs."
            />
            <SummaryCard
              href="#completed-work"
              icon={CheckCircle2}
              title="Completed today"
              value={todaySummary.completed_in_period}
              explanation="Reached the final production stage today."
              empty="No jobs completed production today."
            />
          </section>

          <section id="today-tasks" className="mt-8">
            <h2 className="section-title text-charcoal">Today&apos;s tasks</h2>
            <p className="mb-3 meta-text">One row per job. The most urgent work is listed first.</p>
            {tasks.length === 0 ? (
              <Card className="p-5 body-text text-muted">No open tasks for today. New enquiries will appear here.</Card>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 20).map((task) => (
                  <Card key={task.job.id} className="p-3.5 sm:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-1.5">
                          {task.labels.map((label) => (
                            <TaskLabel key={label.text} text={label.text} tone={label.tone} />
                          ))}
                        </div>
                        <p className="mt-2 font-medium text-charcoal">{task.title}</p>
                        <p className="body-text text-muted">{task.reason}</p>
                        <p className="mt-1 body-text">
                          <Link href={`/jobs/${task.job.id}`} className="font-medium hover:underline">
                            {task.job.job_number}
                          </Link>
                          {" · "}
                          {nameById(customers, task.job.customer_id)}
                          {task.job.due_date ? ` · Due ${formatDate(task.job.due_date)}` : ""}
                          {task.job.next_follow_up_at ? ` · Follow-up ${formatDateTime(task.job.next_follow_up_at)}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => runTaskAction(task)}>
                          {task.actionLabel}
                        </Button>
                        {task.action !== "open" ? (
                          <Link href={`/jobs/${task.job.id}`} className={buttonClass("ghost")}>
                            Open job
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="section-title text-charcoal">Enquiries & customer follow-ups</h2>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <ListCard
                title="New enquiries"
                empty="No new enquiries waiting for a quotation."
                items={newEnquiries}
                render={(job) => (
                  <div className="flex items-start justify-between gap-3">
                    <JobLine
                      job={job}
                      customer={nameById(customers, job.customer_id)}
                      extra={`${nameById(categories, job.category_id)} · ${formatDate(job.created_at)}${job.description ? ` · ${job.description}` : ""}`}
                      href={`/jobs/${job.id}`}
                    />
                    <Link href={`/jobs/${job.id}`} className={`${buttonClass("secondary")} shrink-0`}>
                      Review enquiry
                    </Link>
                  </div>
                )}
              />
              <ListCard
                title="Quotations to prepare"
                empty="No drafted quotations waiting to be sent or revised."
                items={quotesToPrepare}
                render={(job) => (
                  <div className="flex items-start justify-between gap-3">
                    <JobLine
                      job={job}
                      customer={nameById(customers, job.customer_id)}
                      extra={`Quoted ${formatInr(job.quoted_amount)}`}
                      href={`/jobs/${job.id}`}
                    />
                    <Link href={`/jobs/${job.id}`} className={`${buttonClass()} shrink-0`}>
                      Prepare quotation
                    </Link>
                  </div>
                )}
              />
              <ListCard
                title="Waiting for customer"
                empty="No quotations are waiting for a customer decision."
                items={waiting}
                render={(job) => (
                  <div className="flex items-start justify-between gap-3">
                    <JobLine
                      job={job}
                      customer={nameById(customers, job.customer_id)}
                      extra={`${formatInr(job.quoted_amount)}${job.next_follow_up_at ? ` · Follow-up ${formatDateTime(job.next_follow_up_at)}` : ""}`}
                      href={`/jobs/${job.id}`}
                    />
                    <Link href={`/jobs/${job.id}`} className={`${buttonClass("secondary")} shrink-0`}>
                      Open job
                    </Link>
                  </div>
                )}
              />
              <ListCard
                title="Follow-ups due"
                empty="No stored follow-up dates are due or overdue."
                items={followUps}
                render={(job) => (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <JobLine
                        job={job}
                        customer={nameById(customers, job.customer_id)}
                        extra={`${isFollowUpOverdueOn(job, today) ? "Overdue" : "Due today"} · ${formatDateTime(job.next_follow_up_at)}`}
                        href={`/jobs/${job.id}`}
                      />
                      <div className="mt-1">
                        <LeadBadge status={job.lead_status} />
                      </div>
                    </div>
                    <Button variant="secondary" onClick={() => setFollowJob(job)}>
                      Record follow-up
                    </Button>
                  </div>
                )}
              />
            </div>
            <Card className="mt-4 p-4 sm:p-5">
              <h3 className="card-title text-charcoal">Enquiries converted into orders</h3>
              <p className="mt-1 body-text text-muted">
                Of {periodSummary.jobs_created_in_period} enquiries created in this period,{" "}
                {periodSummary.confirmed_created_in_period} became confirmed orders. This uses the
                dashboard API, not a page of jobs.
              </p>
            </Card>
          </section>

          <section className="mt-8">
            <h2 className="section-title text-charcoal">Production and delivery</h2>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <Card className="p-4 sm:p-5">
                <h3 className="card-title text-charcoal">Work in progress</h3>
                <p className="mb-3 meta-text">Confirmed jobs grouped by each category&apos;s configured stages.</p>
                {wipStages.length === 0 ? (
                  <p className="body-text text-muted">No unfinished confirmed jobs are in a production stage.</p>
                ) : (
                  <ul className="space-y-3">
                    {wipStages.map((item) => {
                      const stageJobs = unfinished.filter((job) => job.current_stage_id === item.stage_id);
                      const due = stageJobs.filter((job) => isDueOn(job, today)).length;
                      const overdue = stageJobs.filter((job) => isOverdueOn(job, today)).length;
                      return (
                        <li key={item.stage_id} className="flex items-start justify-between gap-3 body-text">
                          <div>
                            <p className="font-medium">
                              {item.stage_name}
                              <span className="font-normal text-muted"> · {item.category_name}</span>
                            </p>
                            <p className="meta-text">
                              {item.job_count} job{item.job_count === 1 ? "" : "s"}
                              {due ? ` · ${due} due today` : ""}
                              {overdue ? ` · ${overdue} overdue` : ""}
                            </p>
                          </div>
                          <Link
                            href={`/jobs?lead_status=CONFIRMED&current_stage_id=${item.stage_id}`}
                            className={`${buttonClass("secondary")} shrink-0`}
                          >
                            View jobs
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
              <div className="space-y-4">
                <ListCard
                  id="ready-for-delivery"
                  title="Ready for delivery"
                  empty="No jobs are on a stage named for delivery, pickup, or dispatch. Final stages are treated as production-complete, not delivered."
                  items={readyJobs}
                  render={(job) => (
                    <JobLine
                      job={job}
                      customer={nameById(customers, job.customer_id)}
                      extra={stageById.get(job.current_stage_id ?? "")?.name}
                      href={`/jobs/${job.id}`}
                    />
                  )}
                />
                <ListCard
                  title="Overdue jobs"
                  empty="No unfinished confirmed jobs are past their due date."
                  items={overdueJobs}
                  render={(job) => (
                    <JobLine
                      job={job}
                      customer={nameById(customers, job.customer_id)}
                      extra={`Due ${formatDate(job.due_date)} · ${stageById.get(job.current_stage_id ?? "")?.name ?? "No stage"}`}
                      href={`/jobs/${job.id}`}
                    />
                  )}
                />
                <ListCard
                  id="delivery-today"
                  title="Delivery today"
                  empty="No unfinished jobs are due today."
                  items={dueTodayJobs}
                  render={(job) => (
                    <JobLine
                      job={job}
                      customer={nameById(customers, job.customer_id)}
                      extra={stageById.get(job.current_stage_id ?? "")?.name ?? "No stage"}
                      href={`/jobs/${job.id}`}
                    />
                  )}
                />
              </div>
            </div>
          </section>

          <section id="completed-work" className="mt-8">
            <h2 className="section-title text-charcoal">Completed work</h2>
            <p className="mb-3 meta-text">
              Completed orders are jobs whose order status is Completed, or confirmed jobs already on the final
              production stage. Completion time comes from status history, not the job&apos;s created date.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              <ListCard
                title="Completed today"
                empty="No jobs reached a final stage today."
                items={completedTodayJobs}
                render={(job) => (
                  <JobLine
                    job={job}
                    customer={nameById(customers, job.customer_id)}
                    extra={completedAt[job.id] ? formatDateTime(completedAt[job.id]) : undefined}
                    href={`/jobs/${job.id}`}
                  />
                )}
              />
              <ListCard
                title="Recently completed"
                empty="No earlier completed jobs to show."
                items={recentCompleted}
                render={(job) => (
                  <JobLine
                    job={job}
                    customer={nameById(customers, job.customer_id)}
                    extra={completedAt[job.id] ? formatDateTime(completedAt[job.id]) : undefined}
                    href={`/jobs/${job.id}`}
                  />
                )}
              />
              <ListCard
                title="Completed but unpaid"
                empty="No completed jobs have an outstanding balance."
                items={unpaidCompleted}
                render={(job) => (
                  <div>
                    <JobLine
                      job={job}
                      customer={nameById(customers, job.customer_id)}
                      extra={`Due ${formatInr(balances[job.id]?.amount_due)} · Paid ${formatInr(balances[job.id]?.total_paid)} · Balance ${formatInr(balances[job.id]?.balance)}`}
                      href={`/jobs/${job.id}`}
                    />
                    {balances[job.id] ? (
                      <div className="mt-1">
                        <PaymentBadge status={balances[job.id]!.payment_status} />
                      </div>
                    ) : null}
                  </div>
                )}
              />
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="section-title text-charcoal">Payments and business summary</h2>
                <p className="meta-text">
                  Period {periodSummary.period.from_date} to {periodSummary.period.to_date} ({periodSummary.period.timezone})
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Input type="date" aria-label="From date" value={from} onChange={(event) => setFrom(event.target.value)} />
                <Input type="date" aria-label="To date" value={to} onChange={(event) => setTo(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card className="p-4">
                <p className="label-text text-muted">Money received</p>
                <p className="money mt-2 text-xl font-semibold">{formatInr(payments?.total_received)}</p>
                <p className="meta-text">{payments?.payment_count ?? 0} payment records</p>
              </Card>
              <Card className="p-4">
                <p className="label-text text-muted">Customers still owe</p>
                <p className="money mt-2 text-xl font-semibold">{formatInr(periodSummary.outstanding_balance)}</p>
                <p className="meta-text">Confirmed jobs with a remaining balance.</p>
              </Card>
              <Card className="p-4">
                <p className="label-text text-muted">Completed but unpaid</p>
                <p className="money mt-2 text-xl font-semibold">{unpaidCompleted.length}</p>
                <p className="meta-text">Final-stage jobs that still have a balance.</p>
              </Card>
              <Card className="p-4">
                <p className="label-text text-muted">Quotation pipeline</p>
                <p className="money mt-2 text-xl font-semibold">{formatInr(periodSummary.open_quotation_pipeline_value)}</p>
                <p className="meta-text">Quoted value still waiting for confirmation.</p>
              </Card>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/enquiries" className={buttonClass()}>
                New enquiry
              </Link>
              <Link href="/customers" className={buttonClass("secondary")}>
                New customer
              </Link>
              <Link href="/payments" className={buttonClass("secondary")}>
                <Banknote size={16} /> Payments
              </Link>
              <Link href="/production" className={buttonClass("secondary")}>
                <PackageCheck size={16} /> Production board
              </Link>
            </div>
          </section>
        </>
      )}

      {completeJob ? (
        <CompleteProductionModal
          job={completeJob.job}
          finalStage={completeJob.finalStage}
          onClose={() => setCompleteJob(null)}
          onSaved={(updated) => {
            replaceJob(updated);
            setCompleteJob(null);
            toast("Production marked complete");
            void jobsApi.history(updated.id).then((history) => {
              setCompletedAt((current) => ({
                ...current,
                [updated.id]: updated.current_stage_id
                  ? completionEnteredAt(history, updated.current_stage_id)
                  : null,
              }));
            });
          }}
        />
      ) : null}
      {followJob ? (
        <FollowUpModal
          job={followJob}
          onClose={() => setFollowJob(null)}
          onSaved={(updated) => {
            replaceJob(updated);
            setFollowJob(null);
            toast("Follow-up date saved");
          }}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  href,
  icon: Icon,
  title,
  value,
  explanation,
  empty,
}: {
  href: string;
  icon: typeof AlertTriangle;
  title: string;
  value: number;
  explanation: string;
  empty: string;
}) {
  const inner = (
    <Card className="h-full p-3.5 transition-colors hover:border-charcoal/25 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="label-text text-muted">{title}</p>
        <Icon size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
      </div>
      <p className="money mt-2 text-2xl font-semibold text-charcoal">{value}</p>
      <p className="mt-1 meta-text">{value === 0 ? empty : explanation}</p>
    </Card>
  );
  if (href.startsWith("#")) {
    return (
      <a href={href} className="min-w-0">
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className="min-w-0">
      {inner}
    </Link>
  );
}

function ListCard<T extends { id: string }>({
  id,
  title,
  empty,
  items,
  render,
}: {
  id?: string;
  title: string;
  empty: string;
  items: T[];
  render: (item: T) => ReactNode;
}) {
  return (
    <div id={id}>
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="card-title text-charcoal">{title}</h3>
        <span className="meta-text">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="body-text text-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="body-text">
              {render(item)}
            </li>
          ))}
        </ul>
      )}
    </Card>
    </div>
  );
}

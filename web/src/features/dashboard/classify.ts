import type { Job, JobHistory, WorkflowStage } from "@/types/api";

const DELIVERY_STAGE = /\b(deliver(?:y|ed)?|pickup|pick-?up|dispatch|ready to collect|collection)\b/i;

export function shopDay(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isDeliveryStageName(name: string): boolean {
  return DELIVERY_STAGE.test(name);
}

export function isDueOn(job: Job, day: string): boolean {
  const due = shopDay(job.due_date);
  return Boolean(due && due === day);
}

export function isOverdueOn(job: Job, day: string): boolean {
  const due = shopDay(job.due_date);
  return Boolean(due && due < day);
}

export function isFollowUpOn(job: Job, day: string): boolean {
  const follow = shopDay(job.next_follow_up_at);
  return Boolean(follow && follow === day);
}

export function isFollowUpOverdueOn(job: Job, day: string): boolean {
  const follow = shopDay(job.next_follow_up_at);
  return Boolean(follow && follow < day);
}

export function moneyGreaterThanZero(value: string | null | undefined): boolean {
  if (!value || !/^\d+(\.\d+)?$/.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  return whole !== "0" || (fraction + "00").slice(0, 2) !== "00";
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function shopHourNow(): number {
  const raw = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return Number.parseInt(raw, 10);
}

export function completionEnteredAt(history: JobHistory[], finalStageId: string): string | null {
  const ontoFinal = history
    .filter((entry) => entry.to_stage_id === finalStageId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return ontoFinal.at(-1)?.created_at ?? null;
}

export function canMarkProductionComplete(
  job: Job,
  stages: WorkflowStage[],
): WorkflowStage | null {
  if (job.lead_status !== "CONFIRMED" || !job.current_stage_id) return null;
  const finalStage = stages.find((stage) => stage.is_active && stage.is_final) ?? null;
  if (!finalStage || job.current_stage_id === finalStage.id) return null;
  return finalStage;
}

export type TaskLabel = { text: string; tone: "danger" | "warning" | "success" | "neutral" };

export type PlannerTask = {
  job: Job;
  priority: number;
  labels: TaskLabel[];
  title: string;
  reason: string;
  actionLabel: string;
  action: "open" | "quote" | "followup" | "complete";
};

export function buildPlannerTasks(input: {
  jobs: Job[];
  today: string;
  stageById: Map<string, WorkflowStage>;
  stagesByCategory: Record<string, WorkflowStage[]>;
}): PlannerTask[] {
  const merged = new Map<string, PlannerTask>();

  function add(task: PlannerTask) {
    const existing = merged.get(task.job.id);
    if (!existing) {
      merged.set(task.job.id, task);
      return;
    }
    if (task.priority < existing.priority) {
      existing.priority = task.priority;
      existing.title = task.title;
      existing.reason = task.reason;
      existing.action = task.action;
      existing.actionLabel = task.actionLabel;
    }
    for (const label of task.labels) {
      if (!existing.labels.some((item) => item.text === label.text)) {
        existing.labels.push(label);
      }
    }
  }

  for (const job of input.jobs) {
    if (job.lead_status === "LOST" || job.lead_status === "CANCELLED") continue;
    const stage = job.current_stage_id ? input.stageById.get(job.current_stage_id) : undefined;
    const stages = input.stagesByCategory[job.category_id] ?? [];
    const onFinal = Boolean(stage?.is_final);
    const unfinishedConfirmed = job.lead_status === "CONFIRMED" && !onFinal;
    const readyDelivery = job.lead_status === "CONFIRMED" && Boolean(stage && isDeliveryStageName(stage.name));
    const finalTarget = canMarkProductionComplete(job, stages);

    if (unfinishedConfirmed && isOverdueOn(job, input.today)) {
      add({
        job,
        priority: 1,
        labels: [{ text: "Overdue", tone: "danger" }],
        title: "Finish an overdue job",
        reason: "The delivery date has already passed.",
        actionLabel: finalTarget ? "Mark production complete" : "Open job",
        action: finalTarget ? "complete" : "open",
      });
    }
    if (unfinishedConfirmed && isDueOn(job, input.today)) {
      add({
        job,
        priority: 2,
        labels: [{ text: "Due today", tone: "warning" }],
        title: "Complete a job due today",
        reason: "This job should be finished today.",
        actionLabel: finalTarget ? "Mark production complete" : "Open job",
        action: finalTarget ? "complete" : "open",
      });
    }
    if (isFollowUpOverdueOn(job, input.today) || isFollowUpOn(job, input.today)) {
      add({
        job,
        priority: 3,
        labels: [{ text: "Follow up", tone: "warning" }],
        title: isFollowUpOverdueOn(job, input.today)
          ? "Follow-up is overdue"
          : "Follow up with the customer today",
        reason: "A follow-up date is stored for this job.",
        actionLabel: "Record follow-up",
        action: "followup",
      });
    }
    if (job.lead_status === "AWAITING_CONFIRMATION") {
      add({
        job,
        priority: 4,
        labels: [{ text: "Waiting for customer", tone: "warning" }],
        title: "Follow up on a quotation",
        reason: "The customer has not confirmed this quotation yet.",
        actionLabel: "Open job",
        action: "open",
      });
    } else if (job.lead_status === "QUOTATION_PREPARED") {
      add({
        job,
        priority: 4,
        labels: [{ text: "Quotation prepared", tone: "neutral" }],
        title: "Send or revise the quotation",
        reason: "A quotation is prepared and still needs a customer decision.",
        actionLabel: "Prepare quotation",
        action: "quote",
      });
    } else if (job.lead_status === "NEW_INQUIRY") {
      add({
        job,
        priority: 4,
        labels: [{ text: "New enquiry", tone: "neutral" }],
        title: "Prepare a quotation",
        reason: "This enquiry has not been quoted yet.",
        actionLabel: "Prepare quotation",
        action: "quote",
      });
    }
    if (readyDelivery) {
      add({
        job,
        priority: 5,
        labels: [{ text: "Ready for delivery", tone: "success" }],
        title: "Prepare a completed job for delivery",
        reason: `Current stage is ${stage?.name}.`,
        actionLabel: "Open job",
        action: "open",
      });
    } else if (unfinishedConfirmed && !isOverdueOn(job, input.today) && !isDueOn(job, input.today)) {
      add({
        job,
        priority: 6,
        labels: [{ text: "Work in progress", tone: "neutral" }],
        title: "Continue production",
        reason: stage ? `Currently at ${stage.name}.` : "No production stage is assigned yet.",
        actionLabel: finalTarget ? "Mark production complete" : "Open job",
        action: finalTarget ? "complete" : "open",
      });
    }
  }

  return [...merged.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.job.job_number.localeCompare(b.job.job_number);
  });
}

import { jobsApi } from "@/lib/api/endpoints";
import type { Job, QueryValue, WorkflowStage } from "@/types/api";

export async function listAllJobs(params: Record<string, QueryValue>): Promise<Job[]> {
  const first = await jobsApi.list({ ...params, page: 1, page_size: 100 });
  const pages = Math.max(1, Math.ceil(first.total / 100));
  if (pages === 1) return first.items;
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      jobsApi.list({ ...params, page: index + 2, page_size: 100 }),
    ),
  );
  return [...first.items, ...rest.flatMap((page) => page.items)];
}

export function specText(specifications: Record<string, unknown> | undefined): string {
  if (!specifications) return "";
  if (typeof specifications.details === "string") return specifications.details;
  const keys = Object.keys(specifications);
  if (keys.length === 0) return "";
  return JSON.stringify(specifications, null, 2);
}

export function specPayload(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* store as details */
  }
  return { details: trimmed };
}

export function allowedStageTargets(
  stages: WorkflowStage[],
  currentId: string | null,
): WorkflowStage[] {
  const active = stages.filter((stage) => stage.is_active).sort((a, b) => a.sequence - b.sequence);
  const index = active.findIndex((stage) => stage.id === currentId);
  const targets = new Map<string, WorkflowStage>();
  if (index > 0) targets.set(active[index - 1].id, active[index - 1]);
  if (index >= 0 && index < active.length - 1) targets.set(active[index + 1].id, active[index + 1]);
  const finalStage = active.find((stage) => stage.is_final);
  if (finalStage) targets.set(finalStage.id, finalStage);
  if (currentId) targets.delete(currentId);
  return [...targets.values()];
}

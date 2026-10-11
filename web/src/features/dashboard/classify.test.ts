import assert from "node:assert/strict";
import { test } from "node:test";
import type { Job, WorkflowStage } from "../../types/api.ts";
import {
  buildPlannerTasks,
  canMarkProductionComplete,
  completionEnteredAt,
  greetingForHour,
  isDeliveryStageName,
  isDueOn,
  isFollowUpOverdueOn,
  isOverdueOn,
  moneyGreaterThanZero,
} from "./classify.ts";

function job(partial: Partial<Job>): Job {
  return {
    id: "j1",
    job_number: "MW-1",
    customer_id: "c1",
    category_id: "cat1",
    title: "Cards",
    description: "desc",
    quantity: 1,
    specifications: {},
    lead_status: "CONFIRMED",
    current_stage_id: "s1",
    quoted_amount: "100.00",
    final_amount: "100.00",
    advance_amount: "0.00",
    due_date: null,
    next_follow_up_at: null,
    notes: null,
    created_at: "2026-10-01T00:00:00+05:30",
    updated_at: "2026-10-01T00:00:00+05:30",
    ...partial,
  };
}

test("shop-local due and follow-up comparisons", () => {
  const due = job({ due_date: "2026-10-10T00:00:00+05:30" });
  assert.equal(isDueOn(due, "2026-10-10"), true);
  assert.equal(isOverdueOn(due, "2026-10-11"), true);
  assert.equal(isOverdueOn(due, "2026-10-10"), false);
  const follow = job({ next_follow_up_at: "2026-10-09T09:00:00+05:30" });
  assert.equal(isFollowUpOverdueOn(follow, "2026-10-10"), true);
});

test("delivery stage names are explicit, not every final stage", () => {
  assert.equal(isDeliveryStageName("Ready for Delivery"), true);
  assert.equal(isDeliveryStageName("Pickup"), true);
  assert.equal(isDeliveryStageName("Artwork"), false);
  assert.equal(isDeliveryStageName("Completed"), false);
});

test("moneyGreaterThanZero does not use floats as source of truth", () => {
  assert.equal(moneyGreaterThanZero("0.00"), false);
  assert.equal(moneyGreaterThanZero("0.01"), true);
  assert.equal(moneyGreaterThanZero("7500.00"), true);
  assert.equal(moneyGreaterThanZero(null), false);
});

test("greeting follows shop hour", () => {
  assert.equal(greetingForHour(8), "Good morning");
  assert.equal(greetingForHour(14), "Good afternoon");
  assert.equal(greetingForHour(19), "Good evening");
});

test("completion uses latest history onto the final stage", () => {
  const at = completionEnteredAt(
    [
      { id: "1", job_id: "j", from_stage_id: null, to_stage_id: "a", updated_by_user_id: "u", notes: null, created_at: "2026-10-08T10:00:00+05:30" },
      { id: "2", job_id: "j", from_stage_id: "a", to_stage_id: "final", updated_by_user_id: "u", notes: null, created_at: "2026-10-10T11:00:00+05:30" },
    ],
    "final",
  );
  assert.equal(at, "2026-10-10T11:00:00+05:30");
});

test("tasks are unique and overdue wins priority", () => {
  const print: WorkflowStage = {
    id: "s1",
    category_id: "cat1",
    name: "Print",
    sequence: 1,
    is_initial: true,
    is_final: false,
    is_active: true,
    created_at: "",
    updated_at: "",
  };
  const final: WorkflowStage = {
    ...print,
    id: "s2",
    name: "Done",
    sequence: 2,
    is_initial: false,
    is_final: true,
  };
  const overdue = job({
    id: "over",
    job_number: "MW-OVER",
    due_date: "2026-10-01T00:00:00+05:30",
    next_follow_up_at: "2026-10-01T09:00:00+05:30",
    current_stage_id: "s1",
  });
  const tasks = buildPlannerTasks({
    jobs: [overdue],
    today: "2026-10-10",
    stageById: new Map([["s1", print], ["s2", final]]),
    stagesByCategory: { cat1: [print, final] },
  });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].priority, 1);
  assert.deepEqual(
    tasks[0].labels.map((label) => label.text),
    ["Overdue", "Follow up"],
  );
  assert.equal(canMarkProductionComplete(overdue, [print, final])?.id, "s2");
});

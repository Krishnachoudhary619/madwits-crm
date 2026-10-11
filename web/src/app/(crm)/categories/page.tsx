"use client";

import { useCallback, useEffect, useState } from "react";
import { categoriesApi, stagesApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/errors";
import type { PrintCategory, WorkflowStage } from "@/types/api";
import { ActiveBadge } from "@/components/StatusBadge";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/Toast";

export default function CategoriesPage() {
  const toast = useToast();
  const [items, setItems] = useState<PrintCategory[]>([]);
  const [selected, setSelected] = useState<PrintCategory | null>(null);
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PrintCategory | null | "new">(null);
  const [addingStage, setAddingStage] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stageName, setStageName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const page = await categoriesApi.list({ page: 1, page_size: 100 });
    setItems(page.items);
    if (selected) {
      const match = page.items.find((item) => item.id === selected.id) ?? page.items[0] ?? null;
      setSelected(match);
      if (match) setStages(await categoriesApi.stages(match.id));
    } else if (page.items[0]) {
      setSelected(page.items[0]);
      setStages(await categoriesApi.stages(page.items[0].id));
    }
  }, [selected]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectCategory(category: PrintCategory) {
    setSelected(category);
    setStages(await categoriesApi.stages(category.id));
  }

  async function saveCategory() {
    setBusy(true);
    setError("");
    try {
      if (editing === "new") {
        const created = await categoriesApi.create({
          name: name.trim(),
          description: description.trim() || null,
        });
        toast("Category created");
        setEditing(null);
        await load();
        await selectCategory(created);
      } else if (editing) {
        const updated = await categoriesApi.update(editing.id, {
          name: name.trim(),
          description: description.trim() || null,
        });
        toast("Category saved");
        setEditing(null);
        await load();
        await selectCategory(updated);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleCategory(category: PrintCategory) {
    if (
      category.is_active &&
      !window.confirm(
        "Deactivating a category does not delete historical jobs. Existing jobs keep their category and stage references. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const updated = await categoriesApi.update(category.id, { is_active: !category.is_active });
      toast(updated.is_active ? "Category activated" : "Category deactivated");
      await load();
      await selectCategory(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function activeInOrder(list: WorkflowStage[] = stages) {
    return list.filter((stage) => stage.is_active).sort((a, b) => a.sequence - b.sequence);
  }

  async function reloadStages(categoryId: string) {
    const listed = await categoriesApi.stages(categoryId);
    setStages(listed);
    return listed;
  }

  async function makeFirstAndLast(list: WorkflowStage[]) {
    const active = activeInOrder(list);
    if (active.length === 0) return;
    const first = active[0];
    const last = active[active.length - 1];
    if (!first.is_initial) await stagesApi.update(first.id, { is_initial: true });
    if (!last.is_final) await stagesApi.update(last.id, { is_final: true });
  }

  async function saveStage() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const firstStep = activeInOrder().length === 0;
      const created = await categoriesApi.addStage(selected.id, {
        name: stageName.trim(),
        ...(firstStep ? { is_initial: true, is_final: true } : {}),
      });
      if (!firstStep) {
        await stagesApi.update(created.id, { is_final: true });
      }
      toast("Stage added");
      setAddingStage(false);
      setStageName("");
      await reloadStages(selected.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function moveStage(stage: WorkflowStage, direction: -1 | 1) {
    setBusy(true);
    setError("");
    try {
      await stagesApi.update(stage.id, { sequence: stage.sequence + direction });
      if (selected) {
        const listed = await reloadStages(selected.id);
        await makeFirstAndLast(listed);
        await reloadStages(selected.id);
      }
      toast("Stage order updated");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deactivateStage(stage: WorkflowStage) {
    if (
      !window.confirm(
        "This hides the stage from new work. Old jobs keep their history. Continue?",
      )
    ) {
      return;
    }
    const remaining = activeInOrder().filter((item) => item.id !== stage.id);
    if (selected?.is_active && remaining.length === 0) {
      setError("An active category needs at least one step. Add another step first, or deactivate the category.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (remaining.length) {
        if (stage.is_final) await stagesApi.update(remaining[remaining.length - 1].id, { is_final: true });
        if (stage.is_initial) await stagesApi.update(remaining[0].id, { is_initial: true });
      }
      await stagesApi.deactivate(stage.id);
      if (selected) await reloadStages(selected.id);
      toast("Stage hidden");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Categories & workflows"
        description="Each print type has its own list of steps, in order. The first step starts the job. Each new stage is added at the end and becomes the last step."
        actions={<Button onClick={() => { setEditing("new"); setName(""); setDescription(""); }}>New category</Button>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {items.length === 0 ? (
        <EmptyState title="No print categories" description="Create a category, then add its workflow stages." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <ul>
              {items.map((category) => (
                <li key={category.id}>
                  <button
                    type="button"
                    className={`flex min-h-11 w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm ${
                      selected?.id === category.id ? "border-l-4 border-amber bg-canvas" : "border-l-4 border-transparent"
                    }`}
                    onClick={() => void selectCategory(category)}
                  >
                    <span>{category.name}</span>
                    <ActiveBadge active={category.is_active} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {selected ? (
            <Card className="p-4 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="section-title text-charcoal">{selected.name}</h2>
                  {selected.description ? <p className="body-text text-muted">{selected.description}</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(selected);
                      setName(selected.name);
                      setDescription(selected.description ?? "");
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void toggleCategory(selected)}>
                    {selected.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between gap-3">
                <div>
                  <h3 className="card-title">Job steps</h3>
                  <p className="meta-text">Work moves from the first step to the last step.</p>
                </div>
                <Button
                  onClick={() => {
                    setStageName("");
                    setAddingStage(true);
                  }}
                >
                  Add stage
                </Button>
              </div>
              <ol className="mt-3 space-y-2">
                {stages
                  .slice()
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((stage, index, ordered) => {
                    const active = activeInOrder(ordered);
                    const isLast = stage.is_active && active.at(-1)?.id === stage.id;
                    const isFirst = stage.is_active && active[0]?.id === stage.id;
                    return (
                    <li key={stage.id} className="rounded-lg border border-line p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-medium">
                            Step {index + 1}. {stage.name}
                          </span>
                          <span className="ml-2 text-xs text-muted">
                            {isFirst ? "Starts here" : ""}
                            {isFirst && isLast ? " · " : ""}
                            {isLast ? "Last step" : ""}
                          </span>
                          <ActiveBadge active={stage.is_active} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            disabled={busy || index === 0}
                            onClick={() => void moveStage(stage, -1)}
                          >
                            Move up
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={busy || index === ordered.length - 1}
                            onClick={() => void moveStage(stage, 1)}
                          >
                            Move down
                          </Button>
                          {stage.is_active ? (
                            <Button variant="danger" disabled={busy} onClick={() => void deactivateStage(stage)}>
                              Hide
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                void (async () => {
                                  setBusy(true);
                                  setError("");
                                  try {
                                    await stagesApi.update(stage.id, { is_active: true });
                                    if (selected) {
                                      const listed = await reloadStages(selected.id);
                                      await makeFirstAndLast(listed);
                                      await reloadStages(selected.id);
                                    }
                                    toast("Stage restored");
                                  } catch (err) {
                                    setError(errorMessage(err));
                                  } finally {
                                    setBusy(false);
                                  }
                                })();
                              }}
                            >
                              Restore
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                    );
                  })}
              </ol>
              {stages.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No steps yet. Add the first stage for this type of print job.</p>
              ) : null}
            </Card>
          ) : null}
        </div>
      )}
      {editing !== null ? (
        <Modal
          title={editing === "new" ? "New category" : "Edit category"}
          onClose={() => setEditing(null)}
          onSubmit={saveCategory}
          busy={busy}
        >
          <Field label="Name">
            <Input required value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
        </Modal>
      ) : null}
      {addingStage ? (
        <Modal
          title="Add stage"
          onClose={() => setAddingStage(false)}
          onSubmit={saveStage}
          busy={busy}
          submitLabel="Add stage"
        >
          <Field label="Stage name">
            <Input
              required
              value={stageName}
              onChange={(event) => setStageName(event.target.value)}
              placeholder="For example: Printing, Lamination, Delivery"
            />
          </Field>
          <p className="body-text text-muted">
            {activeInOrder().length === 0
              ? "This will be the only step for now, so work starts and finishes here. Add more stages later if needed."
              : "This will be added at the end of the list and become the last step."}
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

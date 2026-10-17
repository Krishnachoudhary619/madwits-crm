"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EllipsisVertical } from "lucide-react";
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

function ActionMenu({
  label,
  disabled = false,
  items,
}: {
  label: string;
  disabled?: boolean;
  items: { label: string; onSelect: () => void; disabled?: boolean; danger?: boolean }[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);

  useEffect(() => {
    if (!open) return;
    const rect = rootRef.current?.getBoundingClientRect();
    setAbove(rect ? window.innerHeight - rect.bottom < 220 : false);
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <EllipsisVertical size={18} />
      </button>
      {open ? (
        <div
          role="menu"
          className={`absolute right-0 z-20 min-w-44 rounded-lg border border-line bg-white py-1 shadow-[var(--shadow-pop)] ${
            above ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`flex min-h-11 w-full items-center px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                item.danger
                  ? "border-t border-line text-danger hover:bg-red-50"
                  : "text-charcoal hover:bg-canvas"
              }`}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CategoriesPage() {
  const toast = useToast();
  const [items, setItems] = useState<PrintCategory[]>([]);
  const [selected, setSelected] = useState<PrintCategory | null>(null);
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PrintCategory | null | "new">(null);
  const [addingStage, setAddingStage] = useState(false);
  const [editingStage, setEditingStage] = useState<WorkflowStage | null>(null);
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

  async function saveStageEdit() {
    if (!editingStage || !selected) return;
    setBusy(true);
    setError("");
    try {
      await stagesApi.update(editingStage.id, { name: stageName.trim() });
      toast("Stage saved");
      setEditingStage(null);
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

  async function restoreStage(stage: WorkflowStage) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await stagesApi.update(stage.id, { is_active: true });
      const listed = await reloadStages(selected.id);
      await makeFirstAndLast(listed);
      await reloadStages(selected.id);
      toast("Stage restored");
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
                <ActionMenu
                  label={`Actions for ${selected.name}`}
                  disabled={busy}
                  items={[
                    {
                      label: "Edit",
                      onSelect: () => {
                        setEditing(selected);
                        setName(selected.name);
                        setDescription(selected.description ?? "");
                      },
                    },
                    {
                      label: selected.is_active ? "Deactivate" : "Activate",
                      onSelect: () => void toggleCategory(selected),
                    },
                  ]}
                />
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
                        <ActionMenu
                          label={`Actions for ${stage.name}`}
                          disabled={busy}
                          items={[
                            {
                              label: "Edit",
                              onSelect: () => {
                                setError("");
                                setStageName(stage.name);
                                setEditingStage(stage);
                              },
                            },
                            {
                              label: "Move up",
                              disabled: index === 0,
                              onSelect: () => void moveStage(stage, -1),
                            },
                            {
                              label: "Move down",
                              disabled: index === ordered.length - 1,
                              onSelect: () => void moveStage(stage, 1),
                            },
                            stage.is_active
                              ? { label: "Hide", danger: true, onSelect: () => void deactivateStage(stage) }
                              : { label: "Restore", onSelect: () => void restoreStage(stage) },
                          ]}
                        />
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
      {editingStage ? (
        <Modal
          title="Edit stage"
          onClose={() => setEditingStage(null)}
          onSubmit={saveStageEdit}
          busy={busy}
          submitLabel="Save stage"
        >
          {error ? <ErrorBanner message={error} /> : null}
          <Field label="Stage name">
            <Input required value={stageName} onChange={(event) => setStageName(event.target.value)} />
          </Field>
          <p className="body-text text-muted">
            Jobs already on this step keep it. Only the name shown in the workflow changes.
          </p>
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

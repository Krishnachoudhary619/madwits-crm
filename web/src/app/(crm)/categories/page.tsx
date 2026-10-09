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
  const [sequence, setSequence] = useState("");
  const [isInitial, setIsInitial] = useState(false);
  const [isFinal, setIsFinal] = useState(false);
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

  async function saveStage() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await categoriesApi.addStage(selected.id, {
        name: stageName.trim(),
        sequence: sequence ? Number.parseInt(sequence, 10) : null,
        is_initial: isInitial,
        is_final: isFinal,
      });
      toast("Stage added");
      setAddingStage(false);
      setStageName("");
      setSequence("");
      setIsInitial(false);
      setIsFinal(false);
      setStages(await categoriesApi.stages(selected.id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function patchStage(stage: WorkflowStage, body: object) {
    setBusy(true);
    setError("");
    try {
      await stagesApi.update(stage.id, body);
      if (selected) setStages(await categoriesApi.stages(selected.id));
      toast("Stage updated");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deactivateStage(stage: WorkflowStage) {
    if (
      !window.confirm(
        "Stages are deactivated, not hard-deleted, so historical job history can keep its references. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await stagesApi.deactivate(stage.id);
      if (selected) setStages(await categoriesApi.stages(selected.id));
      toast("Stage deactivated");
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
        description="Each print category has its own ordered stages. An active category with stages needs exactly one initial and one final active stage."
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
              <div className="mt-6 flex items-center justify-between">
                <h3 className="card-title">Workflow stages</h3>
                <Button onClick={() => setAddingStage(true)}>Add stage</Button>
              </div>
              <ol className="mt-3 space-y-2">
                {stages
                  .slice()
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((stage) => (
                    <li key={stage.id} className="rounded-lg border border-line p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-medium">
                            {stage.sequence}. {stage.name}
                          </span>
                          <span className="ml-2 text-xs text-muted">
                            {stage.is_initial ? "Initial" : ""}
                            {stage.is_initial && stage.is_final ? " · " : ""}
                            {stage.is_final ? "Final" : ""}
                          </span>
                          <ActiveBadge active={stage.is_active} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            disabled={busy || stage.sequence <= 1}
                            onClick={() => void patchStage(stage, { sequence: stage.sequence - 1 })}
                          >
                            Up
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void patchStage(stage, { sequence: stage.sequence + 1 })}
                          >
                            Down
                          </Button>
                          {!stage.is_initial ? (
                            <Button variant="secondary" disabled={busy} onClick={() => void patchStage(stage, { is_initial: true })}>
                              Make initial
                            </Button>
                          ) : null}
                          {!stage.is_final ? (
                            <Button variant="secondary" disabled={busy} onClick={() => void patchStage(stage, { is_final: true })}>
                              Make final
                            </Button>
                          ) : null}
                          {stage.is_active ? (
                            <Button variant="danger" disabled={busy} onClick={() => void deactivateStage(stage)}>
                              Deactivate
                            </Button>
                          ) : (
                            <Button variant="secondary" disabled={busy} onClick={() => void patchStage(stage, { is_active: true })}>
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
              </ol>
              {stages.length === 0 ? <p className="mt-3 text-sm text-muted">No stages yet. The first stage should be both initial and final.</p> : null}
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
        <Modal title="Add stage" onClose={() => setAddingStage(false)} onSubmit={saveStage} busy={busy}>
          <Field label="Name">
            <Input required value={stageName} onChange={(event) => setStageName(event.target.value)} />
          </Field>
          <Field label="Sequence" hint="Leave blank to append.">
            <Input type="number" min={1} value={sequence} onChange={(event) => setSequence(event.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isInitial} onChange={(event) => setIsInitial(event.target.checked)} />
            Initial stage
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isFinal} onChange={(event) => setIsFinal(event.target.checked)} />
            Final stage
          </label>
        </Modal>
      ) : null}
    </div>
  );
}

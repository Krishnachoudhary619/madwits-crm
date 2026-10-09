"use client";

import { useEffect, useState } from "react";
import { customersApi, jobsApi } from "@/lib/api/endpoints";
import { dateToIsoStart, shopDateTime, toDateInput } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { specPayload, specText } from "@/lib/jobs";
import type { Customer, Job, PrintCategory } from "@/types/api";
import { ErrorBanner, Field, Input, Modal, Select, Textarea } from "@/components/ui";

export function JobForm({
  job,
  categories,
  onClose,
  onSaved,
}: {
  job?: Job | null;
  categories: PrintCategory[];
  onClose: () => void;
  onSaved: (job: Job) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState(job?.customer_id ?? "");
  const [categoryId, setCategoryId] = useState(job?.category_id ?? "");
  const [title, setTitle] = useState(job?.title ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [quantity, setQuantity] = useState(String(job?.quantity ?? 1));
  const [specs, setSpecs] = useState(specText(job?.specifications));
  const [dueDate, setDueDate] = useState(toDateInput(job?.due_date));
  const [followUp, setFollowUp] = useState(toDateInput(job?.next_follow_up_at));
  const [notes, setNotes] = useState(job?.notes ?? "");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void customersApi
        .list({ page: 1, page_size: 50, sort: "name", order: "asc", q: customerQuery || undefined })
        .then((page) => setCustomers(page.items))
        .catch(() => setCustomers([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [customerQuery]);

  async function onSubmit() {
    setBusy(true);
    setError("");
    const qty = Number.parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty < 1) {
      setError("Quantity must be a whole number greater than zero.");
      setBusy(false);
      return;
    }
    try {
      let saved: Job;
      if (job) {
        saved = await jobsApi.update(job.id, {
          title: title.trim(),
          description: description.trim(),
          quantity: qty,
          specifications: specPayload(specs),
          due_date: dueDate ? dateToIsoStart(dueDate) : undefined,
          next_follow_up_at: followUp ? shopDateTime(followUp, "09:00") : undefined,
          notes: notes.trim() || null,
        });
      } else {
        saved = await jobsApi.create({
          customer_id: customerId,
          category_id: categoryId,
          title: title.trim(),
          description: description.trim(),
          quantity: qty,
          specifications: specPayload(specs),
          due_date: dueDate ? dateToIsoStart(dueDate) : undefined,
          next_follow_up_at: followUp ? shopDateTime(followUp, "09:00") : undefined,
          notes: notes.trim() || null,
        });
      }
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const activeCategories = categories.filter((category) => category.is_active || category.id === job?.category_id);

  return (
    <Modal
      title={job ? `Edit ${job.job_number}` : "New enquiry"}
      onClose={onClose}
      onSubmit={onSubmit}
      busy={busy}
      submitLabel={job ? "Save job" : "Create enquiry"}
    >
      {error ? <ErrorBanner message={error} /> : null}
      {!job ? (
        <>
          <Field label="Find customer" hint="Search by name or phone, then select.">
            <Input
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
              placeholder="Type to search"
            />
          </Field>
          <Field label="Customer">
            <Select required value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id} disabled={!customer.is_active}>
                  {customer.name} · {customer.phone}
                  {customer.is_active ? "" : " (inactive)"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Print category">
            <Select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Select category</option>
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
        </>
      ) : (
        <p className="text-sm text-muted">
          Customer and print category cannot be changed after the enquiry is created.
        </p>
      )}
      <Field label="Title">
        <Input required value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea required value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Field label="Quantity">
        <Input type="number" min={1} step={1} required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      </Field>
      <Field label="Specifications" hint="Free-text job specs stored on the job. JSON is accepted if valid.">
        <Textarea value={specs} onChange={(event) => setSpecs(event.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date">
          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
        <Field label="Next follow-up">
          <Input type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
    </Modal>
  );
}

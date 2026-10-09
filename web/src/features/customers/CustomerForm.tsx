"use client";

import { useState } from "react";
import { customersApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/errors";
import type { Customer } from "@/types/api";
import { ErrorBanner, Field, Input, Modal, Textarea } from "@/components/ui";

export function CustomerForm({
  customer,
  initialName = "",
  initialPhone = "",
  nested = false,
  onClose,
  onSaved,
}: {
  customer?: Customer | null;
  initialName?: string;
  initialPhone?: string;
  nested?: boolean;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(customer?.name ?? initialName);
  const [phone, setPhone] = useState(customer?.phone ?? initialPhone);
  const [businessName, setBusinessName] = useState(customer?.business_name ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");

  async function onSubmit() {
    setBusy(true);
    setError("");
    const body = {
      name: name.trim(),
      phone: phone.trim(),
      business_name: businessName.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      const saved = customer
        ? await customersApi.update(customer.id, body)
        : await customersApi.create(body);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={customer ? "Edit customer" : "New customer"}
      onClose={onClose}
      onSubmit={onSubmit}
      busy={busy}
      nested={nested}
      submitLabel={customer ? "Save changes" : "Create customer"}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <Field label="Name">
        <Input required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Phone">
        <Input required value={phone} onChange={(event) => setPhone(event.target.value)} />
      </Field>
      <Field label="Business name">
        <Input value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
      </Field>
      <Field label="Address">
        <Textarea value={address} onChange={(event) => setAddress(event.target.value)} />
      </Field>
      <Field label="Notes">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
    </Modal>
  );
}

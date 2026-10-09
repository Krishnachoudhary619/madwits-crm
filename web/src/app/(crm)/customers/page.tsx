"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { customersApi } from "@/lib/api/endpoints";
import { formatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import type { Customer } from "@/types/api";
import { ActiveBadge } from "@/components/StatusBadge";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  Pagination,
  RecordCard,
  ResponsiveRecords,
  Spinner,
} from "@/components/ui";
import { CustomerForm } from "@/features/customers/CustomerForm";
import { useToast } from "@/components/Toast";

export default function CustomersPage() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await customersApi.list({
          q: q || undefined,
          page,
          page_size: 20,
          sort: "name",
          order: "asc",
        });
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const handle = window.setTimeout(() => void load(), 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [q, page]);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Search the shop directory by name or phone. Inactive customers remain in history."
        actions={<Button onClick={() => setCreating(true)}>New customer</Button>}
      />
      <Card className="mb-4 p-4">
        <Input
          placeholder="Search name or phone"
          value={q}
          onChange={(event) => {
            setPage(1);
            setQ(event.target.value);
          }}
          aria-label="Search customers"
        />
      </Card>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          title="No customers found"
          description="Create a customer to start taking enquiries."
          action={<Button onClick={() => setCreating(true)}>New customer</Button>}
        />
      ) : (
        <Card>
          <div className="p-3 md:p-0">
            <ResponsiveRecords
              cards={items.map((customer) => (
                <RecordCard
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  title={customer.name}
                  subtitle={customer.phone}
                  extra={<ActiveBadge active={customer.is_active} />}
                  meta={
                    <>
                      <span>{customer.business_name || "No business name"}</span>
                      <span>Added {formatDate(customer.created_at)}</span>
                    </>
                  }
                />
              ))}
              table={
                <table className="table-grid">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Business</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((customer) => (
                      <tr key={customer.id}>
                        <td>
                          <Link className="font-medium hover:underline" href={`/customers/${customer.id}`}>
                            {customer.name}
                          </Link>
                        </td>
                        <td>{customer.phone}</td>
                        <td>{customer.business_name || "—"}</td>
                        <td>
                          <ActiveBadge active={customer.is_active} />
                        </td>
                        <td>{formatDate(customer.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            />
          </div>
          <Pagination page={page} pageSize={20} total={total} onPage={setPage} />
        </Card>
      )}
      {creating ? (
        <CustomerForm
          onClose={() => setCreating(false)}
          onSaved={(customer) => {
            setCreating(false);
            toast("Customer created");
            window.location.href = `/customers/${customer.id}`;
          }}
        />
      ) : null}
    </div>
  );
}

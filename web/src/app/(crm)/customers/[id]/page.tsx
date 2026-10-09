"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { customersApi } from "@/lib/api/endpoints";
import { formatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import type { Customer, CustomerJobSummary } from "@/types/api";
import { ActiveBadge, LeadBadge } from "@/components/StatusBadge";
import { Button, Card, ErrorBanner, PageHeader, Pagination, Spinner } from "@/components/ui";
import { CustomerForm } from "@/features/customers/CustomerForm";
import { useToast } from "@/components/Toast";
import { nameById, useCatalogs } from "@/hooks/useCatalogs";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { categories } = useCatalogs();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<CustomerJobSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [detail, jobPage] = await Promise.all([
      customersApi.get(id),
      customersApi.jobs(id, { page, page_size: 20 }),
    ]);
    setCustomer(detail);
    setJobs(jobPage.items);
    setTotal(jobPage.total);
  }, [id, page]);

  useEffect(() => {
    void load().catch((err) => setError(errorMessage(err)));
  }, [load]);

  async function toggleActive() {
    if (!customer) return;
    setBusy(true);
    try {
      const updated = await customersApi.update(customer.id, { is_active: !customer.is_active });
      setCustomer(updated);
      toast(updated.is_active ? "Customer reactivated" : "Customer deactivated");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (error && !customer) return <ErrorBanner message={error} />;
  if (!customer) return <Spinner />;

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={customer.business_name || "Customer profile"}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void toggleActive()}>
              {customer.is_active ? "Deactivate" : "Reactivate"}
            </Button>
            <Link href={`/enquiries?customer_id=${customer.id}`}>
              <Button>New enquiry</Button>
            </Link>
          </>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-1">
          <h2 className="mb-3 font-medium">Contact</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted">Phone</dt>
              <dd>{customer.phone}</dd>
            </div>
            <div>
              <dt className="text-muted">Address</dt>
              <dd className="whitespace-pre-wrap">{customer.address || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Notes</dt>
              <dd className="whitespace-pre-wrap">{customer.notes || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Status</dt>
              <dd>
                <ActiveBadge active={customer.is_active} />
              </dd>
            </div>
            <div>
              <dt className="text-muted">Created</dt>
              <dd>{formatDate(customer.created_at)}</dd>
            </div>
          </dl>
        </Card>
        <Card className="lg:col-span-2">
          <div className="p-4">
            <h2 className="font-medium">Jobs and quotations</h2>
            <p className="text-xs text-muted">Previous work for this customer, including stored job titles.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table-grid">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <Link className="font-medium hover:underline" href={`/jobs/${job.id}`}>
                        {job.job_number}
                      </Link>
                      <div className="text-xs text-muted">{job.title}</div>
                    </td>
                    <td>{nameById(categories, job.category_id)}</td>
                    <td>
                      <LeadBadge status={job.lead_status} />
                    </td>
                    <td>{formatDate(job.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {jobs.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted">No jobs yet for this customer.</p>
          ) : (
            <Pagination page={page} pageSize={20} total={total} onPage={setPage} />
          )}
        </Card>
      </div>
      {editing ? (
        <CustomerForm
          customer={customer}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setCustomer(updated);
            setEditing(false);
            toast("Customer saved");
          }}
        />
      ) : null}
    </div>
  );
}

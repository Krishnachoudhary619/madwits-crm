"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { customersApi } from "@/lib/api/endpoints";
import { formatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import type { Customer, CustomerJobSummary } from "@/types/api";
import { ActiveBadge, LeadBadge } from "@/components/StatusBadge";
import {
  buttonClass,
  Button,
  Card,
  ErrorBanner,
  PageHeader,
  Pagination,
  RecordCard,
  ResponsiveRecords,
  Spinner,
} from "@/components/ui";
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
    if (!customer || busy) return;
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
        breadcrumb={
          <>
            <Link href="/customers" className="hover:underline">
              Customers
            </Link>
            {" / "}
            {customer.name}
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void toggleActive()}>
              {customer.is_active ? "Deactivate" : "Reactivate"}
            </Button>
            <Link href={`/enquiries?customer_id=${customer.id}`} className={buttonClass()}>
              New enquiry
            </Link>
          </>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5 lg:col-span-1">
          <h2 className="section-title mb-3 text-charcoal">Contact</h2>
          <dl className="space-y-3">
            <div>
              <dt className="meta-text">Phone</dt>
              <dd className="body-text font-medium">{customer.phone}</dd>
            </div>
            {customer.address ? (
              <div>
                <dt className="meta-text">Address</dt>
                <dd className="whitespace-pre-wrap body-text">{customer.address}</dd>
              </div>
            ) : null}
            {customer.notes ? (
              <div>
                <dt className="meta-text">Notes</dt>
                <dd className="whitespace-pre-wrap body-text">{customer.notes}</dd>
              </div>
            ) : null}
            <div>
              <dt className="meta-text">Status</dt>
              <dd className="mt-1">
                <ActiveBadge active={customer.is_active} />
              </dd>
            </div>
            <div>
              <dt className="meta-text">Created</dt>
              <dd className="body-text">{formatDate(customer.created_at)}</dd>
            </div>
          </dl>
        </Card>
        <Card className="lg:col-span-2">
          <div className="p-4 sm:p-5">
            <h2 className="section-title text-charcoal">Jobs and quotations</h2>
            <p className="meta-text">Previous work for this customer, including stored job titles.</p>
          </div>
          {jobs.length === 0 ? (
            <p className="px-4 pb-5 body-text text-muted">No jobs yet for this customer.</p>
          ) : (
            <>
              <div className="px-3 pb-3 md:px-0 md:pb-0">
                <ResponsiveRecords
                  cards={jobs.map((job) => (
                    <RecordCard
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      title={job.job_number}
                      subtitle={job.title || nameById(categories, job.category_id)}
                      extra={<LeadBadge status={job.lead_status} />}
                      meta={<span>Created {formatDate(job.created_at)}</span>}
                    />
                  ))}
                  table={
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
                              <div className="meta-text">{job.title}</div>
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
                  }
                />
              </div>
              <Pagination page={page} pageSize={20} total={total} onPage={setPage} />
            </>
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

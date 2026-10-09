"use client";

import { useCallback, useEffect, useState } from "react";
import { usersApi } from "@/lib/api/endpoints";
import { formatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import type { UserPublic } from "@/types/api";
import { useAuth } from "@/components/AuthProvider";
import { ActiveBadge } from "@/components/StatusBadge";
import { Button, Card, ErrorBanner, Field, Input, Modal, PageHeader, Pagination, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

export default function StaffPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<UserPublic[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserPublic | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await usersApi.list({ page, page_size: 20 });
    setItems(result.items);
    setTotal(result.total);
  }, [page]);

  useEffect(() => {
    if (authLoading || !user || user.role !== "ADMIN") return;
    setLoading(true);
    void load()
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [load, user, authLoading]);

  if (authLoading) return <Spinner />;

  if (!user || user.role !== "ADMIN") {
    return (
      <div>
        <PageHeader title="Staff management" />
        <ErrorBanner message="Only Admin accounts can manage staff. This page is hidden from Staff navigation; the API remains the security boundary." />
      </div>
    );
  }

  async function createStaff() {
    setBusy(true);
    setError("");
    try {
      await usersApi.create({
        display_name: displayName.trim(),
        username: username.trim(),
        password,
      });
      toast("Staff account created");
      setCreating(false);
      setDisplayName("");
      setUsername("");
      setPassword("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveUser() {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      const body: { display_name: string; password?: string } = { display_name: displayName.trim() };
      if (password) body.password = password;
      await usersApi.update(editing.id, body);
      toast("User updated");
      setEditing(null);
      setPassword("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(userRow: UserPublic) {
    setBusy(true);
    try {
      await usersApi.update(userRow.id, { is_active: !userRow.is_active });
      toast(userRow.is_active ? "Account deactivated" : "Account activated");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Staff management"
        description="Admin-only. New accounts are always Staff. Attribution options for production updates are active users from this directory."
        actions={<Button onClick={() => { setCreating(true); setDisplayName(""); setUsername(""); setPassword(""); }}>Create staff</Button>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? (
        <Spinner />
      ) : (
        <Card>
          <div className="space-y-2 p-3 md:hidden">
            {items.map((row) => (
              <div key={row.id} className="rounded-xl border border-line p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{row.display_name}</p>
                    <p className="meta-text">
                      {row.username} · {row.role}
                    </p>
                  </div>
                  <ActiveBadge active={row.is_active} />
                </div>
                <p className="mt-1 meta-text">Created {formatDate(row.created_at)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(row);
                      setDisplayName(row.display_name);
                      setPassword("");
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void toggle(row)}>
                    {row.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="table-grid">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.display_name}</td>
                    <td>{row.username}</td>
                    <td>{row.role}</td>
                    <td>
                      <ActiveBadge active={row.is_active} />
                    </td>
                    <td>{formatDate(row.created_at)}</td>
                    <td className="space-x-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditing(row);
                          setDisplayName(row.display_name);
                          setPassword("");
                        }}
                      >
                        Edit
                      </Button>
                      <Button variant="secondary" disabled={busy} onClick={() => void toggle(row)}>
                        {row.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={20} total={total} onPage={setPage} />
        </Card>
      )}
      {creating ? (
        <Modal title="Create staff account" onClose={() => setCreating(false)} onSubmit={createStaff} busy={busy}>
          <Field label="Display name">
            <Input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </Field>
          <Field label="Username">
            <Input required autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <Input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
        </Modal>
      ) : null}
      {editing ? (
        <Modal title={`Edit ${editing.username}`} onClose={() => setEditing(null)} onSubmit={saveUser} busy={busy}>
          <Field label="Display name">
            <Input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </Field>
          <Field label="New password" hint="Leave blank to keep the current password.">
            <Input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

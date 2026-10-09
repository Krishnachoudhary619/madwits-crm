"use client";

import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronsUpDown } from "lucide-react";
import { customersApi } from "@/lib/api/endpoints";
import type { Customer } from "@/types/api";
import { Button } from "@/components/ui";

function labelFor(customer: Customer): string {
  const business = customer.business_name ? ` · ${customer.business_name}` : "";
  const inactive = customer.is_active ? "" : " (inactive)";
  return `${customer.name} · ${customer.phone}${business}${inactive}`;
}

export function CustomerPicker({
  value,
  onChange,
  onCreate,
}: {
  value: string;
  onChange: (id: string, customer?: Customer) => void;
  onCreate: (query: string) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [menuBox, setMenuBox] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    void customersApi.get(value).then(setSelected).catch(() => setSelected(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      setLoading(true);
      void customersApi
        .list({ page: 1, page_size: 50, sort: "name", order: "asc", q: query.trim() || undefined })
        .then((page) => {
          setItems(page.items);
          setHighlight(0);
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    function updateBox() {
      const box = inputRef.current?.getBoundingClientRect();
      if (box) setMenuBox(box);
    }
    updateBox();
    window.addEventListener("resize", updateBox);
    window.addEventListener("scroll", updateBox, true);
    return () => {
      window.removeEventListener("resize", updateBox);
      window.removeEventListener("scroll", updateBox, true);
    };
  }, [open]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const display = open ? query : selected ? labelFor(selected) : "";
  const noMatches = open && !loading && items.length === 0;

  function choose(customer: Customer) {
    if (!customer.is_active) return;
    setSelected(customer);
    setQuery("");
    onChange(customer.id, customer);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) => Math.min(index + 1, Math.max(items.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const match = items[highlight];
      if (match) choose(match);
      else if (noMatches) {
        setOpen(false);
        onCreate(query);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const menu =
    open && menuBox && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            className="max-h-64 overflow-y-auto rounded-md border border-line bg-white shadow-lg"
            style={{
              position: "fixed",
              top: menuBox.bottom + 4,
              left: menuBox.left,
              width: menuBox.width,
              zIndex: 80,
            }}
          >
            {loading ? <p className="px-3 py-2 text-sm text-muted">Searching…</p> : null}
            {!loading &&
              items.map((customer, index) => (
                <button
                  key={customer.id}
                  type="button"
                  role="option"
                  aria-selected={customer.id === value}
                  disabled={!customer.is_active}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    index === highlight ? "bg-canvas" : ""
                  } ${customer.is_active ? "hover:bg-canvas" : "text-muted"}`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(customer)}
                >
                  <span className="font-medium">{customer.name}</span>
                  <span className="text-muted"> · {customer.phone}</span>
                  {customer.business_name ? (
                    <span className="block text-xs text-muted">{customer.business_name}</span>
                  ) : null}
                </button>
              ))}
            {noMatches ? (
              <div className="space-y-2 px-3 py-3">
                <p className="text-sm text-muted">
                  No customer matches{query.trim() ? ` “${query.trim()}”` : ""}.
                </p>
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    onCreate(query);
                  }}
                >
                  Create customer
                </Button>
              </div>
            ) : (
              <div className="border-t border-line p-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    onCreate(query);
                  }}
                >
                  Create customer
                </Button>
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1.5 block label-text text-charcoal">Customer</span>
      <input type="hidden" name="customer_id" value={value} required />
      <div className="relative">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          className="min-h-11 w-full rounded-md border border-line bg-white px-3 py-2 pr-10 text-sm text-charcoal placeholder:text-muted focus:border-charcoal focus:outline-none focus:ring-2 focus:ring-amber/60"
          placeholder="Search name or phone"
          value={display}
          onFocus={() => {
            setOpen(true);
            setQuery(selected ? "" : query);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (value) onChange("");
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center text-muted"
          aria-label="Show customers"
          onClick={() => {
            setOpen((current) => !current);
            inputRef.current?.focus();
          }}
        >
          <ChevronsUpDown size={16} />
        </button>
      </div>
      {menu}
    </div>
  );
}

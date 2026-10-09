"use client";

import { useCallback, useEffect, useState } from "react";
import { categoriesApi, customersApi } from "@/lib/api/endpoints";
import type { Customer, PrintCategory, WorkflowStage } from "@/types/api";

export function useCatalogs() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<PrintCategory[]>([]);
  const [stagesByCategory, setStagesByCategory] = useState<Record<string, WorkflowStage[]>>({});

  const reload = useCallback(async () => {
    const [customerPage, categoryPage] = await Promise.all([
      customersApi.list({ page: 1, page_size: 100, sort: "name", order: "asc" }),
      categoriesApi.list({ page: 1, page_size: 100 }),
    ]);
    setCustomers(customerPage.items);
    setCategories(categoryPage.items);
    const stageEntries = await Promise.all(
      categoryPage.items.map(async (category) => [category.id, await categoriesApi.stages(category.id)] as const),
    );
    setStagesByCategory(Object.fromEntries(stageEntries));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { customers, categories, stagesByCategory, reload };
}

export function nameById<T extends { id: string; name: string }>(items: T[], id: string | null | undefined): string {
  if (!id) return "—";
  return items.find((item) => item.id === id)?.name ?? "—";
}

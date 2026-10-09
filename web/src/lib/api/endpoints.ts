import { api, qs, type QueryValue } from "@/lib/api/client";
import type {
  AttributionOption,
  Customer,
  CustomerJobSummary,
  DashboardSummary,
  Job,
  JobBalance,
  JobHistory,
  JobPaymentList,
  JobsByCategoryItem,
  JobsByStageItem,
  Paginated,
  Payment,
  PaymentsSummary,
  PrintCategory,
  UserPublic,
  WorkflowStage,
} from "@/types/api";

export const sessionApi = {
  login: (username: string, password: string) =>
    api<UserPublic>("/api/session/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      skipAuthRedirect: true,
    }),
  logout: () => api<void>("/api/session/logout", { method: "POST", skipAuthRedirect: true }),
  me: () => api<UserPublic>("/api/session/me", { skipAuthRedirect: true }),
};

export const customersApi = {
  list: (params: Record<string, string | number | undefined>) =>
    api<Paginated<Customer>>(`/customers${qs(params)}`),
  get: (id: string) => api<Customer>(`/customers/${id}`),
  create: (body: object) =>
    api<Customer>("/customers", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    api<Customer>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  jobs: (id: string, params: Record<string, number | undefined> = {}) =>
    api<Paginated<CustomerJobSummary>>(`/customers/${id}/jobs${qs(params)}`),
};

export const categoriesApi = {
  list: (params: Record<string, string | number | boolean | undefined> = {}) =>
    api<Paginated<PrintCategory>>(`/print-categories${qs(params)}`),
  get: (id: string) => api<PrintCategory>(`/print-categories/${id}`),
  create: (body: object) =>
    api<PrintCategory>("/print-categories", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    api<PrintCategory>(`/print-categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  stages: (id: string) => api<WorkflowStage[]>(`/print-categories/${id}/stages`),
  addStage: (id: string, body: object) =>
    api<WorkflowStage>(`/print-categories/${id}/stages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const stagesApi = {
  update: (id: string, body: object) =>
    api<WorkflowStage>(`/workflow-stages/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deactivate: (id: string) =>
    api<WorkflowStage>(`/workflow-stages/${id}/deactivate`, { method: "POST" }),
};

export const jobsApi = {
  list: (params: Record<string, QueryValue>) =>
    api<Paginated<Job>>(`/jobs${qs(params)}`),
  get: (id: string) => api<Job>(`/jobs/${id}`),
  create: (body: object) => api<Job>("/jobs", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    api<Job>(`/jobs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  quotation: (id: string, body: object) =>
    api<Job>(`/jobs/${id}/quotation`, { method: "POST", body: JSON.stringify(body) }),
  confirm: (id: string, body: object) =>
    api<Job>(`/jobs/${id}/confirm`, { method: "POST", body: JSON.stringify(body) }),
  markLost: (id: string, body: object) =>
    api<Job>(`/jobs/${id}/mark-lost`, { method: "POST", body: JSON.stringify(body) }),
  cancel: (id: string, body: object) =>
    api<Job>(`/jobs/${id}/cancel`, { method: "POST", body: JSON.stringify(body) }),
  stage: (id: string, body: object) =>
    api<Job>(`/jobs/${id}/stage`, { method: "POST", body: JSON.stringify(body) }),
  history: (id: string) => api<JobHistory[]>(`/jobs/${id}/history`),
  payments: (id: string) => api<JobPaymentList>(`/jobs/${id}/payments`),
  balance: (id: string) => api<JobBalance>(`/jobs/${id}/balance`),
  addPayment: (id: string, body: object) =>
    api<Payment>(`/jobs/${id}/payments`, { method: "POST", body: JSON.stringify(body) }),
};

export const paymentsApi = {
  list: (params: Record<string, string | number | undefined>) =>
    api<Paginated<Payment>>(`/payments${qs(params)}`),
};

export const dashboardApi = {
  summary: (from?: string, to?: string) =>
    api<DashboardSummary>(`/dashboard/summary${qs({ from_date: from, to_date: to })}`),
  jobsByStage: () =>
    api<{ items: JobsByStageItem[] }>("/dashboard/jobs-by-stage"),
  jobsByCategory: () =>
    api<{ items: JobsByCategoryItem[] }>("/dashboard/jobs-by-category"),
  paymentsSummary: (from?: string, to?: string) =>
    api<PaymentsSummary>(`/dashboard/payments-summary${qs({ from_date: from, to_date: to })}`),
};

export const usersApi = {
  attribution: () => api<AttributionOption[]>("/users/attribution-options"),
  list: (params: Record<string, number | undefined> = {}) =>
    api<Paginated<UserPublic>>(`/users${qs(params)}`),
  create: (body: object) =>
    api<UserPublic>("/users", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    api<UserPublic>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};

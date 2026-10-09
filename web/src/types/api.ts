export type LeadStatus =
  | "NEW_INQUIRY"
  | "QUOTATION_PREPARED"
  | "AWAITING_CONFIRMATION"
  | "CONFIRMED"
  | "LOST"
  | "CANCELLED";

export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";
export type PaymentMethod = "CASH" | "UPI" | "BANK_TRANSFER";
export type UserRole = "ADMIN" | "STAFF";

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type UserPublic = {
  id: string;
  display_name: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AttributionOption = {
  id: string;
  display_name: string;
  username: string;
  role: UserRole;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  business_name: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerJobSummary = {
  id: string;
  job_number: string;
  title: string;
  lead_status: LeadStatus;
  category_id: string;
  current_stage_id: string | null;
  created_at: string;
};

export type PrintCategory = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkflowStage = {
  id: string;
  category_id: string;
  name: string;
  sequence: number;
  is_initial: boolean;
  is_final: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Job = {
  id: string;
  job_number: string;
  customer_id: string;
  category_id: string;
  title: string;
  description: string;
  quantity: number;
  specifications: Record<string, unknown>;
  lead_status: LeadStatus;
  current_stage_id: string | null;
  quoted_amount: string | null;
  final_amount: string | null;
  advance_amount: string;
  due_date: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type JobHistory = {
  id: string;
  job_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  updated_by_user_id: string;
  notes: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  job_id: string;
  amount: string;
  payment_method: PaymentMethod | string;
  reference_number: string | null;
  paid_at: string;
  notes: string | null;
  created_at: string;
};

export type JobBalance = {
  job_id: string;
  amount_due: string;
  total_paid: string;
  balance: string;
  payment_status: PaymentStatus;
};

export type JobPaymentList = Paginated<Payment> & JobBalance;

export type DashboardPeriod = {
  timezone: string;
  from_date: string;
  to_date: string;
  start_at: string;
  end_at: string;
};

export type DashboardSummary = {
  period: DashboardPeriod;
  open_inquiries: number;
  quotations_awaiting_confirmation: number;
  follow_ups_due_today: number;
  follow_ups_overdue: number;
  in_production: number;
  completed_in_period: number;
  jobs_created_in_period: number;
  confirmed_created_in_period: number;
  conversion_rate: string;
  open_quotation_pipeline_value: string;
  payments_received_in_period: string;
  outstanding_balance: string;
};

export type JobsByStageItem = {
  stage_id: string;
  stage_name: string;
  category_id: string;
  category_name: string;
  job_count: number;
};

export type JobsByCategoryItem = {
  category_id: string;
  category_name: string;
  job_count: number;
  confirmed_count: number;
  in_production_count: number;
  completed_count: number;
};

export type PaymentsSummary = {
  period: DashboardPeriod;
  payment_count: number;
  total_received: string;
  by_method: { payment_method: string; payment_count: number; total_amount: string }[];
};

export type QueryValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | Array<string | number | boolean>;

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
};

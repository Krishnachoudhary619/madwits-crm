export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts;
}

export function dateToIsoStart(date: string): string | undefined {
  if (!date) return undefined;
  return `${date}T00:00:00+05:30`;
}

export function dateToIsoEnd(date: string): string | undefined {
  if (!date) return undefined;
  return `${date}T23:59:59.999+05:30`;
}

export function shopDateTime(date: string, time = "12:00"): string | undefined {
  if (!date) return undefined;
  return `${date}T${time}:00+05:30`;
}

export function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

export function monthStartIsoDate(): string {
  const today = todayIsoDate();
  return `${today.slice(0, 8)}01`;
}

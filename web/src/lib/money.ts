/** Display-only INR formatting. Never use IEEE floats as source of truth. */

export function formatInr(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const negative = value.startsWith("-");
  const raw = negative ? value.slice(1) : value;
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return "—";
  }
  const [whole, fraction = ""] = raw.split(".");
  const cents = (fraction + "00").slice(0, 2);
  const grouped = groupIndian(whole);
  const sign = negative ? "-" : "";
  return `${sign}₹${grouped}.${cents}`;
}

function groupIndian(whole: string): string {
  if (whole.length <= 3) {
    return whole;
  }
  const lastThree = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const withCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${withCommas},${lastThree}`;
}

export function paymentStatusLabel(status: string): string {
  if (status === "PAID") return "Paid";
  if (status === "PARTIALLY_PAID") return "Partially paid";
  if (status === "UNPAID") return "Unpaid";
  return status;
}

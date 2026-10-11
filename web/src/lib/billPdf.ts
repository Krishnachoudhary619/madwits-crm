export type BillDetails = {
  shopName: string;
  jobNumber: string;
  title: string;
  stationeryName: string;
  customerName: string;
  customerPhone: string;
  quantity: number;
  amount: string;
  paid: string;
  balance: string;
  issuedOn: string;
};

function escapePdf(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function billLines(details: BillDetails): string[] {
  return [
    details.shopName,
    "Bill",
    "",
    `Job: ${details.jobNumber}`,
    `Date: ${details.issuedOn}`,
    `Customer: ${details.customerName}`,
    details.customerPhone ? `Phone: ${details.customerPhone}` : "",
    `Stationery: ${details.stationeryName}`,
    details.title ? `Work: ${details.title}` : "",
    `Quantity: ${details.quantity}`,
    `Amount: ${details.amount}`,
    `Paid: ${details.paid}`,
    `Balance: ${details.balance}`,
    "",
    "Thank you for choosing MadWits.",
  ].filter((line, index, lines) => line !== "" || (index > 0 && lines[index - 1] !== ""));
}

export function billWhatsAppText(details: BillDetails): string {
  return [
    `${details.shopName} bill`,
    `${details.jobNumber} — ${details.stationeryName}`,
    details.title ? details.title : "",
    `Amount: ${details.amount}`,
    `Paid: ${details.paid}`,
    `Balance: ${details.balance}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function whatsappPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

export function whatsappShareUrl(details: BillDetails): string {
  const text = encodeURIComponent(billWhatsAppText(details));
  const phone = whatsappPhone(details.customerPhone);
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function buildBillPdf(details: BillDetails): Uint8Array {
  const lines = billLines(details);
  const commands = ["BT", "/F1 14 Tf", "50 780 Td"];
  lines.forEach((line, index) => {
    const font = index === 0 ? 18 : 12;
    if (index === 0) {
      commands.push(`/F1 ${font} Tf`);
    } else if (index === 1) {
      commands.push("/F1 12 Tf");
    }
    commands.push(`(${escapePdf(line)}) Tj`);
    commands.push("0 -20 Td");
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let offset = 9;
  const offsets = [0];
  const chunks = ["%PDF-1.4\n"];
  for (const object of objects) {
    offsets.push(offset);
    chunks.push(`${object}\n`);
    offset += object.length + 1;
  }
  const xrefStart = offset;
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (const value of offsets.slice(1)) {
    xref.push(`${String(value).padStart(10, "0")} 00000 n `);
  }
  const xrefBlock = `${xref.join("\n")}\n`;
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  const encoder = new TextEncoder();
  return encoder.encode(chunks.join("") + xrefBlock + trailer);
}

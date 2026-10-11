import assert from "node:assert/strict";
import { test } from "node:test";
import { billLines, billWhatsAppText, buildBillPdf, whatsappPhone, whatsappShareUrl } from "./billPdf.ts";

const sample = {
  shopName: "MadWits",
  jobNumber: "MW-20261011-ABCDEF12",
  title: "Shop board",
  stationeryName: "Banner Printing",
  customerName: "Ravi",
  customerPhone: "9876543210",
  quantity: 2,
  amount: "₹1,200.00",
  paid: "₹200.00",
  balance: "₹1,000.00",
  issuedOn: "11 Oct 2026",
};

test("bill includes stationery name, price and customer", () => {
  const lines = billLines(sample);
  assert.match(lines.join("\n"), /Banner Printing/);
  assert.match(lines.join("\n"), /₹1,200.00/);
  assert.match(lines.join("\n"), /Ravi/);
});

test("whatsapp text is a short bill summary", () => {
  const text = billWhatsAppText(sample);
  assert.match(text, /MadWits bill/);
  assert.match(text, /Banner Printing/);
  assert.match(text, /₹1,200.00/);
});

test("indian 10-digit numbers get the 91 country code", () => {
  assert.equal(whatsappPhone("98765 43210"), "919876543210");
  assert.equal(whatsappPhone("+91 98765 43210"), "919876543210");
});

test("whatsapp url opens a chat with the bill text", () => {
  const url = whatsappShareUrl(sample);
  assert.equal(url.startsWith("https://wa.me/919876543210?text="), true);
  assert.match(decodeURIComponent(url), /Banner Printing/);
});

test("pdf bytes look like a PDF", () => {
  const bytes = buildBillPdf(sample);
  const head = new TextDecoder().decode(bytes.slice(0, 8));
  assert.equal(head.startsWith("%PDF-1."), true);
  assert.equal(bytes.length > 200, true);
});

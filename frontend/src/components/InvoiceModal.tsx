import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, Upload, X } from "lucide-react";

import { cashFlowService } from "../services/cashflow";

type InvoiceModalProps = {
  open: boolean;
  sourceLabel: string;
  defaultDescription: string;
  onClose: () => void;
  onCreated?: (message: string) => void;
};

type InvoiceItem = {
  id: string;
  date: string;
  description: string;
  value: string;
};

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDisplayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const localDate = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? new Date(year, month - 1, day) : new Date(value);
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "short" }).format(localDate);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatFlatLabel(value: string) {
  const flatValue = value.trim();
  if (!flatValue) return "Flat / client";
  return /^flat\s+/i.test(flatValue) ? flatValue : `Flat ${flatValue}`;
}

function formatInvoiceNumber(paymentNumber: number) {
  return `Inv-${String(paymentNumber).padStart(4, "0")}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read selected file."));
    reader.readAsDataURL(file);
  });
}

function getMediaKind(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(name)) return "image" as const;
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf" as const;
  return "file" as const;
}

function newInvoiceItem(date = toDateInputValue(new Date())): InvoiceItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date,
    description: "",
    value: "",
  };
}

export function InvoiceModal({ open, sourceLabel, defaultDescription, onClose, onCreated }: InvoiceModalProps) {
  const [invoiceDate, setInvoiceDate] = useState(() => toDateInputValue(new Date()));
  const [to, setTo] = useState("");
  const [flat, setFlat] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>(() => [newInvoiceItem()]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaPreviewKind, setMediaPreviewKind] = useState<"image" | "pdf" | "file">("file");
  const [invoiceNumber, setInvoiceNumber] = useState("Inv-01");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    setInvoiceDate(toDateInputValue(new Date()));
    setTo("");
    setFlat("");
    setItems([newInvoiceItem()]);
    setMediaFile(null);
    setMediaPreviewKind("file");
    setInvoiceNumber("Inv-0001");
    setError(null);
    setSaving(false);
    setMediaPreviewUrl(null);

    void cashFlowService
      .getNextPaymentNumber()
      .then((nextPaymentNumber) => {
        if (cancelled) return;
        setInvoiceNumber(formatInvoiceNumber(nextPaymentNumber));
      })
      .catch(() => {
        if (cancelled) return;
        setInvoiceNumber("Inv-0001");
      });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      cancelled = true;
    };
  }, [defaultDescription, onClose, open]);

  const totalValue = items.reduce((sum, item) => sum + Number(item.value || 0), 0);

  const previewHtml = useMemo(() => {
    const issuedDate = formatDisplayDate(invoiceDate || toDateInputValue(new Date()));
    const toLabel = to.trim() || formatFlatLabel(flat);
    const total = formatCurrency(totalValue);
    const invoiceItems = items.map((item, index) => ({
      itemNumber: index + 1,
      date: formatDisplayDate(item.date || invoiceDate || toDateInputValue(new Date())),
      description: item.description.trim(),
      total: formatCurrency(Number(item.value || 0)),
    }));
    const itemRows = invoiceItems.map((item) => `
        <tr>
          <td class="num">${item.itemNumber}</td>
          <td>${escapeHtml(item.date)}</td>
          <td class="description-cell">${escapeHtml(item.description)}</td>
          <td class="num">${escapeHtml(item.total)}</td>
        </tr>`).join("");
    const mediaMarkup =
      mediaPreviewUrl && mediaPreviewKind === "image"
        ? `<img src="${escapeHtml(mediaPreviewUrl)}" alt="Invoice media" />`
        : mediaPreviewUrl && mediaPreviewKind === "pdf"
          ? `<object data="${escapeHtml(mediaPreviewUrl)}" type="application/pdf" aria-label="Invoice media PDF"><div class="media-note">PDF attached: ${escapeHtml(mediaFile?.name ?? "invoice-media.pdf")}</div></object>`
          : mediaPreviewUrl
            ? `<div class="media-note">File attached: ${escapeHtml(mediaFile?.name ?? "invoice-media")}</div>`
            : `<div class="media-placeholder">Media area<br/>Attach image or PDF</div>`;

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(invoiceNumber)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px;
      font-family: Arial, Helvetica, sans-serif;
      background: #ffffff;
      color: #111111;
    }
    .sheet {
      max-width: 920px;
      margin: 0 auto;
      background: #fff;
    }
    .top {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: start;
      margin-bottom: 28px;
    }
    .brand {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .issuer {
      font-size: 14px;
      color: #333;
      max-width: 280px;
      line-height: 1.4;
    }
    .title {
      text-align: right;
    }
    .title h1 {
      font-size: 22px;
      margin: 0;
      letter-spacing: 0.04em;
    }
    .title .date {
      margin-top: 4px;
      font-size: 14px;
      color: #333;
    }
    .hero {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 24px;
      align-items: start;
      margin: 22px 0 30px;
    }
    .to {
      padding-top: 72px;
      font-size: 14px;
      line-height: 1.45;
    }
    .to strong {
      font-weight: 700;
    }
    .card {
      border-radius: 18px;
      padding: 0;
      min-height: 360px;
      background: linear-gradient(180deg, #dde1d6 0%, #eef0ea 100%);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }
    .card-top {
      display: flex;
      align-items: start;
      justify-content: flex-start;
      gap: 16px;
    }
    .avatar {
      width: 58px;
      height: 58px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: #3c5428;
      color: #fff;
      font-weight: 800;
      font-size: 18px;
      flex: 0 0 auto;
    }
    .meta {
      flex: 1 1 auto;
      min-width: 0;
    }
    .meta p {
      margin: 0;
      color: #2b2b2b;
      font-size: 15px;
      line-height: 1.25;
    }
    .amount {
      font-size: 30px;
      font-weight: 800;
      color: #111;
      line-height: 1;
      margin-top: 10px;
      flex: 0 0 auto;
    }
    .amount-left {
      order: 1;
    }
    .meta {
      order: 2;
    }
    .pill,
    .status {
      margin-top: 18px;
      background: #fff;
      border-radius: 16px;
      padding: 14px 16px;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.04);
    }
    .pill {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .pill .label {
      font-size: 14px;
      font-weight: 700;
    }
    .pill .value {
      font-size: 12px;
      color: #5f5f5f;
    }
    .status strong {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
    }
    .status p {
      margin: 0;
      font-size: 13px;
      color: #5e5e5e;
      line-height: 1.45;
    }
    .media-box {
      width: 100%;
      height: 100%;
      min-height: 360px;
      background: #fff;
      border-radius: 18px;
      padding: 10px;
      border: 1px dashed #8e9687;
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    .media-box img {
      width: 100%;
      height: 100%;
      max-height: 230px;
      object-fit: contain;
      border-radius: 10px;
      background: #f7f8f4;
    }
    .media-box object,
    .media-box iframe {
      width: 100%;
      height: 100%;
      min-height: 330px;
      border: 0;
      border-radius: 10px;
      background: #f7f8f4;
    }
    .media-placeholder,
    .media-note {
      text-align: center;
      font-size: 13px;
      line-height: 1.4;
      color: #545454;
      font-weight: 600;
      padding: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 14px;
      font-size: 14px;
    }
    th,
    td {
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    thead th {
      background: #050505;
      color: #fff;
      text-align: left;
      padding: 10px 12px;
      font-weight: 700;
    }
    tbody td {
      border: 1px solid #222;
      padding: 10px 12px;
      vertical-align: top;
    }
    td.num,
    th.num {
      text-align: right;
      white-space: nowrap;
    }
    .description-cell {
      white-space: normal;
    }
    .due td {
      background: #fff700;
      font-weight: 800;
      border-top: 0;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div></div>
      <div class="title">
        <h1>INVOICE ${escapeHtml(invoiceNumber)}</h1>
        <div class="date">Date: ${escapeHtml(issuedDate)}</div>
      </div>
    </div>

    <div class="hero">
      <div class="to">
        <strong>TO:</strong> ${escapeHtml(toLabel)}<br />
        ${escapeHtml(formatFlatLabel(flat))}
      </div>

      <div class="card">
        <div class="media-box">
          ${mediaMarkup}
        </div>
      </div>
    </div>

    <table>
      <colgroup>
        <col style="width: 12%" />
        <col style="width: 18%" />
        <col style="width: 50%" />
        <col style="width: 20%" />
      </colgroup>
      <thead>
        <tr>
          <th>Item</th>
          <th>Date</th>
          <th>Description</th>
          <th class="num">Total £</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr class="due">
          <td colspan="2" style="border: 0; background: white"></td>
          <td>Total Due:</td>
          <td class="num">${escapeHtml(total)}</td>
        </tr>
      </tbody>
    </table>

  </div>
</body>
</html>`;
  }, [flat, invoiceDate, invoiceNumber, items, mediaFile?.name, mediaPreviewKind, mediaPreviewUrl, to, totalValue]);

  async function handleDownload() {
    const { jsPDF } = await import("jspdf");

    const issuedDate = formatDisplayDate(invoiceDate || toDateInputValue(new Date()));
    const toLabel = to.trim() || formatFlatLabel(flat);
    const total = formatCurrency(totalValue);
    const invoiceItems = items.map((item, index) => ({
      itemNumber: String(index + 1),
      date: formatDisplayDate(item.date || invoiceDate || toDateInputValue(new Date())),
      description: item.description.trim(),
      total: formatCurrency(Number(item.value || 0)),
    }));

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const left = 44;
    const right = pageWidth - 44;
    let y = 52;

    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(24);
    pdf.text(`INVOICE ${invoiceNumber}`, right, y, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(`Date: ${issuedDate}`, right, y + 20, { align: "right" });

    y += 80;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("TO:", left, y);
    pdf.text(toLabel, left + 24, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(formatFlatLabel(flat), left, y + 18);

    const mediaBoxX = right - 260;
    const mediaBoxY = y - 10;
    const mediaBoxWidth = 260;
    const mediaBoxHeight = 170;
    pdf.setDrawColor(142, 150, 135);
    pdf.rect(mediaBoxX, mediaBoxY, mediaBoxWidth, mediaBoxHeight);

    if (mediaPreviewUrl && mediaPreviewKind === "image") {
      const dataUrlMatch = /^data:(image\/[a-zA-Z0-9+.-]+);base64,/.exec(mediaPreviewUrl);
      const imageMime = dataUrlMatch?.[1]?.toLowerCase() ?? "image/png";
      const imageFormat = imageMime.includes("png") ? "PNG" : "JPEG";
      try {
        pdf.addImage(mediaPreviewUrl, imageFormat, mediaBoxX + 4, mediaBoxY + 4, mediaBoxWidth - 8, mediaBoxHeight - 8, undefined, "FAST");
      } catch {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text("Unable to render image", mediaBoxX + 12, mediaBoxY + 22);
      }
    } else if (mediaPreviewUrl && mediaPreviewKind === "pdf") {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("PDF media attached", mediaBoxX + 12, mediaBoxY + 24);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const pdfFileName = mediaFile?.name ?? "attachment.pdf";
      const wrapped = pdf.splitTextToSize(pdfFileName, mediaBoxWidth - 24);
      pdf.text(wrapped, mediaBoxX + 12, mediaBoxY + 44);
    } else {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("Media area", mediaBoxX + 12, mediaBoxY + 24);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text("Attach image or PDF", mediaBoxX + 12, mediaBoxY + 42);
    }

    const toBlockBottomY = y + 18;
    const mediaBlockBottomY = mediaBoxY + mediaBoxHeight;
    const contentBottomY = Math.max(toBlockBottomY, mediaBlockBottomY);

    y = contentBottomY + 22;
    const tableLeft = left;
    const tableWidth = right - left;
    const headers = ["Item", "Date", "Description", "Total £"];
    const widths = [52, 92, tableWidth - 52 - 92 - 110, 110];
    const rowHeight = 28;
    const rowPaddingTop = 18;
    const descriptionLineHeight = 14;

    pdf.setFillColor(5, 5, 5);
    pdf.rect(tableLeft, y, tableWidth, rowHeight, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);

    let x = tableLeft;
    headers.forEach((header, index) => {
      const alignRight = index === 3;
      pdf.text(header, alignRight ? x + widths[index] - 8 : x + 8, y + 18, { align: alignRight ? "right" : "left" });
      x += widths[index];
    });

    y += rowHeight;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal");
    pdf.setDrawColor(30, 30, 30);

    invoiceItems.forEach((item) => {
      const descriptionLines = pdf.splitTextToSize(item.description, widths[2] - 16);
      const dynamicRowHeight = Math.max(
        rowHeight,
        descriptionLines.length * descriptionLineHeight + 12,
      );

      pdf.rect(tableLeft, y, tableWidth, dynamicRowHeight);
      x = tableLeft;
      pdf.line(x + widths[0], y, x + widths[0], y + dynamicRowHeight);
      pdf.line(
        x + widths[0] + widths[1],
        y,
        x + widths[0] + widths[1],
        y + dynamicRowHeight,
      );
      pdf.line(
        x + widths[0] + widths[1] + widths[2],
        y,
        x + widths[0] + widths[1] + widths[2],
        y + dynamicRowHeight,
      );

      pdf.text(item.itemNumber, x + widths[0] - 8, y + rowPaddingTop, {
        align: "right",
      });
      x += widths[0];

      pdf.text(item.date, x + 8, y + rowPaddingTop);
      x += widths[1];

      pdf.text(descriptionLines, x + 8, y + rowPaddingTop);
      x += widths[2];

      pdf.text(item.total, x + widths[3] - 8, y + rowPaddingTop, {
        align: "right",
      });

      y += dynamicRowHeight;
    });
    const dueLabelWidth = 90;
    const dueValueWidth = widths[3];
    const dueX = tableLeft + tableWidth - dueLabelWidth - dueValueWidth;

    pdf.setFillColor(255, 247, 0);
    pdf.rect(dueX, y, dueLabelWidth + dueValueWidth, rowHeight, "F");
    pdf.rect(dueX, y, dueLabelWidth + dueValueWidth, rowHeight);
    pdf.line(dueX + dueLabelWidth, y, dueX + dueLabelWidth, y + rowHeight);
    pdf.setFont("helvetica", "bold");
    pdf.text("Total Due:", dueX + 8, y + 18);
    pdf.text(total, dueX + dueLabelWidth + dueValueWidth - 8, y + 18, { align: "right" });

    const fileName = `${safeFileName(`invoice-${invoiceNumber}-${flat || sourceLabel}`) || "invoice"}.pdf`;
    pdf.save(fileName);
  }

  async function handleLaunchToCashflow() {
    setError(null);

    const normalizedItems = items.map((item) => ({
      ...item,
      description: item.description.trim(),
      valueNumber: Number(item.value || 0),
    }));
    const normalizedInvoiceNumber = invoiceNumber.trim();

    if (!normalizedInvoiceNumber) {
      setError("Enter an invoice number.");
      return;
    }
    if (normalizedItems.some((item) => !item.description)) {
      setError("Enter a description for every invoice item.");
      return;
    }
    if (normalizedItems.length === 0 || totalValue <= 0 || normalizedItems.some((item) => item.valueNumber <= 0)) {
      setError("Enter a valid invoice value.");
      return;
    }
    if (!mediaFile) {
      setError("Select a media file to attach to the cashflow record.");
      return;
    }

    setSaving(true);
    try {
      const cashflowValue = (-Math.abs(totalValue)).toFixed(2);
      const created = await cashFlowService.create({
        invoice: "Yes",
        date: invoiceDate,
        value: cashflowValue,
        description: normalizedItems.map((item) => item.description).join("; "),
        flat: flat.trim() || undefined,
        invoiceMedia: mediaFile
      });
      onCreated?.(`Invoice ${normalizedInvoiceNumber} sent to cashflow successfully. Cashflow record #${created.payment_number}.`);
      onClose();
    } catch (requestError) {
      const message = (requestError as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(message ?? "Unable to send invoice to cashflow.");
    } finally {
      setSaving(false);
    }
  }

  function addItem() {
    setItems((current) => [...current, newInvoiceItem(invoiceDate || toDateInputValue(new Date()))]);
  }

  function updateItem(id: string, patch: Partial<InvoiceItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setItems((current) => (current.length > 1 ? current.filter((item) => item.id !== id) : current));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
      <article className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-3xl border border-oak-border bg-white shadow-oakLg">
        <header className="flex items-center justify-between gap-4 border-b border-oak-border px-5 py-3 sm:px-6">
          <div>
            <p className="oak-label">Invoice</p>
            <h2 className="text-xl font-extrabold text-oak-coffee">{sourceLabel}</h2>
          </div>
          <button className="grid size-10 place-items-center rounded-xl border border-oak-border" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="grid max-h-[calc(92vh-73px)] min-h-0 gap-0 xl:grid-cols-[390px_minmax(0,1fr)]">
          <form className="grid min-h-0 content-start gap-3 overflow-y-auto border-b border-oak-border p-4 xl:border-b-0 xl:border-r xl:p-4" onSubmit={(event) => event.preventDefault()}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="oak-label">Invoice date</span>
                <input className="oak-input !min-h-10 !px-3 !py-2" type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
              </label>
              <label className="grid gap-1.5">
                <span className="oak-label">Invoice number</span>
                <input className="oak-input !min-h-10 !px-3 !py-2" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
              </label>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="oak-label">TO</span>
                <input className="oak-input !min-h-10 !px-3 !py-2" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="oak-label">Flat / client</span>
                <select className="oak-input !min-h-10 !px-3 !py-2" value={flat} onChange={(event) => setFlat(event.target.value)}>
                  <option value="">Select a flat</option>
                  <option value="50">Flat 50</option>
                  <option value="51">Flat 51</option>
                  <option value="52">Flat 52</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="oak-label">Invoice items</p>
                <button className="oak-button-secondary !min-h-9 !px-3 !py-2" type="button" onClick={addItem}>
                  <Plus size={16} />
                  Add item
                </button>
              </div>
              <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div className="grid gap-2 rounded-xl border border-oak-border bg-white p-2.5" key={item.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-extrabold text-oak-coffee">Item {index + 1}</p>
                      <button
                        className="oak-button-secondary !min-h-8 !px-2"
                        disabled={items.length === 1}
                        type="button"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <label className="grid gap-1.5">
                      <span className="oak-label">Date</span>
                      <input className="oak-input !min-h-10 !px-3 !py-2" type="date" value={item.date} onChange={(event) => updateItem(item.id, { date: event.target.value })} />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="oak-label">Description</span>
                      <input className="oak-input !min-h-10 !px-3 !py-2" value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="oak-label">Total</span>
                      <input className="oak-input !min-h-10 !px-3 !py-2" min="0" step="0.01" type="number" value={item.value} onChange={(event) => updateItem(item.id, { value: event.target.value })} />
                    </label>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-oak-panel p-2.5 text-sm font-extrabold text-oak-coffee">
                Invoice total: {formatCurrency(totalValue)}
              </div>
            </div>

            <label className="grid gap-1.5">
              <span className="oak-label">Media</span>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-oak-border bg-oak-panel/50 px-3 py-3 text-sm font-semibold text-oak-coffee">
                <Upload size={18} />
                <span>{mediaFile ? mediaFile.name : "Choose image or PDF"}</span>
                <input
                  className="hidden"
                  accept="image/*,.jpg,.jpeg,.png,.pdf,application/pdf"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setMediaFile(file);
                    setMediaPreviewUrl(null);
                    setError(null);
                    if (!file) return;

                    setMediaPreviewKind(getMediaKind(file));

                    void fileToDataUrl(file)
                      .then((dataUrl) => {
                        setMediaPreviewUrl(dataUrl);
                      })
                      .catch(() => {
                        setMediaPreviewUrl(null);
                        setError("Unable to preview selected media.");
                      });
                  }}
                />
              </label>
            </label>

            {mediaFile ? (
              <div className="rounded-xl border border-oak-border bg-white p-2.5">
                <p className="oak-label mb-1.5">Media preview</p>
                {mediaPreviewKind === "image" && mediaPreviewUrl ? (
                  <img alt="Invoice media preview" className="max-h-32 w-full rounded-xl object-contain" src={mediaPreviewUrl} />
                ) : mediaPreviewKind === "pdf" && mediaPreviewUrl ? (
                  <object aria-label="Invoice media PDF preview" className="h-32 w-full rounded-xl border border-oak-border" data={mediaPreviewUrl} type="application/pdf">
                    <div className="rounded-xl bg-oak-panel p-4 text-sm font-semibold text-oak-coffee">{mediaFile.name}</div>
                  </object>
                ) : (
                  <div className="rounded-xl bg-oak-panel p-4 text-sm font-semibold text-oak-coffee">
                    {mediaFile.name}
                  </div>
                )}
              </div>
            ) : null}

            <div className="sticky bottom-0 -mx-4 grid gap-3 border-t border-oak-border bg-white/95 px-4 py-3 backdrop-blur sm:grid-cols-2">
              <button className="oak-button-secondary !min-h-9 !py-2" type="button" onClick={() => void handleDownload()}>
                <Download size={16} />
                Download
              </button>
              <button className="oak-button-primary !min-h-9 !py-2" type="button" disabled={saving} onClick={() => void handleLaunchToCashflow()}>
                {saving ? "Sending..." : "Launch to cashflow"}
              </button>
            </div>

            {error ? <div className="rounded-xl border border-oak-danger/30 bg-oak-dangerBg p-3 text-sm font-bold text-oak-danger">{error}</div> : null}
          </form>

          <div className="grid min-h-0 gap-0 bg-[#f7f5f1] p-4 sm:p-5">
            <div className="overflow-hidden rounded-3xl border border-oak-border bg-white shadow-oak">
              <iframe
                className="h-[calc(92vh-130px)] min-h-[520px] w-full bg-white"
                sandbox="allow-same-origin"
                srcDoc={previewHtml}
                title="Invoice preview"
              />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

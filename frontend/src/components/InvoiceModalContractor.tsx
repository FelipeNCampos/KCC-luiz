import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, Upload, X } from "lucide-react";

import { type CashFlowScope, type SystemInvoiceData, cashFlowService } from "../services/cashflow";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";

type InvoiceModalProps = {
  open: boolean;
  sourceLabel: string;
  defaultDescription: string;
  onClose: () => void;
  onCreated?: (message: string) => void;
  editingRecordId?: number;
  editingScope?: CashFlowScope;
  editingDraft?: SystemInvoiceData;
  onUpdated?: (message: string) => void;
};

type InvoicePricingMode = "per_item" | "invoice_total";

type InvoiceItem = {
  id: string;
  date: string;
  description: string;
  total: string;
};

type MediaKind = "image" | "pdf" | "file";

type PreparedInvoiceItem = {
  id: string;
  dateLabel: string;
  description: string;
  totalNumber: number;
  amountLabel: string;
};

type InvoiceDocumentData = {
  invoiceNumber: string;
  title: string;
  pricingMode: InvoicePricingMode;
  issuedDate: string;
  dueDate: string;
  terms: string;
  invoiceToLines: string[];
  totalValue: number;
  totalLabel: string;
  items: PreparedInvoiceItem[];
  bankDetails: Array<{ label: string; value: string }>;
};

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDisplayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const localDate =
    Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
      ? new Date(year, month - 1, day)
      : new Date(value);

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

function formatSingleFlatLabel(value: string) {
  const flatValue = value.trim();
  if (!flatValue) return "";
  return /^flat\s+/i.test(flatValue) ? flatValue : `Flat ${flatValue}`;
}

function formatFlatLabels(values: string[]) {
  if (!values.length) return "Flat / client";
  return values.map(formatSingleFlatLabel).join(", ");
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

function getMediaKind(file: File): MediaKind {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(name)) return "image";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  return "file";
}

function splitMultiline(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getItemTotal(item: InvoiceItem) {
  return normalizeNumber(item.total);
}

function newInvoiceItem(date = toDateInputValue(new Date()), description = ""): InvoiceItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date,
    description,
    total: "",
  };
}

function draftString(draft: SystemInvoiceData | undefined, key: string, fallback = "") {
  const value = draft?.[key];
  return typeof value === "string" ? value : fallback;
}

function draftFlats(draft: SystemInvoiceData | undefined) {
  const values = draft?.flat;
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : [];
}

function draftItems(
  draft: SystemInvoiceData | undefined,
  fallbackDate: string,
  defaultDescription: string,
): InvoiceItem[] {
  const values = draft?.items;
  if (!Array.isArray(values)) return [newInvoiceItem(fallbackDate, defaultDescription)];

  const items = values.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    return [{
      id: typeof item.id === "string" ? item.id : `item-${index}`,
      date: typeof item.date === "string" ? item.date : fallbackDate,
      description: typeof item.description === "string" ? item.description : "",
      total: typeof item.total === "string" ? item.total : "",
    }];
  });
  return items.length ? items : [newInvoiceItem(fallbackDate, defaultDescription)];
}

function buildInvoiceDocumentData(params: {
  invoiceDate: string;
  invoiceNumber: string;
  title: string;
  to: string;
  flat: string[];
  items: InvoiceItem[];
  totalValue: number;
  pricingMode: InvoicePricingMode;
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  bankReference: string;
}) {
  const fallbackDate = params.invoiceDate || toDateInputValue(new Date());
  const flatLabel = formatFlatLabels(params.flat);
  const toLines = splitMultiline(params.to);
  const invoiceToLines = toLines.length ? [...toLines, ...(params.flat.length ? [flatLabel] : [])] : [flatLabel];

  const items: PreparedInvoiceItem[] = params.items.map((item) => {
    const totalNumber = normalizeNumber(item.total);

    return {
      id: item.id,
      dateLabel: formatDisplayDate(item.date || fallbackDate),
      description: item.description.trim(),
      totalNumber,
      amountLabel: formatCurrency(totalNumber),
    };
  });

  const bankDetails = [
    { label: "Account name", value: params.bankAccountName.trim() || "-" },
    { label: "Sort code", value: params.bankSortCode.trim() || "-" },
    { label: "Account number", value: params.bankAccountNumber.trim() || "-" },
    { label: "Reference", value: params.bankReference.trim() || "-" },
  ];

  const formattedDate = formatDisplayDate(fallbackDate);

  return {
    invoiceNumber: params.invoiceNumber.trim() || "Inv-0000",
    title: params.title.trim(),
    pricingMode: params.pricingMode,
    issuedDate: formattedDate,
    dueDate: formattedDate,
    terms: "Due on receipt",
    invoiceToLines,
    totalValue: params.totalValue,
    totalLabel: formatCurrency(params.totalValue),
    items,
    bankDetails,
  } satisfies InvoiceDocumentData;
}

function buildPreviewHtml(params: {
  documentData: InvoiceDocumentData;
  mediaPreviewUrl: string | null;
  mediaPreviewKind: MediaKind;
  mediaFileName: string | null;
}) {
  const { documentData, mediaPreviewUrl, mediaPreviewKind, mediaFileName } = params;
  const showItemAmounts = documentData.pricingMode === "per_item";
  const titleMarkup = documentData.title ? `<div class="invoice-title">${escapeHtml(documentData.title)}</div>` : "";

  const tableRows = documentData.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.dateLabel)}</td>
          <td>${item.description ? escapeHtml(item.description) : "&nbsp;"}</td>
          ${showItemAmounts ? `<td class="num">${escapeHtml(item.amountLabel)}</td>` : ""}
        </tr>
      `
    )
    .join("");

  const tableColumns = showItemAmounts
    ? `
        <col style="width: 20%" />
        <col style="width: 58%" />
        <col style="width: 22%" />
      `
    : `
        <col style="width: 20%" />
        <col style="width: 80%" />
      `;

  const tableHeadMarkup = showItemAmounts
    ? `
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th class="num">Amount</th>
        </tr>
      `
    : `
        <tr>
          <th>Date</th>
          <th>Description</th>
        </tr>
      `;

  const bankDetailsMarkup = documentData.bankDetails
    .map(
      (detail) => `
        <div class="bank-row">
          <span class="bank-label">${escapeHtml(detail.label)}</span>
          <span class="bank-value">${escapeHtml(detail.value)}</span>
        </div>
      `
    )
    .join("");

  const mediaBodyMarkup =
    mediaPreviewUrl && mediaPreviewKind === "image"
      ? `<img src="${escapeHtml(mediaPreviewUrl)}" alt="Invoice media" />`
      : mediaPreviewUrl && mediaPreviewKind === "pdf"
        ? `<object data="${escapeHtml(mediaPreviewUrl)}" type="application/pdf" aria-label="Invoice media PDF"><div class="media-note">PDF attached<br />${escapeHtml(mediaFileName ?? "attachment.pdf")}</div></object>`
        : mediaPreviewUrl
          ? `<div class="media-note">File attached<br />${escapeHtml(mediaFileName ?? "attachment")}</div>`
          : `<div class="media-placeholder">Media area<br />Attach image or PDF</div>`;

  const mediaMarkup = mediaBodyMarkup;

  const invoiceToMarkup = documentData.invoiceToLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(documentData.invoiceNumber)}</title>
  <style>
    :root {
      color-scheme: light;
      --accent: #2563a6;
      --accent-dark: #1f4e86;
      --line: #d8e1ea;
      --text: #0f1720;
      --muted: #5a6776;
      --panel: #f5f8fb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f1f5f9;
      font-family: Arial, Helvetica, sans-serif;
      color: var(--text);
    }
    .page {
      max-width: 980px;
      min-height: 100vh;
      margin: 0 auto;
      background: #fff;
      padding: 34px 36px 30px;
    }
    .top {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 0.95fr);
      gap: 20px;
      align-items: stretch;
    }
    .top-box {
      min-height: 168px;
      overflow: hidden;
    }
    .invoice-to-box {
      padding: 16px 18px;
      background: #fff;
    }
    .invoice-to-label {
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.14em;
      margin-bottom: 10px;
      text-transform: uppercase;
    }
    .invoice-to-body {
      min-height: 116px;
      font-size: 15px;
      line-height: 1.7;
      white-space: normal;
    }
    .meta-panel {
      display: flex;
      flex-direction: column;
      background: var(--panel);
    }
    .meta-row {
      display: grid;
      grid-template-columns: 108px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
      padding: 15px 18px;
    }
    .meta-inline-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent-dark);
    }
    .meta-inline-value {
      font-size: 9px;
      font-weight: 700;
      line-height: 1.25;
      text-align: right;
      overflow-wrap: anywhere;
    }
    .meta-inline-value-invoice {
      display: block;
      font-size: 10px;
      text-align: center;
    }
    .invoice-title {
      margin-top: 22px;
      width: 80%;
      margin-left: 20%;
      padding-left: 10px;
      color: var(--text);
      font-size: 10.67px;
      font-weight: 700;
      line-height: 1.4;
      text-align: left;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 13px;
      margin-top: 22px;
    }
    .invoice-title + table {
      margin-top: 10px;
    }
    thead th {
      background: var(--accent);
      color: #fff;
      text-align: left;
      padding: 12px 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    tbody tr:nth-child(odd) td {
      background: #f6f8fb;
    }
    tbody td {
      padding: 12px 10px;
      vertical-align: top;
      color: var(--text);
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .total-due {
      width: 100%;
      border-top: 4px solid var(--accent);
      padding: 14px 16px;
      background: var(--panel);
    }
    .total-due-label {
      color: var(--accent);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .total-due-value {
      margin-top: 8px;
      font-size: 28px;
      font-weight: 800;
      text-align: right;
    }
    .bottom {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-top: 18px;
      align-items: start;
    }
    .bottom-side {
      display: grid;
      gap: 18px;
      align-items: start;
    }
    .bottom-box {
      min-height: 220px;
      background: #fff;
    }
    .bank-box {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 18px;
      background: var(--panel);
      text-align: left;
    }
    .bank-title {
      color: var(--accent);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      margin-bottom: 14px;
      text-align: center;
      text-transform: uppercase;
    }
    .bank-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: baseline;
      font-size: 13px;
      line-height: 1.5;
    }
    .bank-row + .bank-row {
      margin-top: 8px;
    }
    .bank-label {
      display: inline;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .bank-value {
      display: inline;
      margin-top: 0;
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
      overflow-wrap: anywhere;
    }
    .media-box {
      display: grid;
      place-items: center;
      min-height: 300px;
      padding: 0;
      background: #fbfdff;
      overflow: hidden;
    }
    .media-box img,
    .media-box object {
      width: 100%;
      height: 100%;
      min-height: 300px;
      object-fit: contain;
      border: 0;
      background: #fff;
    }
    .media-placeholder,
    .media-note {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      text-align: center;
      font-size: 13px;
      line-height: 1.5;
      font-weight: 600;
      color: var(--muted);
      padding: 14px;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div class="top-box invoice-to-box">
        <div class="invoice-to-label">Invoice To</div>
        <div class="invoice-to-body">${invoiceToMarkup}</div>
      </div>

      <div class="top-box meta-panel">
        <div class="meta-row" style="display:block;text-align:center;">
          <span class="meta-inline-value meta-inline-value-invoice">${escapeHtml(documentData.invoiceNumber)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-inline-label">Date :</span>
          <span class="meta-inline-value">${escapeHtml(documentData.issuedDate)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-inline-label">Terms :</span>
          <span class="meta-inline-value">${escapeHtml(documentData.terms)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-inline-label">Due date :</span>
          <span class="meta-inline-value">${escapeHtml(documentData.dueDate)}</span>
        </div>
      </div>
    </div>

    ${titleMarkup}
    <table>
      <colgroup>
        ${tableColumns}
      </colgroup>
      <thead>
        ${tableHeadMarkup}
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <div class="bottom">
      <div class="bottom-box media-box">
        ${mediaMarkup}
      </div>
      <div class="bottom-side">
        <div class="total-due">
          <div class="total-due-label">Total Due</div>
          <div class="total-due-value">${escapeHtml(documentData.totalLabel)}</div>
        </div>
        <div class="bottom-box bank-box">
          <div class="bank-title">Bank Details</div>
          ${bankDetailsMarkup}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function InvoiceModalContractor({
  open,
  sourceLabel,
  defaultDescription,
  onClose,
  onCreated,
  editingRecordId,
  editingScope,
  editingDraft,
  onUpdated,
}: InvoiceModalProps) {
  const [invoiceDate, setInvoiceDate] = useState(() => toDateInputValue(new Date()));
  const [to, setTo] = useState("");
  const [flat, setFlat] = useState<string[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>(() => [newInvoiceItem(toDateInputValue(new Date()), defaultDescription)]);
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankSortCode, setBankSortCode] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaPreviewKind, setMediaPreviewKind] = useState<MediaKind>("file");
  const [invoiceNumber, setInvoiceNumber] = useState("Inv-0001");
  const [title, setTitle] = useState("");
  const [pricingMode, setPricingMode] = useState<InvoicePricingMode>("per_item");
  const [invoiceTotalInput, setInvoiceTotalInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const flatOptions = ["50", "51", "52"];

  function toggleFlat(value: string, checked: boolean) {
    setFlat((current) =>
      checked ? (current.includes(value) ? current : [...current, value]) : current.filter((item) => item !== value)
    );
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    const nextDate = draftString(editingDraft, "invoiceDate", toDateInputValue(new Date()));
    setInvoiceDate(nextDate);
    setTo(draftString(editingDraft, "to"));
    setFlat(draftFlats(editingDraft));
    setItems(draftItems(editingDraft, nextDate, defaultDescription));
    setBankAccountName(draftString(editingDraft, "bankAccountName"));
    setBankSortCode(draftString(editingDraft, "bankSortCode"));
    setBankAccountNumber(draftString(editingDraft, "bankAccountNumber"));
    setBankReference(draftString(editingDraft, "bankReference"));
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setMediaPreviewKind("file");
    setInvoiceNumber(draftString(editingDraft, "invoiceNumber", "Inv-0001"));
    setTitle(draftString(editingDraft, "title"));
    setPricingMode(draftString(editingDraft, "pricingMode", "per_item") === "invoice_total" ? "invoice_total" : "per_item");
    setInvoiceTotalInput(draftString(editingDraft, "invoiceTotalInput"));
    setError(null);
    setSaving(false);

    if (editingRecordId !== undefined) {
      return () => {
        cancelled = true;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }

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
      cancelled = true;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [defaultDescription, editingDraft, editingRecordId, onClose, open]);

  const totalValue = useMemo(
    () => (pricingMode === "per_item" ? items.reduce((sum, item) => sum + getItemTotal(item), 0) : normalizeNumber(invoiceTotalInput)),
    [invoiceTotalInput, items, pricingMode]
  );

  const documentData = useMemo(
    () =>
      buildInvoiceDocumentData({
        invoiceDate,
        invoiceNumber,
        title,
        to,
        flat,
        items,
        totalValue,
        pricingMode,
        bankAccountName,
        bankSortCode,
        bankAccountNumber,
        bankReference,
      }),
    [bankAccountName, bankAccountNumber, bankReference, bankSortCode, flat, invoiceDate, invoiceNumber, items, pricingMode, title, to, totalValue]
  );

  const previewHtml = useMemo(
    () =>
      buildPreviewHtml({
        documentData,
        mediaPreviewUrl,
        mediaPreviewKind,
        mediaFileName: mediaFile?.name ?? null,
      }),
    [documentData, mediaFile?.name, mediaPreviewKind, mediaPreviewUrl]
  );

  function addItem() {
    setItems((current) => [...current, newInvoiceItem(invoiceDate || toDateInputValue(new Date()))]);
  }

  function updateItem(id: string, patch: Partial<InvoiceItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setItems((current) => (current.length > 1 ? current.filter((item) => item.id !== id) : current));
  }

  function handleMediaChange(file: File | null) {
    setMediaFile(file);
    setMediaPreviewUrl(null);
    const nextMediaKind = file ? getMediaKind(file) : "file";
    setMediaPreviewKind(nextMediaKind);
    setError(null);

    if (!file) return;

    const previewPromise =
      nextMediaKind === "pdf" ? renderPdfFirstPageToDataUrl(file) : fileToDataUrl(file);

    void previewPromise
      .then((dataUrl) => {
        setMediaPreviewUrl(dataUrl);
        if (nextMediaKind === "pdf") {
          setMediaPreviewKind("image");
        }
      })
      .catch(() => {
        setMediaPreviewUrl(null);
        setError("Unable to preview selected media.");
      });
  }

  async function buildInvoicePdf() {
    const { jsPDF } = await import("jspdf");

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 42;
    const rightEdge = pageWidth - margin;
    const contentWidth = pageWidth - margin * 2;
    const accent = [37, 99, 166] as const;
    const accentDark = [29, 78, 137] as const;
    const lineColor = [216, 225, 234] as const;
    const panelColor = [245, 248, 251] as const;
    let y = 46;

    const showItemAmounts = documentData.pricingMode === "per_item";
    const topGap = 18;
    const metaWidth = 280;
    const metaX = rightEdge - metaWidth;
    const toWidth = contentWidth - metaWidth - topGap;
    const topPadding = 16;
    const metaLabelWidth = 84;

    const invoiceToText = documentData.invoiceToLines.join("\n");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    const invoiceToLines = pdf.splitTextToSize(invoiceToText, toWidth - topPadding * 2);
    const toBoxHeight = Math.max(168, 24 + invoiceToLines.length * 16 + topPadding * 2);

    const metaRows = [
      { label: "", value: documentData.invoiceNumber, valueOnly: true, centered: true, invoiceNumber: true },
      { label: "Date :", value: documentData.issuedDate, valueOnly: false, centered: false, invoiceNumber: false },
      { label: "Terms :", value: documentData.terms, valueOnly: false, centered: false, invoiceNumber: false },
      { label: "Due date :", value: documentData.dueDate, valueOnly: false, centered: false, invoiceNumber: false },
    ];

    const metaRowsWithLayout = metaRows.map((row) => {
      const availableWidth = row.valueOnly ? metaWidth - topPadding * 2 : metaWidth - topPadding * 2 - metaLabelWidth - 12;
      const lines = pdf.splitTextToSize(String(row.value), availableWidth);
      const height = Math.max(row.valueOnly ? 28 : 30, lines.length * 13 + 14);

      return { ...row, lines, height };
    });

    const metaContentHeight = metaRowsWithLayout.reduce((sum, row) => sum + row.height, 0);
    const topBlockHeight = Math.max(toBoxHeight, metaContentHeight);

    pdf.setFillColor(255, 255, 255);
    pdf.rect(margin, y, toWidth, topBlockHeight, "F");
    pdf.setTextColor(...accent);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("INVOICE TO", margin + topPadding, y + topPadding);

    pdf.setTextColor(15, 23, 32);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(invoiceToLines, margin + topPadding, y + topPadding + 22);

    pdf.setFillColor(...panelColor);
    pdf.rect(metaX, y, metaWidth, topBlockHeight, "F");

    let metaRowY = y;
    metaRowsWithLayout.forEach((row, index) => {
      if (row.valueOnly) {
        pdf.setFillColor(238, 244, 250);
        pdf.rect(metaX, metaRowY, metaWidth, row.height, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(row.invoiceNumber ? 10 : 8);
        pdf.setTextColor(15, 23, 32);
        pdf.text(row.lines, row.centered ? metaX + metaWidth / 2 : metaX + metaWidth - topPadding, metaRowY + 18, {
          align: row.centered ? "center" : "right",
        });
      } else {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(...accentDark);
        pdf.text(row.label.toUpperCase(), metaX + topPadding, metaRowY + 17);
        pdf.setFontSize(index === 0 ? 6 : 8);
        pdf.setTextColor(15, 23, 32);
        pdf.text(row.lines, metaX + metaWidth - topPadding, metaRowY + 18, { align: "right" });
      }

      metaRowY += row.height;
    });

    y += topBlockHeight + 22;

    const tableHeaders = showItemAmounts ? ["DATE", "DESCRIPTION", "AMOUNT"] : ["DATE", "DESCRIPTION"];
    const columnWidths = showItemAmounts ? [94, 288, contentWidth - 94 - 288] : [94, contentWidth - 94];
    const headerHeight = 32;
    const rowLineHeight = 13;

    if (documentData.title) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.67);
      pdf.setTextColor(15, 23, 32);
      pdf.text(documentData.title, margin + columnWidths[0] + 8, y + 14, { align: "left" });
      y += 26;
    }

    function drawTableHeader(top: number) {
      let x = margin;

      pdf.setFillColor(...accentDark);
      pdf.rect(margin, top, contentWidth, headerHeight, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);

      tableHeaders.forEach((header, index) => {
        const isNumeric = showItemAmounts && index === 2;
        pdf.text(header, isNumeric ? x + columnWidths[index] - 8 : x + 8, top + 20, {
          align: isNumeric ? "right" : "left",
        });
        x += columnWidths[index];
      });
    }

    function ensureSpace(requiredHeight: number, repeatHeader = false) {
      if (y + requiredHeight <= pageHeight - margin) return;
      pdf.addPage();
      y = margin;
      if (repeatHeader) {
        drawTableHeader(y);
        y += headerHeight;
      }
    }

    drawTableHeader(y);
    y += headerHeight;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 32);
    pdf.setDrawColor(...lineColor);

    documentData.items.forEach((item) => {
      const descriptionLines = pdf.splitTextToSize(item.description || " ", columnWidths[1] - 16);
      const rowHeight = Math.max(30, descriptionLines.length * rowLineHeight + 12);

      ensureSpace(rowHeight, true);

      let x = margin;

      x = margin;
      pdf.text(String(item.dateLabel), x + 8, y + 18);
      x += columnWidths[0];

      pdf.text(descriptionLines, x + 8, y + 18, { align: "left" });
      x += columnWidths[1];

      if (showItemAmounts) {
        pdf.text(String(item.amountLabel), x + columnWidths[2] - 8, y + 18, { align: "right" });
      }
      y += rowHeight;
    });

    const boxGap = 16;
    const boxWidth = (contentWidth - boxGap) / 2;
    const totalBoxWidth = boxWidth;
    const totalBoxHeight = 58;
    const bankBoxHeight = 220;
    const mediaBoxHeight = 300;
    const stackGap = 16;
    const mediaBoxX = margin;
    const rightColumnX = mediaBoxX + boxWidth + boxGap;
    const totalX = rightColumnX;

    y += 18;
    ensureSpace(Math.max(mediaBoxHeight, totalBoxHeight + stackGap + bankBoxHeight));
    pdf.setFillColor(...panelColor);
    pdf.rect(totalX, y, totalBoxWidth, totalBoxHeight, "F");
    pdf.setFillColor(...accent);
    pdf.rect(totalX, y, totalBoxWidth, 6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...accentDark);
    pdf.text("TOTAL DUE", totalX + 14, y + 22);
    pdf.setFontSize(22);
    pdf.setTextColor(15, 23, 32);
    pdf.text(String(documentData.totalLabel), totalX + totalBoxWidth - 14, y + 42, { align: "right" });

    const cardsY = y;
    const bankBoxX = rightColumnX;
    const bankBoxY = cardsY + totalBoxHeight + stackGap;

    pdf.setFillColor(...panelColor);
    pdf.rect(bankBoxX, bankBoxY, boxWidth, bankBoxHeight, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...accentDark);
    pdf.text("BANK DETAILS", bankBoxX + boxWidth / 2, bankBoxY + 24, { align: "center" });
    pdf.setTextColor(15, 23, 32);

    let bankY = bankBoxY + 48;
    documentData.bankDetails.forEach((detail) => {
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 32);
      pdf.setFontSize(10);
      const detailLines = pdf.splitTextToSize(`${detail.label} ${detail.value}`, boxWidth - 32);
      pdf.text(detailLines, bankBoxX + 16, bankY);
      bankY += detailLines.length * 12 + 8;
    });

    pdf.setFillColor(251, 253, 255);
    pdf.rect(mediaBoxX, cardsY, boxWidth, mediaBoxHeight, "F");
    const mediaBodyTop = cardsY;
    const mediaBodyHeight = mediaBoxHeight;

    if (mediaPreviewUrl && mediaPreviewKind === "image") {
      const dataUrlMatch = /^data:(image\/[a-zA-Z0-9+.-]+);base64,/.exec(mediaPreviewUrl);
      const imageMime = dataUrlMatch?.[1]?.toLowerCase() ?? "image/png";
      const imageFormat = imageMime.includes("png") ? "PNG" : imageMime.includes("jpg") || imageMime.includes("jpeg") ? "JPEG" : "PNG";

      try {
        const properties = pdf.getImageProperties(mediaPreviewUrl);
        const availableWidth = boxWidth - 16;
        const availableHeight = mediaBodyHeight - 16;
        const widthRatio = availableWidth / properties.width;
        const heightRatio = availableHeight / properties.height;
        const ratio = Math.min(widthRatio, heightRatio);
        const renderWidth = properties.width * ratio;
        const renderHeight = properties.height * ratio;
        const imageX = mediaBoxX + (boxWidth - renderWidth) / 2;
        const imageY = mediaBodyTop + (mediaBodyHeight - renderHeight) / 2;

        pdf.addImage(mediaPreviewUrl, imageFormat, imageX, imageY, renderWidth, renderHeight, undefined, "FAST");
      } catch {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(90, 103, 118);
        pdf.text("Unable to render image", mediaBoxX + boxWidth / 2, mediaBodyTop + mediaBodyHeight / 2 - 4, { align: "center" });
      }
    } else if (mediaFile && mediaPreviewKind === "pdf") {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(90, 103, 118);
      pdf.text("PDF attached", mediaBoxX + boxWidth / 2, mediaBodyTop + mediaBodyHeight / 2 - 10, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const fileNameLines = pdf.splitTextToSize(mediaFile.name, boxWidth - 24);
      pdf.text(fileNameLines, mediaBoxX + boxWidth / 2, mediaBodyTop + mediaBodyHeight / 2 + 12, { align: "center" });
    } else if (mediaFile) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(90, 103, 118);
      pdf.text("File attached", mediaBoxX + boxWidth / 2, mediaBodyTop + mediaBodyHeight / 2 - 10, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const fileNameLines = pdf.splitTextToSize(mediaFile.name, boxWidth - 24);
      pdf.text(fileNameLines, mediaBoxX + boxWidth / 2, mediaBodyTop + mediaBodyHeight / 2 + 12, { align: "center" });
    } else {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(90, 103, 118);
      pdf.text("Media area", mediaBoxX + boxWidth / 2, mediaBodyTop + mediaBodyHeight / 2 - 6, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text("Attach image or PDF", mediaBoxX + boxWidth / 2, mediaBodyTop + mediaBodyHeight / 2 + 12, { align: "center" });
    }

    const fileName = `${safeFileName(
      `invoice-${documentData.invoiceNumber}-${flat.length ? flat.join("-") : sourceLabel}`
    ) || "invoice"}.pdf`;
    return {
      file: new File([pdf.output("blob")], fileName, { type: "application/pdf" }),
      fileName,
      pdf,
    };
  }

  async function handleDownload() {
    const { fileName, pdf } = await buildInvoicePdf();
    pdf.save(fileName);
  }

  async function handleLaunchToCashflow(scope: CashFlowScope) {
    setError(null);

    const normalizedItems = items.map((item) => {
      const totalNumber = normalizeNumber(item.total);

      return {
        ...item,
        description: item.description.trim(),
        totalNumber,
      };
    });

    const normalizedInvoiceNumber = invoiceNumber.trim();

    if (!normalizedInvoiceNumber) {
      setError("Enter an invoice number.");
      return;
    }

    if (normalizedItems.some((item) => !item.description)) {
      setError("Enter a description for every invoice item.");
      return;
    }

    if (normalizedItems.length === 0 || totalValue <= 0) {
      setError(pricingMode === "per_item" ? "Enter a valid total for every invoice item." : "Enter a valid invoice total.");
      return;
    }

    if (pricingMode === "per_item" && normalizedItems.some((item) => item.totalNumber <= 0)) {
      setError("Enter a valid total for every invoice item.");
      return;
    }

    setSaving(true);
    try {
      const cashflowValue = (-Math.abs(totalValue)).toFixed(2);
      const invoicePdf = await buildInvoicePdf();
      const cashflowName = scope === "main" ? "Cashflow penthouse" : "Cashflow 52";
      const systemInvoiceData = {
        invoiceDate,
        invoiceNumber: normalizedInvoiceNumber,
        title,
        to,
        flat,
        items,
        bankAccountName,
        bankSortCode,
        bankAccountNumber,
        bankReference,
        pricingMode,
        invoiceTotalInput,
      };
      if (editingRecordId !== undefined) {
        await cashFlowService.updateSystemInvoice(editingRecordId, {
          invoiceNumber: normalizedInvoiceNumber,
          date: invoiceDate,
          value: cashflowValue,
          description: normalizedItems.map((item) => item.description).join("; "),
          flat: flat.length ? flat.join(", ") : undefined,
          invoiceMedia: invoicePdf.file,
          systemInvoiceType: "contractor",
          systemInvoiceData,
        });
        onUpdated?.(`Invoice ${normalizedInvoiceNumber} updated in ${cashflowName} successfully.`);
      } else {
        const created = await cashFlowService.create({
          scope,
          invoice: "Yes",
          invoiceNumber: normalizedInvoiceNumber,
          date: invoiceDate,
          value: cashflowValue,
          description: normalizedItems.map((item) => item.description).join("; "),
          flat: flat.length ? flat.join(", ") : undefined,
          invoiceMedia: invoicePdf.file,
          systemInvoiceType: "contractor",
          systemInvoiceData,
        });
        onCreated?.(`Invoice ${normalizedInvoiceNumber} sent to ${cashflowName} successfully. Cashflow record #${created.payment_number}.`);
      }
      onClose();
    } catch (requestError) {
      const message = (requestError as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(message ?? "Unable to send invoice to cashflow.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
      <article className="flex h-[92vh] max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-oak-border bg-white shadow-oakLg">
        <header className="flex items-center justify-between gap-4 border-b border-oak-border px-5 py-3 sm:px-6">
          <div>
            <p className="oak-label">Invoice</p>
            <h2 className="text-xl font-extrabold text-oak-coffee">{sourceLabel}</h2>
          </div>
          <button className="grid size-10 place-items-center rounded-xl border border-oak-border" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[420px_minmax(0,1fr)]">
          <form
            className="flex min-h-0 flex-col overflow-hidden border-b border-oak-border xl:border-b-0 xl:border-r"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-5">
                <section className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="oak-label">Invoice date</span>
                      <input
                        className="oak-input !min-h-10 !px-3 !py-2"
                        type="date"
                        value={invoiceDate}
                        onChange={(event) => setInvoiceDate(event.target.value)}
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="oak-label">Invoice number</span>
                      <input
                        className="oak-input !min-h-10 !px-3 !py-2"
                        value={invoiceNumber}
                        onChange={(event) => setInvoiceNumber(event.target.value)}
                      />
                    </label>
                  </div>

                  <label className="grid gap-1.5">
                    <span className="oak-label">Title</span>
                    <input
                      className="oak-input !min-h-10 !px-3 !py-2"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="oak-label">Invoice to</span>
                    <textarea
                      className="oak-input min-h-[110px] resize-y !px-3 !py-2"
                      placeholder={"Client name\nAddress line 1\nAddress line 2"}
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                    />
                  </label>

                  <div className="grid gap-1.5">
                    <span className="oak-label">Flats</span>
                    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-oak-border bg-white p-3">
                      {flatOptions.map((value) => {
                        const inputId = `flat-${value}`;

                        return (
                          <label
                            key={value}
                            htmlFor={inputId}
                            className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-oak-coffee"
                          >
                            <input
                              id={inputId}
                              type="checkbox"
                              checked={flat.includes(value)}
                              onChange={(event) => toggleFlat(value, event.target.checked)}
                            />
                            <span>{value}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="oak-label">Bank account name</span>
                      <input
                        className="oak-input !min-h-10 !px-3 !py-2"
                        value={bankAccountName}
                        onChange={(event) => setBankAccountName(event.target.value)}
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="oak-label">Bank sort code</span>
                      <input
                        className="oak-input !min-h-10 !px-3 !py-2"
                        value={bankSortCode}
                        onChange={(event) => setBankSortCode(event.target.value)}
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="oak-label">Bank account number</span>
                      <input
                        className="oak-input !min-h-10 !px-3 !py-2"
                        value={bankAccountNumber}
                        onChange={(event) => setBankAccountNumber(event.target.value)}
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="oak-label">Bank reference</span>
                      <input
                        className="oak-input !min-h-10 !px-3 !py-2"
                        value={bankReference}
                        onChange={(event) => setBankReference(event.target.value)}
                      />
                    </label>
                  </div>
                </section>

                <section className="grid gap-3">
                  <div className="grid gap-2">
                    <span className="oak-label">Pricing mode</span>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-oak-border bg-white px-3 py-3 text-sm font-semibold text-oak-coffee">
                        <input
                          type="radio"
                          name="pricing-mode-contractor"
                          checked={pricingMode === "per_item"}
                          onChange={() => setPricingMode("per_item")}
                        />
                        <span>Value per item</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-oak-border bg-white px-3 py-3 text-sm font-semibold text-oak-coffee">
                        <input
                          type="radio"
                          name="pricing-mode-contractor"
                          checked={pricingMode === "invoice_total"}
                          onChange={() => setPricingMode("invoice_total")}
                        />
                        <span>Total invoice value</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="oak-label">Invoice items</p>
                    <button className="oak-button-secondary !min-h-9 !px-3 !py-2" type="button" onClick={addItem}>
                      <Plus size={16} />
                      Add item
                    </button>
                  </div>

                  <div className="grid gap-3">
                    {items.map((item, index) => (
                      <div className="grid gap-3 rounded-2xl border border-oak-border bg-white p-3" key={item.id}>
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
                          <input
                            className="oak-input !min-h-10 !px-3 !py-2"
                            type="date"
                            value={item.date}
                            onChange={(event) => updateItem(item.id, { date: event.target.value })}
                          />
                        </label>

                        <label className="grid gap-1.5">
                          <span className="oak-label">Description</span>
                          <textarea
                            className="oak-input min-h-[96px] resize-y !px-3 !py-2"
                            value={item.description}
                            onChange={(event) => updateItem(item.id, { description: event.target.value })}
                          />
                        </label>

                        {pricingMode === "per_item" ? (
                          <label className="grid gap-1.5">
                            <span className="oak-label">Total</span>
                            <input
                              className="oak-input !min-h-10 !px-3 !py-2"
                              min="0"
                              step="0.01"
                              type="number"
                              value={item.total}
                              onChange={(event) => updateItem(item.id, { total: event.target.value })}
                            />
                          </label>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {pricingMode === "invoice_total" ? (
                    <label className="grid gap-1.5 rounded-2xl bg-oak-panel p-3">
                      <span className="oak-label">Invoice total</span>
                      <input
                        className="oak-input !min-h-10 !px-3 !py-2"
                        min="0"
                        step="0.01"
                        type="number"
                        value={invoiceTotalInput}
                        onChange={(event) => setInvoiceTotalInput(event.target.value)}
                      />
                    </label>
                  ) : (
                    <div className="rounded-2xl bg-oak-panel p-3 text-sm font-extrabold text-oak-coffee">
                      Invoice total: {formatCurrency(totalValue)}
                    </div>
                  )}
                </section>

                <section className="grid gap-1.5">
                  <span className="oak-label">Media</span>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-oak-border bg-oak-panel/50 px-4 py-4 text-sm font-semibold text-oak-coffee">
                    <Upload size={18} />
                    <span className="min-w-0 truncate">{mediaFile ? mediaFile.name : "Choose image or PDF"}</span>
                    <input
                      className="hidden"
                      accept="image/*,.jpg,.jpeg,.png,.pdf,application/pdf"
                      type="file"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        handleMediaChange(file);
                      }}
                    />
                  </label>
                </section>
              </div>
            </div>

            <div className="shrink-0 border-t border-oak-border bg-white px-4 py-4 sm:px-5">
              <div className="grid gap-3">
                {error ? (
                  <div className="rounded-xl border border-oak-danger/30 bg-oak-dangerBg p-3 text-sm font-bold text-oak-danger">{error}</div>
                ) : null}

                {editingRecordId !== undefined ? (
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <button
                      aria-label="Download invoice"
                      className="oak-button-secondary grid !size-10 !min-h-10 !p-0"
                      title="Download invoice"
                      type="button"
                      onClick={() => void handleDownload()}
                    >
                      <Download size={16} />
                    </button>
                    <button
                      className="oak-button-primary !min-h-10 !py-2"
                      type="button"
                      disabled={saving}
                      onClick={() => void handleLaunchToCashflow(editingScope ?? "main")}
                    >
                      {saving ? "Saving..." : "Save invoice changes"}
                    </button>
                  </div>
                ) : (
                <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-3">
                  <button
                    aria-label="Download invoice"
                    className="oak-button-secondary grid !size-10 !min-h-10 !p-0"
                    title="Download invoice"
                    type="button"
                    onClick={() => void handleDownload()}
                  >
                    <Download size={16} />
                  </button>
                  <button
                    className="oak-button-primary !min-h-10 !py-2"
                    type="button"
                    disabled={saving}
                    onClick={() => void handleLaunchToCashflow("main")}
                  >
                    {saving ? "Sending..." : "Penthouse"}
                  </button>
                  <button
                    className="oak-button-primary !min-h-10 !py-2"
                    type="button"
                    disabled={saving}
                    onClick={() => void handleLaunchToCashflow("cashflow52")}
                  >
                    {saving ? "Sending..." : "52"}
                  </button>
                </div>
                )}
              </div>
            </div>
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

import { FormEvent, useEffect, useState } from "react";
import { AxiosError } from "axios";
import { Copy, EyeOff, Link2, Trash2, X } from "lucide-react";

import { CashFlowScope, CashFlowShareLink, cashFlowService } from "../services/cashflow";

type CashFlowShareLinksPanelProps = {
  scope: CashFlowScope;
  defaultDate: string;
};

function localDateTimeAfter(hours: number) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function CashFlowShareLinksPanel({ scope, defaultDate }: CashFlowShareLinksPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(defaultDate);
  const [dateTo, setDateTo] = useState(defaultDate);
  const [expiresAt, setExpiresAt] = useState(() => localDateTimeAfter(24));
  const [links, setLinks] = useState<CashFlowShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);
  const [hiddenLinkIds, setHiddenLinkIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    cashFlowService
      .listShareLinks(scope)
      .then((items) => {
        if (active) setLinks(items);
      })
      .catch((requestError: AxiosError<{ detail?: string }>) => {
        if (active) setError(requestError.response?.data?.detail ?? "Unable to load share links.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, scope]);

  async function reloadLinks() {
    const items = await cashFlowService.listShareLinks(scope);
    setLinks(items);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFeedback(null);
    if (dateFrom > dateTo) {
      setError("Start date must be before or equal to end date.");
      return;
    }
    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
      setError("Choose a future expiration date and time.");
      return;
    }

    setSaving(true);
    try {
      const link = await cashFlowService.createShareLink({
        scope,
        date_from: dateFrom,
        date_to: dateTo,
        expires_at: expiry.toISOString()
      });
      setFeedback(`Link created. It expires ${formatDateTime(link.expires_at)}.`);
      await reloadLinks();
    } catch (requestError) {
      const axiosError = requestError as AxiosError<{ detail?: string }>;
      setError(axiosError.response?.data?.detail ?? "Unable to create share link.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy(link: CashFlowShareLink) {
    try {
      await copyText(link.share_url);
      setFeedback("Share link copied.");
    } catch {
      setError("Unable to copy the share link. Please copy it manually.");
    }
  }

  async function handleRevoke(link: CashFlowShareLink) {
    if (!window.confirm("Revoke this public share link? People with the URL will no longer have access.")) return;
    setError(null);
    try {
      await cashFlowService.revokeShareLink(link.id);
      setFeedback("Share link revoked.");
      await reloadLinks();
      setExpandedLinkId(null);
    } catch (requestError) {
      const axiosError = requestError as AxiosError<{ detail?: string }>;
      setError(axiosError.response?.data?.detail ?? "Unable to revoke share link.");
    }
  }

  function handleHide(linkId: string) {
    setHiddenLinkIds((current) => new Set(current).add(linkId));
    setExpandedLinkId(null);
  }

  function openPanel() {
    setDateFrom(defaultDate);
    setDateTo(defaultDate);
    setExpiresAt(localDateTimeAfter(24));
    setError(null);
    setFeedback(null);
    setExpandedLinkId(null);
    setIsOpen(true);
  }

  const visibleLinks = links.filter((link) => !hiddenLinkIds.has(link.id));

  return (
    <>
      <button className="oak-button-secondary min-h-12 w-full md:flex-1" type="button" onClick={openPanel}>
        <Link2 size={18} />
        Share link
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4">
          <article className="flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-2xl border border-oak-border bg-white shadow-oakLg">
            <header className="flex items-center justify-between border-b border-oak-border px-6 py-4">
              <div>
                <p className="oak-label">Read-only access</p>
                <h2 className="text-xl font-extrabold text-oak-coffee">Share cashflow</h2>
              </div>
              <button className="grid size-9 place-items-center rounded-lg border border-oak-border" type="button" onClick={() => setIsOpen(false)}>
                <X size={17} />
              </button>
            </header>

            <div className="grid min-h-0 gap-6 overflow-y-auto p-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              <form className="grid content-start gap-4" onSubmit={handleSubmit}>
                <label className="grid gap-2">
                  <span className="oak-label">Start date</span>
                  <input className="oak-input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} required />
                </label>
                <label className="grid gap-2">
                  <span className="oak-label">End date</span>
                  <input className="oak-input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} required />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[24, 24 * 7, 24 * 30].map((hours) => (
                    <button className="oak-button-secondary px-2 text-xs" type="button" key={hours} onClick={() => setExpiresAt(localDateTimeAfter(hours))}>
                      {hours === 24 ? "24h" : `${hours / 24}d`}
                    </button>
                  ))}
                </div>
                <label className="grid gap-2">
                  <span className="oak-label">Expires at</span>
                  <input className="oak-input" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} required />
                </label>
                {error ? <p className="text-sm font-bold text-oak-danger">{error}</p> : null}
                {feedback ? <p className="text-sm font-bold text-emerald-700">{feedback}</p> : null}
                <button className="oak-button-primary" type="submit" disabled={saving}>
                  <Link2 size={17} />
                  {saving ? "Creating..." : "Generate link"}
                </button>
              </form>

              <section className="min-w-0">
                <h3 className="text-lg font-extrabold text-oak-coffee">Manage links</h3>
                <div className="mt-3 grid gap-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_56px] gap-3 px-4 text-center text-[11px] font-bold uppercase text-oak-muted">
                    <span>Period</span>
                    <span>Expires</span>
                    <span>Link</span>
                  </div>
                  {loading ? <p className="rounded-xl border border-oak-border px-4 py-5 text-sm">Loading links...</p> : null}
                  {!loading && visibleLinks.length === 0 ? <p className="rounded-xl border border-oak-border px-4 py-5 text-sm text-black/60">No share links yet.</p> : null}
                  {visibleLinks.map((link) => {
                    const isExpanded = expandedLinkId === link.id;
                    const isRevocable = link.status !== "revoked";
                    const statusClass = link.status === "active"
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-red-200 bg-red-50";

                    return (
                      <article className={`relative rounded-xl border ${statusClass}`} data-testid={`share-link-card-${link.id}`} key={link.id}>
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_56px] gap-3">
                          <button
                            aria-expanded={isExpanded}
                            aria-label={`Link options for ${link.date_from} to ${link.date_to}`}
                            className="col-span-2 grid grid-cols-2 gap-3 px-4 py-3 text-left text-sm font-semibold text-oak-coffee"
                            onClick={() => setExpandedLinkId((current) => current === link.id ? null : link.id)}
                            type="button"
                          >
                            <span>{link.date_from} to {link.date_to}</span>
                            <span>{formatDateTime(link.expires_at)}</span>
                          </button>
                          <button
                            aria-label={`Copy link for ${link.date_from} to ${link.date_to}`}
                            className="grid place-items-center rounded-r-xl text-black transition-colors hover:bg-black hover:text-white"
                            onClick={() => void handleCopy(link)}
                            type="button"
                          >
                            <Copy aria-hidden="true" size={18} strokeWidth={1.75} />
                          </button>
                        </div>
                        {isExpanded ? (
                          <div className="absolute right-0 top-full z-10 mt-1 w-32 rounded-lg bg-black p-1 shadow-lg" role="menu">
                            <button
                              className={`flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-semibold transition-colors hover:bg-white/10 ${isRevocable ? "text-red-400" : "text-white"}`}
                              onClick={() => isRevocable ? void handleRevoke(link) : handleHide(link.id)}
                              role="menuitem"
                              type="button"
                            >
                              {isRevocable ? <Trash2 size={15} /> : <EyeOff size={15} />}
                              {isRevocable ? "Revoke" : "Hide"}
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}

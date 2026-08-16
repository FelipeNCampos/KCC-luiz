import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { CleanerOpenAccess, ContractorVisit, FlatChecklistItem, oakhillService } from "../services/oakhill";
import { closePublicPage } from "../utils/closePublicPage";

type PersonType = "cleaner" | "contractor";
type Operation = "in" | "out";
const FLATS = ["50", "51", "52"];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function GeneralAccessPage() {
  const [personType, setPersonType] = useState<PersonType>("cleaner");
  const [operation, setOperation] = useState<Operation>("in");
  const [cleanerOpen, setCleanerOpen] = useState<CleanerOpenAccess[]>([]);
  const [contractorOpen, setContractorOpen] = useState<ContractorVisit[]>([]);
  const [form, setForm] = useState({ name: "", mobile: "", job_description: "" });
  const [selectedFlats, setSelectedFlats] = useState<string[]>([]);
  const [selectedMobile, setSelectedMobile] = useState("");
  const [checkoutChecklist, setCheckoutChecklist] = useState<FlatChecklistItem[]>([]);
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ mode: Operation; label: string; doorCode?: string | null } | null>(null);

  async function loadOpen() {
    setLoadingOpen(true);
    setError(null);
    try {
      const [cleanerResponse, contractorResponse] = await Promise.all([
        oakhillService.cleanerOpen(),
        oakhillService.contractorOpen(),
      ]);
      setCleanerOpen(cleanerResponse.data);
      setContractorOpen(contractorResponse.data);
    } catch {
      setError("Unable to load open records.");
    } finally {
      setLoadingOpen(false);
    }
  }

  useEffect(() => {
    void loadOpen();
  }, []);

  useEffect(() => {
    function handleCleanerAccessUpdate(event: StorageEvent) {
      if (event.key !== "oakhill-cleaner-access-updated") return;
      setSelectedMobile("");
      setCheckoutChecklist([]);
      setCheckedItemIds([]);
      void loadOpen();
    }

    window.addEventListener("storage", handleCleanerAccessUpdate);
    return () => window.removeEventListener("storage", handleCleanerAccessUpdate);
  }, []);

  useEffect(() => {
    setError(null);
    setSelectedMobile("");
    setSelectedFlats([]);
    setCheckoutChecklist([]);
    setCheckedItemIds([]);
    if (operation === "out") void loadOpen();
  }, [operation, personType]);

  useEffect(() => {
    async function loadCleanerChecklist() {
      if (personType !== "cleaner" || operation !== "out" || !selectedMobile) {
        setCheckoutChecklist([]);
        setCheckedItemIds([]);
        return;
      }
      setLoadingChecklist(true);
      setError(null);
      setCheckedItemIds([]);
      try {
        const response = await oakhillService.cleanerChecklist(selectedMobile);
        setCheckoutChecklist(response.data);
      } catch {
        setCheckoutChecklist([]);
        setError("Unable to load checklist.");
      } finally {
        setLoadingChecklist(false);
      }
    }

    void loadCleanerChecklist();
  }, [operation, personType, selectedMobile]);

  const openOptions = useMemo(() => {
    if (personType === "cleaner") {
      return cleanerOpen.map((item) => ({
        id: item.mobile,
        mobile: item.mobile,
        label: `${item.mobile} - ${item.name}`,
        detail: `${item.building_name} | IN: ${formatDateTime(item.in_at)}`,
      }));
    }
    const visitsByMobile = new Map<string, ContractorVisit[]>();
    contractorOpen.forEach((visit) => {
      visitsByMobile.set(visit.mobile, [...(visitsByMobile.get(visit.mobile) ?? []), visit]);
    });
    return [...visitsByMobile].map(([mobile, visits]) => ({
      id: mobile,
      mobile,
      label: `${mobile} - ${visits[0].name}`,
      detail: `${visits.map((visit) => `Flat ${visit.flat}`).join(", ")} | ${visits[0].job_description} | IN: ${formatDateTime(visits[0].in_at)}`,
    }));
  }, [cleanerOpen, contractorOpen, personType]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (personType === "cleaner" && operation === "in") {
        await oakhillService.cleanerCheckInMany({ name: form.name, mobile: form.mobile, building_ids: selectedFlats });
        setConfirmed({ mode: "in", label: "Cleaner" });
        setForm({ name: "", mobile: "", job_description: "" });
        setSelectedFlats([]);
      }

      if (personType === "cleaner" && operation === "out") {
        await oakhillService.cleanerCheckOut({ mobile: selectedMobile, checked_item_ids: checkedItemIds });
        setConfirmed({ mode: "out", label: "Cleaner" });
      }

      if (personType === "contractor" && operation === "in") {
        const response = await oakhillService.contractorCheckInMany({
          name: form.name,
          company: "Contractor",
          building_ids: selectedFlats,
          job_description: form.job_description,
          mobile: form.mobile,
        });
        const doorCode = response.data.flatMap((item) => item.door_code ? [`Flat ${item.flat}: ${item.door_code}`] : []).join("\n");
        setConfirmed({ mode: "in", label: "Contractor", doorCode });
        setForm({ name: "", mobile: "", job_description: "" });
        setSelectedFlats([]);
      }

      if (personType === "contractor" && operation === "out") {
        await oakhillService.contractorCheckOutMany({ mobile: selectedMobile });
        setConfirmed({ mode: "out", label: "Contractor" });
      }

      setSelectedMobile("");
      setCheckoutChecklist([]);
      setCheckedItemIds([]);
      await loadOpen();
    } catch (requestError) {
      const detail = (requestError as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(detail ?? "Unable to confirm record.");
    } finally {
      setSaving(false);
    }
  }

  function finishConfirmation() {
    closePublicPage();
  }

  function toggleChecklistItem(id: string, checked: boolean) {
    setCheckedItemIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter((itemId) => itemId !== id);
    });
  }

  function toggleFlat(flat: string, checked: boolean) {
    setSelectedFlats((current) => checked ? [...current, flat] : current.filter((selectedFlat) => selectedFlat !== flat));
  }

  const selectedCleanerCanCheckOut =
    personType === "cleaner" &&
    operation === "out" &&
    selectedMobile &&
    !loadingChecklist &&
    checkoutChecklist.every((item) => checkedItemIds.includes(item.id));
  const disableSubmit = saving || (operation === "in" && selectedFlats.length === 0) || (personType === "cleaner" && operation === "out" && !selectedCleanerCanCheckOut);

  return (
    <main className="min-h-dvh bg-oak-surface p-4">
      <section className="mx-auto max-w-xl py-8">
        <form className="rounded-2xl border border-oak-border bg-white p-6 shadow-oakLg" onSubmit={(event) => void submit(event)}>
          <p className="oak-label">KCC</p>
          <h1 className="mt-2 text-3xl font-extrabold text-oak-coffee">Access record</h1>

          <div className="mt-5 grid grid-cols-2 rounded-xl bg-oak-panel p-1">
            <button className={`rounded-lg py-3 font-extrabold ${personType === "cleaner" ? "bg-white text-oak-coffee shadow-oak" : "text-oak-muted"}`} type="button" onClick={() => setPersonType("cleaner")}>
              Cleaner
            </button>
            <button className={`rounded-lg py-3 font-extrabold ${personType === "contractor" ? "bg-white text-oak-coffee shadow-oak" : "text-oak-muted"}`} type="button" onClick={() => setPersonType("contractor")}>
              Contractor
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 rounded-xl bg-oak-panel p-1">
            <button className={`rounded-lg py-3 font-extrabold ${operation === "in" ? "bg-white text-oak-coffee shadow-oak" : "text-oak-muted"}`} type="button" onClick={() => setOperation("in")}>
              IN
            </button>
            <button className={`rounded-lg py-3 font-extrabold ${operation === "out" ? "bg-white text-oak-coffee shadow-oak" : "text-oak-muted"}`} type="button" onClick={() => setOperation("out")}>
              OUT
            </button>
          </div>

          {operation === "in" ? (
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="oak-label">Name</span>
                <input className="oak-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              </label>
              <label className="grid gap-2">
                <span className="oak-label">Mobile</span>
                <input className="oak-input" value={form.mobile} onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value }))} required />
              </label>
              <fieldset className="grid gap-2">
                <legend className="oak-label">Flats</legend>
                <div className="grid grid-cols-3 gap-2">
                  {FLATS.map((flat) => (
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-oak-border p-3 text-sm font-bold text-oak-coffee" key={flat}>
                      <input checked={selectedFlats.includes(flat)} className="size-4 accent-oak-taupe" type="checkbox" onChange={(event) => toggleFlat(flat, event.target.checked)} />
                      Flat {flat}
                    </label>
                  ))}
                </div>
              </fieldset>
              {personType === "contractor" ? (
                <>
                  <label className="grid gap-2">
                    <span className="oak-label">Job description</span>
                    <input className="oak-input" value={form.job_description} onChange={(event) => setForm((current) => ({ ...current, job_description: event.target.value }))} required />
                  </label>
                </>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="oak-label">Mobile</span>
                <select className="oak-input" value={selectedMobile} onChange={(event) => setSelectedMobile(event.target.value)} required>
                  <option value="">{loadingOpen ? "Loading..." : "Select mobile"}</option>
                  {openOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {openOptions.find((item) => item.id === selectedMobile)?.detail ? (
                <div className="rounded-xl bg-oak-panel p-4 text-sm font-semibold text-black/65">
                  {openOptions.find((item) => item.id === selectedMobile)?.detail}
                </div>
              ) : null}
              {personType === "cleaner" && selectedMobile ? (
                <div className="grid gap-3 rounded-xl border border-oak-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="oak-label">Checkout checklist</p>
                    {checkoutChecklist.length > 0 ? (
                      <span className="text-xs font-extrabold text-black/50">{checkedItemIds.length}/{checkoutChecklist.length}</span>
                    ) : null}
                  </div>
                  {loadingChecklist ? <p className="text-sm font-bold text-black/60">Loading checklist...</p> : null}
                  {!loadingChecklist && checkoutChecklist.length === 0 ? <p className="text-sm font-bold text-black/60">No checklist items for this flat.</p> : null}
                  {!loadingChecklist && checkoutChecklist.length > 0 ? (
                    <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                      {checkoutChecklist.map((item) => (
                        <label className="flex items-start gap-3 rounded-lg bg-oak-panel p-3 text-sm font-bold text-black/70" key={item.id}>
                          <input
                            className="mt-0.5 size-5 shrink-0 accent-oak-taupe"
                            type="checkbox"
                            checked={checkedItemIds.includes(item.id)}
                            onChange={(event) => toggleChecklistItem(item.id, event.target.checked)}
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {error ? <p className="mt-4 rounded-xl bg-oak-dangerBg p-3 text-sm font-bold text-oak-danger">{error}</p> : null}

          <button className="oak-button-primary mt-6 min-h-14 w-full text-base" disabled={disableSubmit} type="submit">
            {saving ? "Confirming..." : `Confirm ${operation.toUpperCase()}`}
          </button>
        </form>
      </section>

      {confirmed ? (
        <div className="fixed inset-0 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-oakLg">
            <CheckCircle2 className="mx-auto text-emerald-700" size={46} />
            <h2 className="mt-4 text-xl font-extrabold text-oak-coffee">Record confirmed</h2>
            <p className="mt-2 text-sm font-bold text-black/60">
              {confirmed.label} {confirmed.mode.toUpperCase()}
            </p>
            {confirmed.doorCode ? (
              <div className="mt-4 rounded-xl bg-oak-panel p-4 text-left">
                <p className="oak-label">Door code</p>
                {confirmed.doorCode.split("\n").map((line) => {
                  const [label, code] = line.includes(":") ? line.split(":", 2) : ["", line];
                  return <p className="mt-2 flex justify-between gap-3" key={line}><span>{label}</span><code className="font-mono font-bold">{code.trim()}</code></p>;
                })}
              </div>
            ) : null}
            <button className="oak-button-primary mt-5 w-full" type="button" onClick={finishConfirmation}>OK</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

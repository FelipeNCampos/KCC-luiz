import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { DashboardShell } from "../components/DashboardShell";
import { FlatChecklistItem, oakhillService } from "../services/oakhill";

type ChecklistDraft = Pick<FlatChecklistItem, "id" | "label" | "checked" | "position">;

const FLATS = ["50", "51", "52"];

export function ChecklistPage() {
  const [selectedFlat, setSelectedFlat] = useState(FLATS[0]);
  const [checklistItems, setChecklistItems] = useState<ChecklistDraft[]>([]);
  const [newChecklistLabel, setNewChecklistLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function loadChecklist(flat = selectedFlat) {
    setLoading(true);
    setFeedback(null);
    try {
      const response = await oakhillService.flatChecklist(flat);
      setChecklistItems(response.data.map((item) => ({ id: item.id, label: item.label, checked: item.checked, position: item.position })));
    } catch {
      setChecklistItems([]);
      setFeedback({ type: "error", message: "Nao foi possivel carregar o checklist." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChecklist(selectedFlat);
  }, [selectedFlat]);

  async function saveChecklist(items = checklistItems, successMessage = "Checklist saved.") {
    setSaving(true);
    setFeedback(null);
    try {
      const normalized = items.map((item, index) => ({ ...item, label: item.label.trim(), position: index })).filter((item) => item.label);
      const response = await oakhillService.saveFlatChecklist(selectedFlat, normalized);
      setChecklistItems(response.data.map((item) => ({ id: item.id, label: item.label, checked: item.checked, position: item.position })));
      setFeedback({ type: "success", message: successMessage });
    } catch {
      setFeedback({ type: "error", message: "Nao foi possivel salvar o checklist." });
    } finally {
      setSaving(false);
    }
  }

  function addChecklistItem(event: FormEvent) {
    event.preventDefault();
    const label = newChecklistLabel.trim();
    if (!label) return;
    const nextItems = [...checklistItems, { id: `draft-${Date.now()}`, label, checked: false, position: checklistItems.length }];
    setChecklistItems(nextItems);
    setNewChecklistLabel("");
    void saveChecklist(nextItems, "Item added.");
  }

  function updateChecklistItem(index: number, patch: Partial<ChecklistDraft>) {
    setChecklistItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function removeChecklistItem(index: number) {
    const nextItems = checklistItems.filter((_, itemIndex) => itemIndex !== index);
    setChecklistItems(nextItems);
    void saveChecklist(nextItems, "Item removed.");
  }

  return (
    <DashboardShell title="Checklist" subtitle="Flat checklist configuration">
      <section className="oak-card p-5">
        <div className="flex flex-col gap-4 border-b border-oak-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="oak-label">Flat checklist</p>
            <h2 className="mt-2 text-xl font-extrabold text-oak-coffee">Configure checklist by flat</h2>
          </div>
          <label className="grid gap-2 sm:min-w-48">
            <span className="oak-label">Flat</span>
            <select className="oak-input" value={selectedFlat} onChange={(event) => setSelectedFlat(event.target.value)}>
              {FLATS.map((flat) => (
                <option key={flat} value={flat}>Flat {flat}</option>
              ))}
            </select>
          </label>
        </div>

        {feedback ? (
          <p className={`mt-4 rounded-xl p-3 text-sm font-bold ${feedback.type === "success" ? "border border-emerald-300 bg-emerald-50 text-emerald-800" : "bg-oak-dangerBg text-oak-danger"}`}>
            {feedback.message}
          </p>
        ) : null}

        <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={addChecklistItem}>
          <label className="grid gap-2">
            <span className="oak-label">New item</span>
            <input className="oak-input" placeholder="Add checklist item" value={newChecklistLabel} onChange={(event) => setNewChecklistLabel(event.target.value)} />
          </label>
          <button className="oak-button-primary self-end" disabled={saving} type="submit">
            <Plus size={16} />
            Add
          </button>
        </form>

        <div className="mt-5 grid gap-3">
          {loading ? <p className="rounded-xl bg-oak-panel p-4 text-sm font-bold text-black/60">Loading checklist...</p> : null}
          {!loading && checklistItems.length === 0 ? <p className="rounded-xl bg-oak-panel p-4 text-sm font-bold text-black/60">No checklist items for Flat {selectedFlat}.</p> : null}
          {checklistItems.map((item, index) => (
            <div className="grid gap-3 rounded-xl border border-oak-border p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center" key={item.id}>
              <input
                className="size-5 accent-oak-taupe"
                type="checkbox"
                checked={item.checked}
                onChange={(event) => updateChecklistItem(index, { checked: event.target.checked })}
              />
              <input
                className="oak-input"
                value={item.label}
                onChange={(event) => updateChecklistItem(index, { label: event.target.value })}
                onBlur={() => void saveChecklist()}
              />
              <button className="oak-button-secondary !min-h-10 !px-3" disabled={saving} type="button" onClick={() => removeChecklistItem(index)}>
                <Trash2 size={16} />
                Remove
              </button>
            </div>
          ))}
        </div>

        {checklistItems.length > 0 ? (
          <div className="mt-5 flex justify-end">
            <button className="oak-button-primary" disabled={saving} type="button" onClick={() => void saveChecklist()}>
              {saving ? "Saving..." : "Save checklist"}
            </button>
          </div>
        ) : null}
      </section>
    </DashboardShell>
  );
}

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Film, Plus, Save, Trash2, X } from "lucide-react";

import { DashboardShell } from "../components/DashboardShell";
import { FlatInstruction, instructionsService } from "../services/instructions";

type InstructionDraft = Pick<FlatInstruction, "id" | "title" | "video_url" | "video_name" | "video_data" | "description" | "position">;

const FLATS = ["50", "51", "52"];

function emptyInstruction(position: number): InstructionDraft {
  return {
    id: `draft-${Date.now()}-${position}`,
    title: "",
    video_url: "",
    video_name: null,
    video_data: null,
    description: "",
    position,
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read selected video."));
    reader.readAsDataURL(file);
  });
}

export function InstructionsPage() {
  const [selectedFlat, setSelectedFlat] = useState(FLATS[0]);
  const [items, setItems] = useState<InstructionDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadInstructions = useCallback(async (flat = selectedFlat) => {
    setLoading(true);
    setFeedback(null);
    try {
      const response = await instructionsService.flat(flat);
      setItems(response.data.map((item) => ({
        id: item.id,
        title: item.title,
        video_url: item.video_url ?? "",
        video_name: item.video_name,
        video_data: item.video_data,
        description: item.description,
        position: item.position,
      })));
    } catch {
      setItems([]);
      setFeedback({ type: "error", message: "Unable to load instructions." });
    } finally {
      setLoading(false);
    }
  }, [selectedFlat]);

  useEffect(() => {
    void loadInstructions(selectedFlat);
  }, [loadInstructions, selectedFlat]);

  function updateItem(index: number, patch: Partial<InstructionDraft>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((current) => [...current, emptyInstruction(current.length)]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function saveInstructions(event?: FormEvent) {
    event?.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const normalized = items
        .map((item, index) => ({
          id: item.id.startsWith("draft-") ? undefined : item.id,
          title: item.title.trim(),
          video_url: item.video_url?.trim() || null,
          video_name: item.video_name,
          video_data: item.video_data,
          description: item.description.trim(),
          position: index,
        }))
        .filter((item) => item.title && item.description);
      const response = await instructionsService.saveFlat(selectedFlat, normalized);
      setItems(response.data.map((item) => ({
        id: item.id,
        title: item.title,
        video_url: item.video_url ?? "",
        video_name: item.video_name,
        video_data: item.video_data,
        description: item.description,
        position: item.position,
      })));
      setFeedback({ type: "success", message: "Instructions saved." });
    } catch {
      setFeedback({ type: "error", message: "Unable to save instructions." });
    } finally {
      setSaving(false);
    }
  }

  async function selectVideo(index: number, file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setFeedback({ type: "error", message: "Select a video file." });
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      updateItem(index, { video_name: file.name, video_data: dataUrl, video_url: "" });
    } catch {
      setFeedback({ type: "error", message: "Unable to read selected video." });
    }
  }

  return (
    <DashboardShell title="Instruções" subtitle="Flat instructions shown by QR code">
      <section className="oak-card p-5">
        <div className="flex flex-col gap-4 border-b border-oak-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="oak-label">Instructions</p>
            <h2 className="mt-2 text-xl font-extrabold text-oak-coffee">Configure by flat</h2>
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

        <form className="mt-5 grid gap-4" onSubmit={(event) => void saveInstructions(event)}>
          {loading ? <p className="rounded-xl bg-oak-panel p-4 text-sm font-bold text-black/60">Loading instructions...</p> : null}
          {!loading && items.length === 0 ? <p className="rounded-xl bg-oak-panel p-4 text-sm font-bold text-black/60">No instructions for Flat {selectedFlat}.</p> : null}
          {items.map((item, index) => (
            <article className="grid gap-3 rounded-xl border border-oak-border p-4" key={item.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-extrabold text-oak-coffee">Instruction {index + 1}</p>
                <button className="oak-button-secondary !min-h-9 !px-3" disabled={saving} type="button" onClick={() => removeItem(index)}>
                  <Trash2 size={16} />
                  Remove
                </button>
              </div>
              <label className="grid gap-2">
                <span className="oak-label">Title</span>
                <input className="oak-input" value={item.title} onChange={(event) => updateItem(index, { title: event.target.value })} required />
              </label>
              <div className="grid gap-2">
                <span className="oak-label">Video</span>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-oak-border bg-oak-panel/50 px-4 py-4 text-sm font-semibold text-oak-coffee">
                  <Film size={18} />
                  <span>{item.video_name || "Choose video"}</span>
                  <input className="hidden" type="file" accept="video/*" onChange={(event) => void selectVideo(index, event.target.files?.[0] ?? null)} />
                </label>
                {item.video_data ? (
                  <div className="grid gap-2 rounded-xl border border-oak-border p-3">
                    <video className="max-h-64 w-full rounded-lg bg-black" src={item.video_data} controls />
                    <button className="oak-button-secondary !min-h-9 !px-3" type="button" onClick={() => updateItem(index, { video_name: null, video_data: null })}>
                      <X size={16} />
                      Remove video
                    </button>
                  </div>
                ) : null}
              </div>
              <label className="grid gap-2">
                <span className="oak-label">Description</span>
                <textarea className="oak-input min-h-28 resize-y" value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} required />
              </label>
            </article>
          ))}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button className="oak-button-secondary" disabled={saving} type="button" onClick={addItem}>
              <Plus size={16} />
              Add instruction
            </button>
            <button className="oak-button-primary" disabled={saving} type="submit">
              <Save size={16} />
              {saving ? "Saving..." : "Save instructions"}
            </button>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}

import { ChangeEvent, FormEvent, useState } from "react";
import { CheckCircle2, ImagePlus, PackagePlus, X } from "lucide-react";

import { stockService } from "../services/stock";
import { closePublicPage } from "../utils/closePublicPage";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

export function StockRequestPage() {
  const [form, setForm] = useState({ product_name: "", quantity: "1" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPhotoFile(file);
    setError(null);
    if (!file) {
      setPhotoPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPhotoFile(null);
      setPhotoPreview(null);
      setError("Select an image file.");
      return;
    }
    try {
      setPhotoPreview(await readFileAsDataUrl(file));
    } catch {
      setPhotoPreview(null);
      setError("Unable to preview selected photo.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await stockService.create({
        product_name: form.product_name,
        quantity: Number(form.quantity),
        photo_name: photoFile?.name ?? null,
        photo_data: photoPreview,
      });
      setConfirmed(true);
      setForm({ product_name: "", quantity: "1" });
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (requestError) {
      const detail = (requestError as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(detail ?? "Unable to send stock request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-oak-surface p-4">
      <section className="mx-auto max-w-xl py-8">
        <form className="rounded-2xl border border-oak-border bg-white p-6 shadow-oakLg" onSubmit={(event) => void submit(event)}>
          <div className="flex items-start gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-oak-panel text-oak-coffee">
              <PackagePlus size={22} />
            </div>
            <div>
              <p className="oak-label">KCC</p>
              <h1 className="mt-1 text-3xl font-extrabold text-oak-coffee">Stock request</h1>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="oak-label">Product name</span>
              <input className="oak-input" value={form.product_name} onChange={(event) => setForm((current) => ({ ...current, product_name: event.target.value }))} required />
            </label>
            <label className="grid gap-2">
              <span className="oak-label">Quantity</span>
              <input className="oak-input" min="1" type="number" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required />
            </label>
            <label className="grid gap-2">
              <span className="oak-label">Product photo</span>
              <span className="oak-button-secondary justify-center">
                <ImagePlus size={17} />
                {photoFile ? photoFile.name : "Choose photo"}
                <input className="sr-only" type="file" accept="image/*" onChange={(event) => void selectPhoto(event)} />
              </span>
            </label>
            {photoPreview ? (
              <div className="relative rounded-xl border border-oak-border bg-oak-panel p-3">
                <img className="max-h-64 w-full rounded-lg object-contain" alt="Product preview" src={photoPreview} />
                <button className="absolute right-4 top-4 grid size-9 place-items-center rounded-lg border border-oak-border bg-white" type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}>
                  <X size={16} />
                </button>
              </div>
            ) : null}
          </div>

          {error ? <p className="mt-4 rounded-xl bg-oak-dangerBg p-3 text-sm font-bold text-oak-danger">{error}</p> : null}

          <button className="oak-button-primary mt-6 min-h-14 w-full text-base" disabled={saving} type="submit">
            {saving ? "Sending..." : "Send request"}
          </button>
        </form>
      </section>

      {confirmed ? (
        <div className="fixed inset-0 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-oakLg">
            <CheckCircle2 className="mx-auto text-emerald-700" size={46} />
            <h2 className="mt-4 text-xl font-extrabold text-oak-coffee">Request sent</h2>
            <p className="mt-2 text-sm font-bold text-black/60">The manager will see it in Stock.</p>
            <button className="oak-button-primary mt-5 w-full" type="button" onClick={closePublicPage}>OK</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

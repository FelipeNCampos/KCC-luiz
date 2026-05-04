import { useEffect, useMemo, useState } from "react";
import { BookOpen, PlayCircle } from "lucide-react";

import { FlatInstruction, instructionsService } from "../services/instructions";

export function FlatInstructionsPage() {
  const params = new URLSearchParams(window.location.search);
  const flat = params.get("flat") ?? "";
  const validFlat = useMemo(() => ["50", "51", "52"].includes(flat.replace("Flat ", "")), [flat]);
  const [buildingName, setBuildingName] = useState(flat ? `Flat ${flat.replace("Flat ", "")}` : "Flat");
  const [items, setItems] = useState<FlatInstruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!validFlat) {
      setLoading(false);
      setError("Invalid QR code.");
      return;
    }
    setLoading(true);
    setError(null);
    instructionsService
      .publicFlat(flat)
      .then((response) => {
        setBuildingName(response.building_name);
        setItems(response.data);
      })
      .catch(() => setError("Unable to load instructions."))
      .finally(() => setLoading(false));
  }, [flat, validFlat]);

  return (
    <main className="min-h-dvh bg-oak-surface p-4">
      <section className="mx-auto max-w-3xl py-8">
        <div className="rounded-2xl border border-oak-border bg-white p-6 shadow-oakLg">
          <div className="flex items-start gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-oak-panel text-oak-coffee">
              <BookOpen size={22} />
            </div>
            <div>
              <p className="oak-label">KCC Flats</p>
              <h1 className="mt-1 text-3xl font-extrabold text-oak-coffee">{buildingName}</h1>
            </div>
          </div>

          {loading ? <p className="mt-5 rounded-xl bg-oak-panel p-4 text-sm font-bold text-black/60">Loading instructions...</p> : null}
          {error ? <p className="mt-5 rounded-xl bg-oak-dangerBg p-4 text-sm font-bold text-oak-danger">{error}</p> : null}
          {!loading && !error && items.length === 0 ? (
            <p className="mt-5 rounded-xl bg-oak-panel p-4 text-sm font-bold text-black/60">No instructions available for this flat.</p>
          ) : null}

          <div className="mt-6 grid gap-5">
            {items.map((item, index) => (
              <article className="grid gap-4 rounded-xl border border-oak-border p-4" key={item.id}>
                <div>
                  <p className="oak-label">Instruction {index + 1}</p>
                  <h2 className="mt-1 text-xl font-extrabold text-oak-coffee">{item.title}</h2>
                </div>
                {item.video_data ? (
                  <div className="overflow-hidden rounded-xl border border-oak-border bg-oak-panel">
                    <video className="aspect-video w-full bg-black" src={item.video_data} controls />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl bg-oak-panel p-4 text-sm font-bold text-black/60">
                    <PlayCircle size={18} />
                    No video attached.
                  </div>
                )}
                <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-black/70">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

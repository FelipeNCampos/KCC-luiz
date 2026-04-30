import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";

import { DashboardShell } from "../components/DashboardShell";

const FLATS = ["50", "51", "52"];

function qrUrl(link: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(link)}`;
}

function QrCard({ title, link, fileName }: { title: string; link: string; fileName: string }) {
  return (
    <article className="oak-card grid gap-4 p-5">
      <div>
        <p className="oak-label">Public form</p>
        <h2 className="text-lg font-extrabold text-oak-coffee">{title}</h2>
      </div>
      <img className="mx-auto size-64 rounded-lg border border-oak-border bg-white p-2" src={qrUrl(link)} alt={`${title} QR code`} />
      <div className="grid gap-2 sm:grid-cols-2">
        <a className="oak-button-secondary" href={qrUrl(link)} download={fileName}>
          <Download size={16} />
          Download
        </a>
        <a className="oak-button-primary" href={link} target="_blank" rel="noreferrer">
          <ExternalLink size={16} />
          Open
        </a>
      </div>
    </article>
  );
}

export function QrCodesPage() {
  const [tab, setTab] = useState<"cleaner" | "caretaker">("cleaner");
  const origin = window.location.origin;
  const caretakerLink = `${origin}/contractor-access`;

  return (
    <DashboardShell title="QR Codes" subtitle="Public form links for cleaner and caretaker records">
      <div className="flex flex-wrap gap-2">
        <button className={tab === "cleaner" ? "oak-button-primary" : "oak-button-secondary"} type="button" onClick={() => setTab("cleaner")}>
          Cleaner
        </button>
        <button className={tab === "caretaker" ? "oak-button-primary" : "oak-button-secondary"} type="button" onClick={() => setTab("caretaker")}>
          Caretaker
        </button>
      </div>

      {tab === "cleaner" ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FLATS.map((flat) => {
              const link = `${origin}/cleaner-access?flat=${flat}`;
              return <QrCard key={flat} title={`Cleaner - Flat ${flat}`} link={link} fileName={`qr-cleaner-flat-${flat}.png`} />;
            })}
        </section>
      ) : null}

      {tab === "caretaker" ? (
        <section className="max-w-md">
          <QrCard title="Caretaker" link={caretakerLink} fileName="qr-caretaker.png" />
        </section>
      ) : null}
    </DashboardShell>
  );
}

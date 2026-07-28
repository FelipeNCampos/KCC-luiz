import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";

import { DashboardShell } from "../components/DashboardShell";

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
  const [tab, setTab] = useState<"general" | "stock" | "instructions" | "readings">("general");
  const origin = window.location.origin;
  const accessLink = `${origin}/access`;
  const stockLink = `${origin}/stock-request`;
  const instructionLinks = ["50", "51", "52"].map((flat) => ({
    flat,
    link: `${origin}/instructions-public?flat=${flat}`,
  }));
  const readingLinks = [
    { utility: "Energy", link: `${origin}/readings/energy` },
    { utility: "Gas", link: `${origin}/readings/gas` },
  ];

  return (
    <DashboardShell title="QR Codes" subtitle="Public form link for cleaner and contractor records">
      <div className="flex flex-wrap gap-2">
        <button className={tab === "general" ? "oak-button-primary" : "oak-button-secondary"} type="button" onClick={() => setTab("general")}>
          Geral
        </button>
        <button className={tab === "stock" ? "oak-button-primary" : "oak-button-secondary"} type="button" onClick={() => setTab("stock")}>
          Stock
        </button>
        <button className={tab === "instructions" ? "oak-button-primary" : "oak-button-secondary"} type="button" onClick={() => setTab("instructions")}>
          Guide Video
        </button>
        <button className={tab === "readings" ? "oak-button-primary" : "oak-button-secondary"} type="button" onClick={() => setTab("readings")}>
          Readings
        </button>
      </div>

      {tab === "general" ? (
        <section className="max-w-md">
          <QrCard title="Cleaner / Contractor (IN/OUT)" link={accessLink} fileName="qr-cleaner-contractor.png" />
        </section>
      ) : null}

      {tab === "stock" ? (
        <section className="max-w-md">
          <QrCard title="Stock request" link={stockLink} fileName="qr-stock-request.png" />
        </section>
      ) : null}

      {tab === "instructions" ? (
        <section className="grid gap-4 md:grid-cols-3">
          {instructionLinks.map((item) => (
            <QrCard key={item.flat} title={`Guide Video Flat ${item.flat}`} link={item.link} fileName={`qr-instructions-flat-${item.flat}.png`} />
          ))}
        </section>
      ) : null}

      {tab === "readings" ? (
        <section className="grid gap-4 md:grid-cols-2">
          {readingLinks.map((item) => (
            <QrCard key={item.utility} title={`${item.utility} readings`} link={item.link} fileName={`qr-${item.utility.toLowerCase()}-readings.png`} />
          ))}
        </section>
      ) : null}
    </DashboardShell>
  );
}

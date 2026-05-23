import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function renderPdfFirstPageToDataUrl(file: File) {
  const documentTask = getDocument({ data: await file.arrayBuffer() });
  let pdf: Awaited<typeof documentTask.promise> | null = null;

  try {
    pdf = await documentTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to render PDF preview.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({ canvas, canvasContext: context, viewport }).promise;

    const dataUrl = canvas.toDataURL("image/png");
    page.cleanup();

    return dataUrl;
  } finally {
    if (pdf) {
      await pdf.destroy();
    } else {
      await documentTask.destroy();
    }
  }
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { formatFileSize, getPdfErrorMessage } from "@/lib/pdf/format";

type PdfViewerProps = {
  file: File;
  downloadLabel?: string;
  onClose: () => void;
};

export function PdfViewer({ file, downloadLabel = "Download original", onClose }: PdfViewerProps) {
  const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let isCurrent = true;
    let loadingTask: import("pdfjs-dist").PDFDocumentLoadingTask | null = null;

    async function loadDocument() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const data = new Uint8Array(await file.arrayBuffer());
        if (!isCurrent) return;

        loadingTask = pdfjs.getDocument({ data });
        const loadedDocument = await loadingTask.promise;
        if (!isCurrent) return;

        setDocumentProxy(loadedDocument);
        setPageCount(loadedDocument.numPages);
        setIsLoading(false);
      } catch (loadError) {
        if (!isCurrent) return;
        setError(getPdfErrorMessage(loadError));
        setIsLoading(false);
      }
    }

    void loadDocument();

    return () => {
      isCurrent = false;
      if (loadingTask) {
        void loadingTask.destroy();
      }
    };
  }, [file]);

  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      setAvailableWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    const loadedDocument = documentProxy;
    if (loadedDocument === null || canvasElement === null || availableWidth === 0) return;

    let isCurrent = true;
    let renderTask: RenderTask | null = null;
    async function renderPage(
      pageDocument: PDFDocumentProxy,
      pageCanvas: HTMLCanvasElement,
    ) {
      setIsRendering(true);
      try {
        const page = await pageDocument.getPage(pageNumber);
        if (!isCurrent) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.max(0.1, Math.min((availableWidth - 48) / baseViewport.width, 1.35));
        const viewport = page.getViewport({ scale: fitScale * (zoom / 100) });
        const context = pageCanvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas rendering is unavailable in this browser.");
        }

        const pixelRatio = window.devicePixelRatio || 1;
        pageCanvas.width = Math.ceil(viewport.width * pixelRatio);
        pageCanvas.height = Math.ceil(viewport.height * pixelRatio);
        pageCanvas.style.width = `${viewport.width}px`;
        pageCanvas.style.height = `${viewport.height}px`;

        renderTask = page.render({
          canvas: pageCanvas,
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await renderTask.promise;
        if (isCurrent) setError(null);
      } catch (renderError) {
        if (isCurrent && !(renderError instanceof Error && renderError.name === "RenderingCancelledException")) {
          setError(getPdfErrorMessage(renderError));
        }
      } finally {
        if (isCurrent) setIsRendering(false);
      }
    }

    const frame = window.requestAnimationFrame(() => {
      void renderPage(loadedDocument, canvasElement);
    });
    return () => {
      isCurrent = false;
      window.cancelAnimationFrame(frame);
      renderTask?.cancel();
    };
  }, [availableWidth, documentProxy, pageNumber, zoom]);

  function changePage(nextPage: number) {
    if (!Number.isFinite(nextPage) || pageCount === 0) return;
    setPageNumber(Math.min(pageCount, Math.max(1, Math.floor(nextPage))));
  }

  function downloadOriginal() {
    const url = URL.createObjectURL(file);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="viewer-shell">
      <header className="viewer-topbar">
        <button className="viewer-brand" type="button" onClick={onClose} aria-label="Back to PDF Studio workspace">
          <span className="viewer-brand-mark" aria-hidden="true">P</span>
          <span>pdf<span>studio</span></span>
        </button>
        <div className="viewer-file-title">
          <span className="viewer-file-icon">PDF</span>
          <div><strong title={file.name}>{file.name}</strong><span>{formatFileSize(file.size)}</span></div>
        </div>
        <div className="viewer-actions">
          <span className="viewer-local-note"><span /> Stored on this device</span>
          <button className="download-button" type="button" onClick={downloadOriginal}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 17v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{downloadLabel}</span>
          </button>
          <button className="close-viewer-button" type="button" onClick={onClose} aria-label="Close document">×</button>
        </div>
      </header>

      <section className="document-toolbar" aria-label="PDF controls">
        <div className="toolbar-document-label"><span className="toolbar-dot" /> DOCUMENT VIEWER</div>
        <div className="page-controls">
          <button type="button" className="icon-button" onClick={() => changePage(pageNumber - 1)} disabled={pageNumber <= 1 || pageCount === 0} aria-label="Previous page">‹</button>
          <label className="page-counter">
            <input
              aria-label="Current page number"
              type="number"
              min={1}
              max={pageCount || 1}
              value={pageNumber}
              disabled={pageCount === 0}
              onChange={(event) => changePage(Number(event.currentTarget.value))}
              onBlur={(event) => {
                if (!event.currentTarget.value) changePage(1);
              }}
            />
            <span>of {pageCount || "—"}</span>
          </label>
          <button type="button" className="icon-button" onClick={() => changePage(pageNumber + 1)} disabled={pageNumber >= pageCount || pageCount === 0} aria-label="Next page">›</button>
        </div>
        <div className="zoom-controls">
          <button type="button" className="icon-button" onClick={() => setZoom((current) => Math.max(50, current - 10))} disabled={zoom <= 50} aria-label="Zoom out">−</button>
          <span>{zoom}%</span>
          <button type="button" className="icon-button" onClick={() => setZoom((current) => Math.min(160, current + 10))} disabled={zoom >= 160} aria-label="Zoom in">+</button>
        </div>
      </section>

      <div className="viewer-body">
        <section className="canvas-area" aria-label="PDF page">
          <div className="canvas-top-label"><span>PAGE {pageNumber} {pageCount ? `/ ${pageCount}` : ""}</span><span>{isRendering ? "RENDERING" : "PDF DOCUMENT"}</span></div>
          <div className="canvas-scroll" ref={pageContainerRef}>
            {isLoading ? (
              <div className="viewer-status" role="status"><span className="loading-spinner" /><strong>Opening your document</strong><span>Preparing pages for viewing…</span></div>
            ) : error ? (
              <div className="viewer-error" role="alert"><span className="error-symbol">!</span><strong>We couldn&apos;t display this PDF</strong><span>{error}</span><button type="button" onClick={onClose}>Back to workspace</button></div>
            ) : (
              <div className="page-stage">
                <canvas ref={canvasRef} aria-label={`PDF page ${pageNumber} of ${pageCount}`} />
              </div>
            )}
          </div>
          <div className="canvas-bottom-label"><span>LOCAL PREVIEW</span><span>ORIGINAL FILE IS UNCHANGED</span></div>
        </section>
      </div>
    </main>
  );
}

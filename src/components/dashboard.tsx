"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ImageToPdf } from "@/components/image-to-pdf";
import { PdfViewer } from "@/components/pdf-viewer";
import { formatFileSize, validatePdfFile } from "@/lib/pdf/format";
import type { RecentDocument } from "@/types/pdf";

function PdfMark() {
  return (
    <span aria-hidden="true" className="brand-mark">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M7 3.75h7l4.25 4.3v12.2H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M14 4v4.5h4.25M8 13h6M8 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M12 15V4m0 0L8 8m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M3.75 7.5a2 2 0 0 1 2-2h4l2 2h6.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2v-10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function Dashboard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [isGeneratedPdf, setIsGeneratedPdf] = useState(false);
  const [isImageToolOpen, setIsImageToolOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openFile(file: File | undefined) {
    if (!file) return;

    setError(null);
    setIsValidating(true);
    try {
      const validationError = await validatePdfFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setRecentDocuments((documents) => {
        const withoutDuplicate = documents.filter(
          ({ file: recentFile }) =>
            recentFile.name !== file.name ||
            recentFile.size !== file.size ||
            recentFile.lastModified !== file.lastModified,
        );
        return [{ file, openedAt: Date.now() }, ...withoutDuplicate].slice(0, 5);
      });
      setIsGeneratedPdf(false);
      setActiveFile(file);
    } catch {
      setError("We couldn't read this file. Try choosing the PDF again.");
    } finally {
      setIsValidating(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    void openFile(event.dataTransfer.files[0]);
  }

  if (activeFile) {
    return (
      <PdfViewer
        key={`${activeFile.name}-${activeFile.size}-${activeFile.lastModified}`}
        file={activeFile}
        downloadLabel={isGeneratedPdf ? "Download PDF" : "Download original"}
        onClose={() => {
          setActiveFile(null);
          setError(null);
        }}
      />
    );
  }

  if (isImageToolOpen) {
    return (
      <ImageToPdf
        onBack={() => setIsImageToolOpen(false)}
        onOpenPdf={(file) => {
          setRecentDocuments((documents) => [
            { file, openedAt: Date.now(), isGenerated: true },
            ...documents.filter(({ file: recentFile }) => recentFile.name !== file.name),
          ].slice(0, 5));
          setIsGeneratedPdf(true);
          setIsImageToolOpen(false);
          setActiveFile(file);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="PDF Studio home">
          <PdfMark />
          <span>pdf<span className="brand-accent">studio</span></span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="nav-item nav-item-active">
            <FolderIcon />
            <span>My workspace</span>
          </span>
          <button className="nav-item nav-button" type="button" onClick={() => setIsImageToolOpen(true)}>
            <span className="nav-image-icon" aria-hidden="true">▧</span>
            <span>Image to PDF</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-icon" aria-hidden="true">↗</span>
            <div>
              <strong>Your files stay yours</strong>
              <p>Documents are processed locally in your browser.</p>
            </div>
          </div>
          <div className="sidebar-user">
            <span className="avatar" aria-hidden="true">P</span>
            <div>
              <strong>PDF Studio</strong>
              <span>Personal workspace</span>
            </div>
            <span className="user-menu" aria-hidden="true">•••</span>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>Home</strong></div>
          <div className="topbar-meta"><span className="local-badge"><span /> Local processing</span></div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-block">
            <div className="eyebrow"><span className="eyebrow-line" /> YOUR DOCUMENT WORKSPACE</div>
            <h1>Make room for <span>better work.</span></h1>
            <p>Everything you need to work with PDFs, in one calm and focused space.</p>
          </section>

          <section className="upload-section" aria-labelledby="upload-heading">
            <div className={`upload-card${isDragging ? " upload-card-dragging" : ""}`}>
              <button
                className="drop-target"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                disabled={isValidating}
                aria-describedby="upload-description"
              >
                <span className="upload-icon"><UploadIcon /></span>
                <span id="upload-heading" className="upload-title">{isValidating ? "Checking your PDF..." : "Drop your PDF here"}</span>
                <span id="upload-description" className="upload-description">
                  or <span className="text-link">browse files</span> from your device
                </span>
                <span className="upload-formats">PDF files up to 100 MB</span>
              </button>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept="application/pdf,.pdf"
                aria-label="Choose a PDF file"
                onChange={(event) => void openFile(event.currentTarget.files?.[0])}
              />
            </div>
            {error && <p className="error-message" role="alert">{error}</p>}
          </section>

          <button className="image-tool-launcher" type="button" onClick={() => setIsImageToolOpen(true)}>
            <span className="image-tool-launcher-icon" aria-hidden="true">▧</span>
            <span><strong>Images to PDF</strong><span>Create a PDF or add image pages to an existing document.</span></span>
            <span className="image-tool-launcher-arrow" aria-hidden="true">→</span>
          </button>

          <section className="recent-section" aria-labelledby="recent-heading">
            <div className="section-heading recent-heading">
              <div>
                <h2 id="recent-heading">Recently opened</h2>
                <p>Your documents from this session.</p>
              </div>
              {recentDocuments.length > 0 && <span className="recent-count">{recentDocuments.length} {recentDocuments.length === 1 ? "file" : "files"}</span>}
            </div>
            {recentDocuments.length === 0 ? (
              <div className="recent-empty">
                <span className="recent-empty-icon"><FolderIcon /></span>
                <div><strong>Your recent files will show up here</strong><span>Open a PDF to pick up where you left off.</span></div>
              </div>
            ) : (
              <ul className="recent-list">
                {recentDocuments.map(({ file, openedAt, isGenerated: recentIsGenerated }) => (
                  <li key={`${file.name}-${file.lastModified}-${file.size}`}>
                    <button className="recent-document" type="button" onClick={() => { setIsGeneratedPdf(recentIsGenerated ?? false); setActiveFile(file); }}>
                      <span className="recent-file-icon">PDF</span>
                      <span className="recent-file-info"><strong>{file.name}</strong><span>{formatFileSize(file.size)} <span aria-hidden="true">·</span> Opened {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(openedAt)}</span></span>
                      <span className="recent-open-label">Open PDF <span aria-hidden="true">→</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <footer className="dashboard-footer">
            <span>PDF Studio <span aria-hidden="true">·</span> A quieter way to work with documents.</span>
            <span>Private by design. Processed on your device.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

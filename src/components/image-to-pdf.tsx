"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createPdfFile, createPdfFromImages } from "@/lib/pdf/images";
import { formatFileSize, validatePdfFile } from "@/lib/pdf/format";

type ImageToPdfProps = {
  onBack: () => void;
  onOpenPdf: (file: File) => void;
};

type QueuedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

function ImagePreview({ file, url }: { file: File; url: string }) {
  return <Image src={url} alt={`Preview of ${file.name}`} width={38} height={38} className="image-preview" unoptimized />;
}

export function ImageToPdf({ onBack, onOpenPdf }: ImageToPdfProps) {
  const imagesInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef(new Set<string>());
  const [images, setImages] = useState<QueuedImage[]>([]);
  const [appendMode, setAppendMode] = useState(false);
  const [sourcePdf, setSourcePdf] = useState<File | null>(null);
  const [outputName, setOutputName] = useState("images");
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
    previewUrlsRef.current.clear();
  }, []);

  function addImages(files: FileList | File[]) {
    const chosen = Array.from(files);
    if (chosen.length === 0) return;
    setError(null);
    const unsupported = chosen.find((file) => !/\.(jpe?g|png|webp)$/i.test(file.name));
    if (unsupported) {
      setError(`"${unsupported.name}" is not a supported JPEG, PNG, or WebP image.`);
      return;
    }
    if (chosen.some((file) => file.size === 0)) {
      setError("One of the selected image files is empty.");
      return;
    }
    const existingSize = images.reduce((total, image) => total + image.file.size, 0);
    const addedSize = chosen.reduce((total, file) => total + file.size, 0);
    if (existingSize + addedSize > 100 * 1024 * 1024) {
      setError("The selected images exceed the 100 MB total size limit.");
      return;
    }
    setImages((current) => [
      ...current,
      ...chosen.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.add(previewUrl);
        return { id: crypto.randomUUID(), file, previewUrl };
      }),
    ]);
  }

  async function chooseSourcePdf(file: File | undefined) {
    if (!file) return;
    try {
      const validationError = await validatePdfFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      setSourcePdf(file);
      setOutputName(file.name.replace(/\.pdf$/i, ""));
    } catch {
      setError("We couldn't read this PDF. Try choosing the file again.");
    } finally {
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  function moveImage(index: number, direction: -1 | 1) {
    setImages((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const reordered = [...current];
      const [image] = reordered.splice(index, 1);
      if (!image) return current;
      reordered.splice(nextIndex, 0, image);
      return reordered;
    });
  }

  function clearImages() {
    for (const image of images) {
      URL.revokeObjectURL(image.previewUrl);
      previewUrlsRef.current.delete(image.previewUrl);
    }
    setImages([]);
  }

  function removeImage(id: string) {
    const image = images.find((entry) => entry.id === id);
    if (image) {
      URL.revokeObjectURL(image.previewUrl);
      previewUrlsRef.current.delete(image.previewUrl);
    }
    setImages((current) => current.filter((entry) => entry.id !== id));
  }

  async function generatePdf() {
    if (images.length === 0 || (appendMode && !sourcePdf)) return;
    setError(null);
    setIsGenerating(true);
    setProgress({ completed: 0, total: images.length });

    try {
      const bytes = await createPdfFromImages(
        images.map(({ file }) => file),
        appendMode ? sourcePdf ?? undefined : undefined,
        (completed, total) => setProgress({ completed, total }),
      );
      const file = createPdfFile(bytes, outputName);
      onOpenPdf(file);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "The PDF could not be generated. Please try again.",
      );
      setIsGenerating(false);
    }
  }

  const totalSize = images.reduce((total, image) => total + image.file.size, 0);

  return (
    <main className="image-workspace">
      <header className="image-workspace-header">
        <button className="back-button" type="button" onClick={onBack}>← <span>Workspace</span></button>
        <span className="image-workspace-brand">PDF <span>STUDIO</span></span>
        <span className="local-badge"><span /> Local processing</span>
      </header>

      <div className="image-workspace-content">
        <div className="image-workspace-intro">
          <div className="eyebrow"><span className="eyebrow-line" /> IMAGE TOOL</div>
          <h1>Turn images into <span>PDF pages.</span></h1>
          <p>Each image becomes its own page. Your files never leave this device.</p>
        </div>

        <section className="image-converter-card" aria-labelledby="image-upload-title">
          <div className="converter-section-heading">
            <div>
              <h2 id="image-upload-title">1. Choose your images</h2>
              <p>Select JPEG, PNG, or WebP images. You can change their page order below.</p>
            </div>
            <span className="converter-limit">100 MB TOTAL</span>
          </div>

          <button
            className={`image-dropzone${isDragging ? " image-dropzone-active" : ""}`}
            type="button"
            onClick={() => imagesInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              addImages(event.dataTransfer.files);
            }}
            disabled={isGenerating}
          >
            <span className="image-drop-icon" aria-hidden="true">＋</span>
            <strong>Add images</strong>
            <span>Browse or drop multiple images here</span>
          </button>
          <input
            ref={imagesInputRef}
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            multiple
            aria-label="Choose images to convert"
            onChange={(event) => {
              addImages(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
            }}
          />

          {images.length > 0 && (
            <div className="image-queue">
              <div className="image-queue-heading">
                <strong>{images.length} {images.length === 1 ? "image" : "images"} <span>·</span> {formatFileSize(totalSize)}</strong>
                <button type="button" className="text-action" onClick={clearImages} disabled={isGenerating}>Clear all</button>
              </div>
              <ol className="image-list">
                {images.map(({ id, file, previewUrl }, index) => (
                  <li className="image-list-item" key={id}>
                    <span className="image-order">{index + 1}</span>
                    <ImagePreview file={file} url={previewUrl} />
                    <span className="image-item-info"><strong title={file.name}>{file.name}</strong><span>{formatFileSize(file.size)} <span aria-hidden="true">·</span> Page {index + 1}</span></span>
                    <div className="image-item-actions">
                      <button type="button" aria-label={`Move ${file.name} up`} onClick={() => moveImage(index, -1)} disabled={index === 0 || isGenerating}>↑</button>
                      <button type="button" aria-label={`Move ${file.name} down`} onClick={() => moveImage(index, 1)} disabled={index === images.length - 1 || isGenerating}>↓</button>
                      <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeImage(id)} disabled={isGenerating}>×</button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section className="image-converter-card output-card" aria-labelledby="output-heading">
          <div className="converter-section-heading">
            <div>
              <h2 id="output-heading">2. Create your PDF</h2>
              <p>Choose a new document or add the image pages to the end of an existing PDF.</p>
            </div>
          </div>

          <div className="output-mode-options">
            <label className={`output-mode-option${!appendMode ? " output-mode-selected" : ""}`}>
              <input type="radio" name="output-mode" checked={!appendMode} onChange={() => { setAppendMode(false); setError(null); }} disabled={isGenerating} />
              <span className="mode-radio" />
              <span><strong>Create a new PDF</strong><span>One page for each image</span></span>
            </label>
            <label className={`output-mode-option${appendMode ? " output-mode-selected" : ""}`}>
              <input type="radio" name="output-mode" checked={appendMode} onChange={() => { setAppendMode(true); setError(null); }} disabled={isGenerating} />
              <span className="mode-radio" />
              <span><strong>Add pages to an existing PDF</strong><span>Keep current pages, then append images</span></span>
            </label>
          </div>

          {appendMode && (
            <div className="source-pdf-picker">
              <input ref={pdfInputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" aria-label="Choose an existing PDF" onChange={(event) => void chooseSourcePdf(event.currentTarget.files?.[0])} />
              {sourcePdf ? (
                <div className="source-pdf-selected">
                  <span className="recent-file-icon">PDF</span>
                  <span><strong>{sourcePdf.name}</strong><span>{formatFileSize(sourcePdf.size)} · image pages will be added at the end</span></span>
                  <button type="button" className="text-action" onClick={() => { setSourcePdf(null); setOutputName("images"); }} disabled={isGenerating}>Change</button>
                </div>
              ) : (
                <button type="button" className="choose-pdf-button" onClick={() => pdfInputRef.current?.click()} disabled={isGenerating}>
                  <span aria-hidden="true">＋</span> Choose the PDF to add pages to
                </button>
              )}
            </div>
          )}

          <label className="output-name-label" htmlFor="output-name">PDF filename</label>
          <div className="output-name-row">
            <input id="output-name" type="text" value={outputName} maxLength={100} onChange={(event) => setOutputName(event.currentTarget.value)} disabled={isGenerating} />
            <span>.pdf</span>
          </div>

          {error && <p className="error-message image-error" role="alert">{error}</p>}
          {isGenerating && (
            <div className="generation-progress" role="status">
              <span className="loading-spinner" />
              <span>{progress.completed === 0 ? "Preparing images…" : `Adding image ${progress.completed} of ${progress.total}…`}</span>
            </div>
          )}
          <div className="generate-actions">
            <button className="secondary-button" type="button" onClick={onBack} disabled={isGenerating}>Cancel</button>
            <button className="primary-button" type="button" onClick={() => void generatePdf()} disabled={isGenerating || images.length === 0 || (appendMode && !sourcePdf)}>
              {isGenerating ? "Creating PDF…" : appendMode ? "Add pages & open PDF" : "Create & open PDF"} <span aria-hidden="true">→</span>
            </button>
          </div>
          <p className="page-size-note">Pages use A4 proportions, portrait or landscape to match each image. Large images are scaled to fit without cropping.</p>
        </section>
      </div>
    </main>
  );
}

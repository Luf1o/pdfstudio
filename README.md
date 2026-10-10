# PDF Studio

A browser-based workspace for viewing PDFs and turning images into PDF pages. Documents are processed in the browser and are not uploaded to a server.

## Setup

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Production builds can be checked with `npm run build` and served with `npm start`.

## Dependencies

- Next.js, React, TypeScript, and Tailwind CSS provide the application foundation.
- PDF.js (`pdfjs-dist`) loads and renders PDF pages in the browser using its bundled worker.
- PDF-lib (`pdf-lib`) creates PDFs and appends image pages to existing documents.

## Implemented

- Responsive dashboard with drag-and-drop or file-picker PDF upload.
- PDF signature validation and clear errors for invalid files.
- Local page rendering with previous/next navigation and zoom.
- Session-only recent documents, while the page remains open.
- Download of the original PDF without modifying it.
- Select or drag in multiple JPEG, PNG, and WebP images; each image becomes a separate page.
- Reorder or remove images before creating the PDF.
- Create a new PDF or append image pages to the end of an existing PDF without replacing the source.
- A4 portrait/landscape pages selected to match each image, with images scaled proportionally to fit.
- Download the generated or appended PDF from the viewer.

## Limitations

- PDFs and the combined image selection are limited to 100 MB. Individual images above 40 megapixels are not supported.
- Password-protected PDFs are not supported for append operations.
- WebP images are rasterized to PNG before embedding. JPEG and PNG are embedded directly.
- Appended PDF pages are re-saved by PDF-lib; some advanced PDF features such as digital signatures or specialized interactive content may not be preserved. The chosen source remains unchanged.
- The viewer renders one page at a time. Page thumbnails, text search, annotations, printing, and page editing are planned for later phases.
- Uploaded files are held in browser memory; recent documents are not persisted after the session ends.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

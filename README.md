# PDF Studio

A browser-based workspace for viewing PDF documents. Documents are processed in the browser; Phase 1 does not upload files to a server.

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

## Implemented in Phase 1

- Responsive dashboard with drag-and-drop or file-picker PDF upload.
- PDF signature validation and clear errors for invalid files.
- Local page rendering with previous/next navigation and zoom.
- Session-only recent documents, while the page remains open.
- Download of the original PDF without modifying it.

## Limitations

- Files larger than 100 MB and password-protected PDFs are not supported.
- The viewer renders one page at a time. Page thumbnails, text search, annotations, printing, PDF editing, and image-to-PDF conversion are planned for later phases.
- The viewer does not alter or export edited PDFs in this phase.
- Uploaded files are held in browser memory; recent documents are not persisted after the session ends.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

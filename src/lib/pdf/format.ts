const MAX_PDF_SIZE = 100 * 1024 * 1024;

export async function validatePdfFile(file: File): Promise<string | null> {
  if (file.size === 0) {
    return "This file is empty. Choose a different PDF.";
  }

  if (file.size > MAX_PDF_SIZE) {
    return "This PDF is larger than the current 100 MB limit.";
  }

  const header = await file.slice(0, 1024).text();
  if (!header.includes("%PDF-")) {
    return "This file does not appear to be a valid PDF.";
  }

  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

export function getPdfErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "PasswordException") {
    return "This PDF requires a password. Password-protected files are not supported yet.";
  }

  if (error instanceof Error && error.name === "InvalidPDFException") {
    return "PDF.js could not read this document. The file may be damaged or use an unsupported feature.";
  }

  return "We couldn't open this PDF. Check that the file is valid and try again.";
}

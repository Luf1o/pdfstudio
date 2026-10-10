import { PDFDocument } from "pdf-lib";

const MAX_IMAGE_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 28;

export type ImagePdfProgress = (completed: number, total: number) => void;

function getImageFormat(file: File): "jpeg" | "png" | "webp" | null {
  const mimeType = file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (mimeType === "image/jpeg" || extension === "jpg" || extension === "jpeg") {
    return "jpeg";
  }
  if (mimeType === "image/png" || extension === "png") {
    return "png";
  }
  if (mimeType === "image/webp" || extension === "webp") {
    return "webp";
  }

  return null;
}

async function convertWebpToPng(file: File): Promise<Uint8Array> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`"${file.name}" could not be decoded as a WebP image.`);
  }

  try {
    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
      throw new Error(`"${file.name}" exceeds the 40-megapixel image limit.`);
    }

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This browser could not prepare the WebP image.");
    }

    context.drawImage(bitmap, 0, 0);
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`"${file.name}" could not be converted to PNG.`));
      }, "image/png");
    });
    return new Uint8Array(await pngBlob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

function readPngDimensions(bytes: Uint8Array): [number, number] {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value) || bytes.length < 24) {
    throw new Error("The selected file is not a valid PNG image.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

function readJpegDimensions(bytes: Uint8Array): [number, number] {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("The selected file is not a valid JPEG image.");
  }

  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 4 < bytes.length) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;

    const segmentLength = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (startOfFrameMarkers.has(marker)) {
      const height = ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0);
      const width = ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0);
      return [width, height];
    }
    offset += segmentLength;
  }

  throw new Error("The selected JPEG does not contain readable image dimensions.");
}

function enforcePixelLimit(width: number, height: number, name: string) {
  if (width <= 0 || height <= 0) {
    throw new Error(`"${name}" has invalid image dimensions.`);
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    throw new Error(`"${name}" exceeds the 40-megapixel image limit.`);
  }
}

function getPageSize(width: number, height: number): [number, number] {
  return width > height ? [A4_HEIGHT, A4_WIDTH] : [A4_WIDTH, A4_HEIGHT];
}

export async function createPdfFromImages(
  images: File[],
  appendTo?: File,
  onProgress?: ImagePdfProgress,
): Promise<Uint8Array> {
  if (images.length === 0) {
    throw new Error("Choose at least one image to continue.");
  }

  const totalImageBytes = images.reduce((total, image) => total + image.size, 0);
  if (totalImageBytes > MAX_IMAGE_BYTES) {
    throw new Error("The selected images exceed the 100 MB total size limit.");
  }

  for (const image of images) {
    if (getImageFormat(image) === null) {
      throw new Error(`"${image.name}" is not a supported JPEG, PNG, or WebP image.`);
    }
    if (image.size === 0) {
      throw new Error(`"${image.name}" is empty.`);
    }
  }

  let pdf: PDFDocument;
  if (appendTo) {
    try {
      pdf = await PDFDocument.load(await appendTo.arrayBuffer(), {
        updateMetadata: false,
      });
    } catch {
      throw new Error("The selected PDF could not be read. It may be damaged or password-protected.");
    }
  } else {
    pdf = await PDFDocument.create();
  }

  onProgress?.(0, images.length);

  for (let index = 0; index < images.length; index += 1) {
    const file = images[index];
    const format = getImageFormat(file);
    if (!file || !format) {
      throw new Error("The selected image list changed. Please choose the images again.");
    }

    let embeddedImage;
    try {
      if (format === "webp") {
        const pngBytes = await convertWebpToPng(file);
        const [width, height] = readPngDimensions(pngBytes);
        enforcePixelLimit(width, height, file.name);
        embeddedImage = await pdf.embedPng(pngBytes);
      } else {
        const imageBytes = new Uint8Array(await file.arrayBuffer());
        const [width, height] =
          format === "png"
            ? readPngDimensions(imageBytes)
            : readJpegDimensions(imageBytes);
        enforcePixelLimit(width, height, file.name);
        embeddedImage =
          format === "png"
            ? await pdf.embedPng(imageBytes)
            : await pdf.embedJpg(imageBytes);
      }
    } catch (imageError) {
      if (imageError instanceof Error && imageError.message.includes("limit")) {
        throw imageError;
      }
      throw new Error(
        imageError instanceof Error && imageError.message.includes("40-megapixel")
          ? imageError.message
          : `"${file.name}" could not be processed as a valid image.`,
      );
    }

    const imageWidth = embeddedImage.width;
    const imageHeight = embeddedImage.height;

    const [pageWidth, pageHeight] = getPageSize(imageWidth, imageHeight);
    const availableWidth = pageWidth - PAGE_MARGIN * 2;
    const availableHeight = pageHeight - PAGE_MARGIN * 2;
    const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    const page = pdf.addPage([pageWidth, pageHeight]);

    page.drawImage(embeddedImage, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });

    onProgress?.(index + 1, images.length);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  return pdf.save();
}

export function createPdfFile(bytes: Uint8Array, name: string): File {
  const safeName =
    name.trim().replace(/\.pdf$/i, "").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-") ||
    "images";
  return new File([bytes.slice().buffer], `${safeName}.pdf`, {
    type: "application/pdf",
  });
}

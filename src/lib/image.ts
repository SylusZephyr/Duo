/**
 * Client-side image pipeline: read EXIF (orientation + GPS) before we discard it,
 * downscale onto a canvas — which strips every metadata block including GPS —
 * and produce a tiny blurred placeholder for instant rendering.
 */

export type PreparedImage = {
  blob: Blob;
  width: number;
  height: number;
  blurDataUrl: string;
  extension: string;
  mimeType: string;
  gps: { lat: number; lng: number } | null;
  takenAt: string | null;
};

const MAX_EDGE = 2560;

export async function prepareImage(file: File): Promise<PreparedImage> {
  const buffer = await file.arrayBuffer();
  const exif = readJpegExif(buffer);
  const bitmap = await decode(file);

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not process that image");
  context.drawImage(bitmap, 0, 0, width, height);

  const blob = await toBlob(canvas, "image/webp", 0.86);
  const blurDataUrl = await makeBlur(bitmap);
  if ("close" in bitmap) bitmap.close();

  return {
    blob,
    width,
    height,
    blurDataUrl,
    extension: "webp",
    mimeType: "image/webp",
    gps: exif.gps,
    takenAt: exif.takenAt,
  };
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode that image"))),
      type,
      quality,
    );
  });
}

async function makeBlur(source: ImageBitmap | HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  const ratio = source.height / source.width || 1;
  canvas.width = 20;
  canvas.height = Math.max(1, Math.round(20 * ratio));
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.5);
}

/** Minimal JPEG APP1/EXIF reader — we only want GPS and DateTimeOriginal. */
function readJpegExif(buffer: ArrayBuffer): {
  gps: { lat: number; lng: number } | null;
  takenAt: string | null;
} {
  const empty = { gps: null, takenAt: null };
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return empty;

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);
      if (marker === 0xe1 && view.getUint32(offset + 4) === 0x45786966) {
        return readTiff(view, offset + 10);
      }
      offset += 2 + size;
    }
    return empty;
  } catch {
    return empty;
  }
}

function readTiff(view: DataView, start: number) {
  const little = view.getUint16(start) === 0x4949;
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  if (u16(start + 2) !== 0x002a) return { gps: null, takenAt: null };

  const ifd0 = start + u32(start + 4);
  let gpsPointer = 0;
  let exifPointer = 0;
  const count = u16(ifd0);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd0 + 2 + i * 12;
    const tag = u16(entry);
    if (tag === 0x8825) gpsPointer = start + u32(entry + 8);
    if (tag === 0x8769) exifPointer = start + u32(entry + 8);
  }

  let takenAt: string | null = null;
  if (exifPointer) {
    const exifCount = u16(exifPointer);
    for (let i = 0; i < exifCount; i += 1) {
      const entry = exifPointer + 2 + i * 12;
      if (u16(entry) === 0x9003) {
        const length = u32(entry + 4);
        const at = length > 4 ? start + u32(entry + 8) : entry + 8;
        let text = "";
        for (let c = 0; c < Math.min(length, 19); c += 1)
          text += String.fromCharCode(view.getUint8(at + c));
        const match = text.match(/^(\d{4}):(\d{2}):(\d{2})/);
        if (match) takenAt = `${match[1]}-${match[2]}-${match[3]}`;
      }
    }
  }

  if (!gpsPointer) return { gps: null, takenAt };

  let latRef = "N";
  let lngRef = "E";
  let lat: number | null = null;
  let lng: number | null = null;
  const gpsCount = u16(gpsPointer);
  for (let i = 0; i < gpsCount; i += 1) {
    const entry = gpsPointer + 2 + i * 12;
    const tag = u16(entry);
    if (tag === 0x0001) latRef = String.fromCharCode(view.getUint8(entry + 8));
    if (tag === 0x0003) lngRef = String.fromCharCode(view.getUint8(entry + 8));
    if (tag === 0x0002 || tag === 0x0004) {
      const at = start + u32(entry + 8);
      const parts: number[] = [];
      for (let p = 0; p < 3; p += 1) {
        const numerator = u32(at + p * 8);
        const denominator = u32(at + p * 8 + 4) || 1;
        parts.push(numerator / denominator);
      }
      const value = (parts[0] ?? 0) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
      if (tag === 0x0002) lat = value;
      else lng = value;
    }
  }

  if (lat === null || lng === null) return { gps: null, takenAt };
  return {
    gps: { lat: latRef === "S" ? -lat : lat, lng: lngRef === "W" ? -lng : lng },
    takenAt,
  };
}

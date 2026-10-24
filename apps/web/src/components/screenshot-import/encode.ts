import { IMPORT_MAX_IMAGE_BYTES } from '@gokkan-keeper/shared';

/**
 * Re-encodes a screenshot as JPEG at its original resolution. Quality 0.85
 * read identically to the PNG in OCR tests; shrinking the resolution did not,
 * so the size is reduced only by compression.
 */
export async function encodeScreenshot(file: File): Promise<{ mime: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 변환하지 못했어요'))), 'image/jpeg', 0.85));
  if (blob.size > IMPORT_MAX_IMAGE_BYTES) throw new Error(`${file.name}: 이미지가 너무 커요 (1.5MB 이하)`);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('이미지를 읽지 못했어요'));
    reader.readAsDataURL(blob);
  });
  return { mime: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}

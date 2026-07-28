// @ts-nocheck
export function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .replace(/javascript:/gi, '')       // strip JS protocol
    .replace(/on\w+\s*=/gi, '')        // strip event handlers
    .replace(/data:(?!image\/)/gi, '') // strip non-image data URIs
    .trim();
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function validateFileUpload(
  file: File,
  opts?: { maxSizeMB?: number; allowedTypes?: string[] }
): { valid: boolean; error?: string } {
  const maxSizeMB = opts?.maxSizeMB ?? 10;
  const allowedTypes = opts?.allowedTypes ?? [
    'image/jpeg','image/png','image/gif','image/webp',
    'video/mp4','video/webm','video/quicktime'
  ];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type ' + file.type + ' is not allowed' };
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: 'File must be under ' + maxSizeMB + 'MB' };
  }
  return { valid: true };
}

/**
 * Convert a media URL (relative or absolute) to a fully qualified, browser-safe URL.
 * - Absolute URLs (http/https) are returned as-is with proper encoding.
 * - Relative paths are prefixed with the API base URL + /media/.
 * - Handles V1 CDN URLs that contain spaces and Thai characters.
 */
export function mediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return encodeURI(url);
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";
  return encodeURI(`${base}/media/${url}`);
}

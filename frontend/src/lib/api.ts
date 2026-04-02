const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public data: Record<string, unknown>,
  ) {
    super(data.message as string || `API Error: ${status}`);
  }
}

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const tenantOverride = localStorage.getItem("active_tenant_override");
  if (tenantOverride) headers["X-Tenant-ID"] = tenantOverride;

  return headers;
}

function handle401(res: Response): void {
  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/login";
    throw new ApiError(401, { message: "Session expired" });
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
    ...options.headers,
  };

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  handle401(res);

  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

async function downloadFile(endpoint: string, filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}${endpoint}`, { headers: getAuthHeader() });
  handle401(res);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function uploadFile(endpoint: string, file: File, fieldName = "file"): Promise<{ url: string }> {
  const form = new FormData();
  form.append(fieldName, file);

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: getAuthHeader(),
    body: form,
  });

  handle401(res);

  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data);
  return data as { url: string };
}

async function uploadFormData<T>(endpoint: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: getAuthHeader(),
    body: formData,
  });

  handle401(res);

  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export function mediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:30400";
  return `${base}/media/${url}`;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body: unknown, idempotencyKey?: string) =>
    request<T>(endpoint, { method: "POST", body, idempotencyKey }),
  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: "PUT", body }),
  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: "PATCH", body }),
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: "DELETE" }),
  download: downloadFile,
  upload: uploadFile,
  uploadForm: uploadFormData,
};

export { ApiError };

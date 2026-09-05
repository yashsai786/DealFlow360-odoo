export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: any;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, code = "API_ERROR", status = 500, details?: any) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function getCurrentActorId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem("dealflow360_app_state_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.session?.id;
    }
  } catch {
    // fallback
  }
  return undefined;
}

export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const actorId = getCurrentActorId();
  if (actorId && !headers.has("x-user-id")) {
    headers.set("x-user-id", actorId);
  }

  const baseUrl = typeof window === "undefined"
    ? `http://127.0.0.1:${process.env["PORT"] || 3000}`
    : "";
  const finalUrl = path.startsWith("/") ? `${baseUrl}${path}` : path;

  const response = await fetch(finalUrl, {
    ...options,
    headers,
  });

  // Check if response is JSON
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    const json: ApiResponse<T> = await response.json();
    if (!response.ok || json.success === false) {
      throw new ApiError(
        json.error?.message || `HTTP ${response.status} error`,
        json.error?.code || "HTTP_ERROR",
        response.status,
        json.error?.details
      );
    }
    return json.data as T;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(text || `HTTP ${response.status} error`, "HTTP_ERROR", response.status);
  }

  return (await response.text()) as unknown as T;
}

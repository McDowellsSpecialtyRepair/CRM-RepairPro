import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { authState } from "./auth-state";

export const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401 && authState.get()) { authState.set(null); queryClient.clear(); }
    const text = (await res.text()) || res.statusText;
    let message = text;
    try { const body = JSON.parse(text); message = body.message || body.error || text; } catch {}
    throw new Error(message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { ...(data ? { "Content-Type": "application/json" } : {}), ...(authState.get() ? { Authorization: `Bearer ${authState.get()!.token}` } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return await res.json();
  }
  return null;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, { headers: authState.get() ? { Authorization: `Bearer ${authState.get()!.token}` } : {} });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export async function printDocument(path: string) {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Allow the document window to open, then try printing again.");
  popup.document.body.textContent = "Loading authorized document…";
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${authState.get()?.token || ""}` } });
    await throwIfResNotOk(res);
    const html = await res.text();
    popup.opener = null;
    popup.document.open(); popup.document.write(html); popup.document.close();
  } catch (e: any) { if (!popup.closed) popup.document.body.textContent = e.message; }
}

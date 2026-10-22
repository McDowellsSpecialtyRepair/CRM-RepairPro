import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { authState } from "./auth-state";

export const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// Plain-English guidance when the CRM server cannot be reached or answers with something that is
// not RepairPro data (for example a stopped Codespaces test copy or a GitHub sign-in page).
export const SERVER_UNREACHABLE =
  "RepairPro could not reach its server, so this was not loaded or saved. Check your internet connection and try again. " +
  "In the Codespaces test copy, the codespace stops after about 30 minutes without activity in the codespace editor: " +
  "open the codespace tab (restart it if asked), then reload this page and sign in again.";
const notRepairProData = (status: number) => status === 401 || status === 403
  // RepairPro's own refusals always carry a message; a bare 401/403 comes from GitHub's Codespaces connection.
  ? `GitHub refused to connect this page to the CRM (error ${status}). This browser tab probably belongs to a codespace that was stopped or deleted. ` +
    "Close this tab, open your codespace from github.com/codespaces, and use the CRM tab it opens (or the globe icon next to port 5000 in the Ports tab)."
  : `The RepairPro server did not answer normally (error ${status}), so this was not loaded or saved. ` + SERVER_UNREACHABLE.slice(SERVER_UNREACHABLE.indexOf("Check"));

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401 && authState.get()) { authState.set(null); queryClient.clear(); }
    const text = await res.text().catch(() => "");
    const type = res.headers.get("content-type") || "";
    let message = "";
    try { const body = JSON.parse(text); message = body.message || body.error || ""; } catch {}
    // An empty reply or a web page (not a RepairPro message) means something in between answered instead.
    if (!message) message = text.trim() && !type.includes("text/html") ? text.trim() : notRepairProData(res.status);
    throw new Error(message);
  }
}
async function send(url: string, init?: RequestInit) {
  try { return await fetch(`${API_BASE}${url}`, init); }
  catch { throw new Error(SERVER_UNREACHABLE); }
}
// API answers are always JSON. Anything else (such as a sign-in page returned by a proxy) is not data.
async function json(res: Response) {
  if ((res.headers.get("content-type") || "").includes("application/json")) return await res.json();
  if (res.status === 204 || res.headers.get("content-length") === "0") return null;
  throw new Error(notRepairProData(res.status));
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  const res = await send(url, {
    method,
    headers: { ...(data ? { "Content-Type": "application/json" } : {}), ...(authState.get() ? { Authorization: `Bearer ${authState.get()!.token}` } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return json(res);
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await send(queryKey.join("/"), { headers: authState.get() ? { Authorization: `Bearer ${authState.get()!.token}` } : {} });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return json(res);
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
    const res = await send(path, { headers: { Authorization: `Bearer ${authState.get()?.token || ""}` } });
    await throwIfResNotOk(res);
    const html = await res.text();
    popup.opener = null;
    popup.document.open(); popup.document.write(html); popup.document.close();
  } catch (e: any) { if (!popup.closed) popup.document.body.textContent = e.message; }
}

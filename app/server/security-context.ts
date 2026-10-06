import { AsyncLocalStorage } from "node:async_hooks";
export const securityContext = new AsyncLocalStorage<{ userId?: number; label?: string; requestId: string }>();
export const actorLabel = () => securityContext.getStore()?.label || "System";

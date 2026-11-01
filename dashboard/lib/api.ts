"use client";

import { useCallback, useEffect, useState } from "react";

const TOKEN = "rezolv_token";
const USER = "rezolv_user";

export type Staff = { token: string; role: "dept_head" | "warden" | "dean"; name: string };

export function session(): Staff | null {
  try {
    const raw = localStorage.getItem(USER);
    const token = localStorage.getItem(TOKEN);
    return raw && token ? { ...JSON.parse(raw), token } : null;
  } catch {
    return null;
  }
}

export function signOut() {
  localStorage.removeItem(TOKEN);
  localStorage.removeItem(USER);
  window.location.href = "/login";
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Calls the ReZolv API through the Next.js proxy (/api/* -> API_URL). */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN);
  const res = await fetch(`/api${path}`, {
    method: init.method ?? "GET",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (res.status === 401 && path !== "/auth/login") signOut();
  if (!res.ok) throw new ApiError(res.status, typeof data?.detail === "string" ? data.detail : `Request failed (${res.status})`);
  return data as T;
}

export async function signIn(email: string, password: string): Promise<Staff> {
  const out = await api<{ token: string; role: string; name: string }>("/auth/login", { method: "POST", body: { email, password } });
  if (!["dept_head", "warden", "dean"].includes(out.role)) throw new ApiError(403, "This account is not a staff account");
  localStorage.setItem(TOKEN, out.token);
  localStorage.setItem(USER, JSON.stringify({ role: out.role, name: out.name }));
  return { token: out.token, role: out.role as Staff["role"], name: out.name };
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load };
}

export const LEVEL_TITLE = ["Facilities Head", "Warden", "Dean"] as const;
export const ROLE_LEVEL: Record<Staff["role"], number> = { dept_head: 0, warden: 1, dean: 2 };

import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
import { fetch as streamFetch } from "expo/fetch";

const K_TOKEN = "rezolv_token";
const K_USER = "rezolv_user";
const K_SERVER = "rezolv_server";

export const DEFAULT_SERVER = (process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.236:8000").replace(/\/$/, "");

let server = DEFAULT_SERVER;
let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const currentServer = () => server;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export type User = { pseudonym: string; email: string };

export async function loadSession(): Promise<{ token: string | null; user: User | null; server: string }> {
  const [t, u, s] = await Promise.all([AsyncStorage.getItem(K_TOKEN), AsyncStorage.getItem(K_USER), AsyncStorage.getItem(K_SERVER)]);
  token = t;
  if (s) server = s;
  return { token: t, user: u ? JSON.parse(u) : null, server };
}

export async function saveServer(url: string) {
  server = url.trim().replace(/\/$/, "");
  await AsyncStorage.setItem(K_SERVER, server);
}

export async function saveSession(t: string, user: User) {
  token = t;
  await AsyncStorage.multiSet([[K_TOKEN, t], [K_USER, JSON.stringify(user)]]);
}

export async function clearSession() {
  token = null;
  await AsyncStorage.multiRemove([K_TOKEN, K_USER]);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const unreachable = () =>
  new ApiError(0, `Cannot reach the server at ${server}. Check that the phone is on the same Wi-Fi as the laptop.`);

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  let res: Response;
  try {
    res = await fetch(`${server}${path}`, {
      method: init.method ?? "GET",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctl.signal,
    });
  } catch {
    throw unreachable();
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // not JSON
  }
  if (res.status === 401 && path !== "/auth/login") onUnauthorized?.();
  if (!res.ok) throw new ApiError(res.status, typeof data?.detail === "string" ? data.detail : `Request failed (${res.status})`);
  return data as T;
}

/** Uploads a recorded voice note or a photo straight to the server. Returns the key to send with the report. */
export async function uploadMedia(kind: "voice" | "photo" | "asset", uri: string, contentType: string, reportId?: string) {
  const qs = `kind=${kind}${reportId ? `&report_id=${reportId}` : ""}`;
  let res;
  try {
    res = await streamFetch(`${server}/uploads/media?${qs}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": contentType },
      body: new File(uri),
    });
  } catch {
    throw unreachable();
  }
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? "Upload failed");
  return data as { report_id: string; key: string };
}

// ---------- shapes returned by the server ----------

export type Promise_ = { text: string; due_at: string; status: string; escalation_level: number; hours_late: number } | null;

export type Issue = {
  id: string; code: string; title: string; category: string; status: string; report_count: number; impact_score: number;
  location: string | null; lat: number | null; lng: number | null; mine: boolean; department: string | null;
  promise_text: string | null; promise_due_at: string | null; escalation_level: number | null; hours_late: number | null;
};

export type MyReport = {
  id: string; receipt_code: string; kind: "report" | "me_too"; is_sensitive: boolean; created_at: string; text: string | null;
  issue_id: string | null; code: string | null; title: string | null; category: string | null; status: string | null; report_count: number | null;
  promise_text: string | null; promise_due_at: string | null; escalation_level: number | null;
};

export type TimelineEvent = {
  type: string; actor: string; summary: string; reasoning: string | null; created_at: string; verification: string;
};

export type IssueDetail = {
  id: string; code: string; title: string; category: string; status: string; report_count: number; suggested_fix: string | null;
  location: string | null; department: string | null; mine: boolean; promise: Promise_;
  cause: { code: string; title: string; reason: string; hits: number | null; trials: number | null } | null;
  events: TimelineEvent[]; why: TimelineEvent[];
  confirmations: { yes: number; total: number }; my_confirmation: "yes" | "partly" | "no" | null;
};

export type Awaiting = { id: string; code: string; title: string; category: string; report_count: number; location: string | null; department: string | null };
export type Profile = { pseudonym: string; reports: number; me_too: number; fixed: number; open: number };
export type ScoreRow = { name: string; kept: number; closed: number; kept_pct: number };
export type Place = { id: string; name: string; lat: number; lng: number };
export type ReportStatus = {
  id: string; receipt_code: string; processing: boolean; issue_id: string | null; code: string | null; title: string | null;
  status: string | null; report_count: number | null; joined_others: number | null;
};

export type Asset = {
  id: string; code: string; name: string; type: string; type_label: string; category: string; photo_url: string | null;
  location: string | null; floor: string | null; status: "proposed" | "approved"; mine?: boolean;
  issues?: number; open_issues?: number; distance_m?: number;
};
export type AssetType = { key: string; label: string; category: string };

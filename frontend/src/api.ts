const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

let token: string | null = null;
let onUnauthorized: () => void = () => {};

export const setToken = (t: string | null) => {
  token = t;
};
export const setOnUnauthorized = (fn: () => void) => {
  onUnauthorized = fn;
};
export const backendUrl = BASE;

export async function api<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: opts.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error("Sin conexión. Revisa tu internet e inténtalo de nuevo.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    const d = data?.detail;
    const msg = Array.isArray(d) ? d.map((x: any) => String(x.msg).replace("Value error, ", "")).join(". ") : d;
    throw new Error(msg || `Error ${res.status}`);
  }
  return data as T;
}

export type AgendaItem = {
  type: "routine" | "event" | "session";
  id: string;
  title: string;
  start: string;
  end: string;
  status?: "planned" | "done";
  travel_before?: number;
  travel_after?: number;
  reason?: string;
  habit_id?: string;
  routine_id?: string;
};

export type Habit = {
  id: string;
  name: string;
  sessions_per_week: number;
  duration_min: number;
  travel_before_min: number;
  travel_after_min: number;
  forbidden_windows: { start: string; end: string }[];
  forbidden_days: number[];
  preferred: "any" | "morning" | "afternoon" | "evening";
  priority: number;
};

export type Routine = { id: string; title: string; days: number[]; start: string; end: string };

import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { api } from "./api";

/** Loads a path every time the screen comes into focus, so lists are fresh after an action elsewhere. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);

  const load = useCallback(async () => {
    if (!path) return;
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  return { data, error, loading, reload: load };
}

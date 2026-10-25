import { useEffect, useState } from "react";
import { apiClient } from "./client";

// Gọi GET qua apiClient, trả về { data, loading, error, reload }.
// path = null nghĩa là chưa đủ điều kiện để gọi (ví dụ chưa chọn ngày).
export function useFetch(path) {
  const [result, setResult] = useState({ key: "", data: null, error: null });
  const [reloadCount, setReloadCount] = useState(0);
  const key = path ? `${path}#${reloadCount}` : "";

  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false;
    const requestKey = `${path}#${reloadCount}`;

    apiClient
      .get(path)
      .then((res) => {
        if (!cancelled) setResult({ key: requestKey, data: res.data, error: null });
      })
      .catch((error) => {
        if (!cancelled) setResult({ key: requestKey, data: null, error });
      });

    return () => {
      cancelled = true;
    };
  }, [path, reloadCount]);

  const done = key !== "" && result.key === key;

  return {
    data: done ? result.data : null,
    error: done ? result.error : null,
    loading: key !== "" && !done,
    reload: () => setReloadCount((n) => n + 1),
  };
}
import { useCallback, useState } from 'react';

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

export function useLocalList(key) {
  const [items, setItems] = useState(() => read(key));
  const save = useCallback((next) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setItems(next);
      return true;
    } catch {
      return false;
    }
  }, [key]);
  return [items, save];
}

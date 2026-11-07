import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { READ_WINDOW, activeRegistry, fetchRegistryMeta, fetchReports, friendlyError } from '../chain';

const RegistryContext = createContext(null);

export function RegistryProvider({ children }) {
  const [address, setAddress] = useState(activeRegistry);
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  const refresh = useCallback(async (target = address) => {
    if (!target) return;
    setLoading(true);
    setError('');
    try {
      const [m, r] = await Promise.all([fetchRegistryMeta(target), fetchReports(target, { limit: READ_WINDOW })]);
      setMeta(m);
      setRows(r.rows);
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(friendlyError(e));
      setMeta(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { refresh(address); }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = { Pending: 0, Challenged: 0, Confirmed: 0, Rejected: 0 };
    rows.forEach((r) => { c[r.status] += 1; });
    return c;
  }, [rows]);

  const value = useMemo(() => ({
    address, setAddress, meta, rows, counts, loading, error, updatedAt, refresh,
    available: Boolean(meta) && !error,
  }), [address, meta, rows, counts, loading, error, updatedAt, refresh]);

  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
}

export const useRegistry = () => useContext(RegistryContext);

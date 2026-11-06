import { useCallback, useState } from 'react';
import { friendlyError, registry } from '../chain';

/**
 * Runs a registry write with a simulation (eth_call) first, then tracks the
 * transaction through signature, submission and confirmation.
 * stage: idle | simulating | signing | pending | confirmed | failed
 */
export function useTx() {
  const [state, setState] = useState({ stage: 'idle', hash: '', error: '' });

  const run = useCallback(async (registryAddress, method, args) => {
    setState({ stage: 'simulating', hash: '', error: '' });
    try {
      const c = await registry(registryAddress, true);
      await c[method].staticCall(...args);
      setState({ stage: 'signing', hash: '', error: '' });
      const tx = await c[method](...args);
      setState({ stage: 'pending', hash: tx.hash, error: '' });
      const receipt = await tx.wait();
      if (receipt.status !== 1) throw Error('Transaction reverted.');
      setState({ stage: 'confirmed', hash: tx.hash, error: '' });
      return receipt;
    } catch (e) {
      setState((s) => ({ stage: 'failed', hash: s.hash, error: friendlyError(e) }));
      return null;
    }
  }, []);

  const reset = useCallback(() => setState({ stage: 'idle', hash: '', error: '' }), []);
  const busy = ['simulating', 'signing', 'pending'].includes(state.stage);
  return { ...state, busy, run, reset, setState };
}

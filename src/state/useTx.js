import { useCallback, useState } from 'react';
import { friendlyError, sendRegistryTx } from '../chain';

/**
 * Runs a registry write through chain.sendRegistryTx (simulate → sign → confirm,
 * version-aware for v1/v2) and tracks it for the UI.
 * stage: idle | simulating | pending | confirmed | failed
 * `simulating` covers connecting the wallet, the eth_call dry run and the wallet
 * signature prompt; `pending` starts once the wallet broadcasts the transaction.
 */
export function useTx() {
  const [state, setState] = useState({ stage: 'idle', hash: '', error: '' });

  const run = useCallback(async (registryAddress, method, args) => {
    setState({ stage: 'simulating', hash: '', error: '' });
    try {
      const receipt = await sendRegistryTx(registryAddress, method, args, (hash) => {
        setState({ stage: 'pending', hash, error: '' });
      });
      setState({ stage: 'confirmed', hash: receipt.hash, error: '' });
      return receipt;
    } catch (e) {
      setState((s) => ({ stage: 'failed', hash: s.hash, error: friendlyError(e) }));
      return null;
    }
  }, []);

  const reset = useCallback(() => setState({ stage: 'idle', hash: '', error: '' }), []);
  const busy = ['simulating', 'pending'].includes(state.stage);
  return { ...state, busy, run, reset, setState };
}

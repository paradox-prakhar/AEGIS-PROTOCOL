import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BrowserProvider, formatEther } from 'ethers';
import { CHAIN_ID, connectWallet, friendlyError, hasInjectedWallet, peekWallet, switchToArc } from '../chain';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const refreshBalance = useCallback(async (addr = account) => {
    if (!addr || !hasInjectedWallet()) return setBalance('');
    try {
      const provider = new BrowserProvider(window.ethereum);
      setBalance(formatEther(await provider.getBalance(addr)));
    } catch {
      setBalance('');
    }
  }, [account]);

  // Restore an existing authorization silently and follow wallet changes.
  useEffect(() => {
    if (!hasInjectedWallet()) return undefined;
    peekWallet().then(({ account: a, chainId: c }) => {
      setAccount(a);
      setChainId(c);
    }).catch(() => {});
    const onAccounts = (accounts) => setAccount(accounts?.[0] || '');
    const onChain = (hex) => setChainId(Number(BigInt(hex)));
    window.ethereum.on?.('accountsChanged', onAccounts);
    window.ethereum.on?.('chainChanged', onChain);
    return () => {
      window.ethereum.removeListener?.('accountsChanged', onAccounts);
      window.ethereum.removeListener?.('chainChanged', onChain);
    };
  }, []);

  useEffect(() => {
    if (account && chainId === CHAIN_ID) refreshBalance(account);
    else setBalance('');
  }, [account, chainId, refreshBalance]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError('');
    try {
      const signer = await connectWallet();
      const a = await signer.getAddress();
      setAccount(a);
      setChainId(CHAIN_ID);
      return a;
    } catch (e) {
      setError(friendlyError(e));
      throw e;
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    try {
      await switchToArc();
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount('');
    setBalance('');
  }, []);

  const value = useMemo(() => ({
    account,
    chainId,
    balance,
    connecting,
    error,
    clearError: () => setError(''),
    installed: hasInjectedWallet(),
    isConnected: Boolean(account),
    wrongNetwork: Boolean(account) && chainId !== null && chainId !== CHAIN_ID,
    connect,
    disconnect,
    switchNetwork,
    refreshBalance,
  }), [account, chainId, balance, connecting, error, connect, disconnect, switchNetwork, refreshBalance]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export const useWallet = () => useContext(WalletContext);

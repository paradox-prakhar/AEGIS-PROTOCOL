import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { WalletProvider } from './state/wallet';
import { RegistryProvider } from './state/registry';
import { ToastProvider } from './state/toast';
import './styles/tokens.css';
import './style.css';
import './styles/tailwind.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <WalletProvider>
        <RegistryProvider>
          <App />
        </RegistryProvider>
      </WalletProvider>
    </ToastProvider>
  </React.StrictMode>,
);

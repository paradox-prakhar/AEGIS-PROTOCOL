import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { WalletProvider } from './state/wallet';
import { RegistryProvider } from './state/registry';
import { ToastProvider } from './state/toast';
import './styles/tokens.css';
import './style.css';
import './styles/tailwind.css';
import './styles/aegis.css';
import { MotionConfig } from 'framer-motion';
import { CursorProvider } from './components/cursor/CursorSystem';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* reducedMotion="user": framer-motion drops transform/layout animation when the OS asks for reduced motion. */}
    <MotionConfig reducedMotion="user">
      <CursorProvider>
        <ToastProvider>
          <WalletProvider>
            <RegistryProvider>
              <App />
            </RegistryProvider>
          </WalletProvider>
        </ToastProvider>
      </CursorProvider>
    </MotionConfig>
  </React.StrictMode>,
);

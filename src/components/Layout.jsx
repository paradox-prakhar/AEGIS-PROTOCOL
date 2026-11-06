import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen, ChevronDown, Copy, ExternalLink, FileWarning, Gavel, LayoutDashboard, LifeBuoy, LogOut,
  Menu, Rocket, ScanLine, Shield, Database, Wallet, X, AlertTriangle, Droplets, GraduationCap, ListChecks, Phone, HeartHandshake,
} from 'lucide-react';
import { SpotlightNavbar } from './vengeance/spotlight-navbar';
import { ScrollProgress } from './motion';
import { CHAIN_NAME, FAUCET, explorerAddress } from '../chain';
import { useWallet } from '../state/wallet';
import { useRegistry } from '../state/registry';
import { useToast } from '../state/toast';
import { formatUsdc, shortAddress } from '../lib/format';
import { Button } from './ui';

export const NAV = [
  { group: 'Stay safe', items: [
    ['overview', 'Home', LayoutDashboard],
    ['scanner', 'Scam checker', ScanLine],
    ['learn', 'Learn scam types', GraduationCap],
  ] },
  { group: 'Get help', items: [
    ['recovery', "I've been scammed", LifeBuoy],
    ['cases', 'My cases', ListChecks],
    ['help', 'Helplines & resources', Phone],
  ] },
  { group: 'Community registry', items: [
    ['registry', 'Threat registry', Database],
    ['report', 'Submit report', FileWarning],
    ['review', 'Challenge & review', Gavel],
  ] },
  { group: 'Operate', items: [
    ['deploy', 'Deploy registry', Rocket],
    ['about', 'Trust & architecture', BookOpen],
  ] },
];

/** Routes shown in the floating desktop nav (the drawer holds everything). */
export const PRIMARY = [
  ['overview', 'Home'], ['scanner', 'Scam checker'], ['recovery', 'Get help'], ['cases', 'My cases'], ['learn', 'Learn'], ['help', 'Resources'],
];

export const TITLES = Object.fromEntries(NAV.flatMap((g) => g.items.map(([k, t]) => [k, t])));

function Sidebar({ path, open, onClose }) {
  const reg = useRegistry();
  const pending = reg.counts.Pending + reg.counts.Challenged;
  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`} id="site-menu" aria-label="All pages" aria-hidden={!open} inert={!open}>
        <div className="sidebar-top">
          <a className="brand" href="#/overview" onClick={onClose}>
            <span className="brand-mark"><Shield size={20} /></span>
            <span className="brand-text">Aegis<small>Protocol</small></span>
          </a>
          <button className="icon-btn sidebar-close" aria-label="Close menu" onClick={onClose}><X size={18} /></button>
        </div>
        <nav>
          {NAV.map((g) => (
            <div key={g.group} className="nav-group">
              <div className="nav-label">{g.group}</div>
              {g.items.map(([key, label, Icon]) => (
                <a key={key} href={`#/${key}`} className={`nav-item ${path === key ? 'active' : ''}`} onClick={onClose} aria-current={path === key ? 'page' : undefined}>
                  <Icon size={17} />
                  <span>{label}</span>
                  {key === 'registry' && reg.rows.length > 0 && <small className="nav-count">{reg.rows.length}</small>}
                  {key === 'review' && pending > 0 && <small className="nav-count warn">{pending}</small>}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="netcard">
            <div className="netcard-row">
              <span className={`live-dot ${reg.available ? '' : reg.loading ? 'loading' : 'down'}`} />
              <b>{CHAIN_NAME}</b>
              <span className="tag">TESTNET</span>
            </div>
            <div className="netcard-meta">
              {reg.meta ? <>Block <code>#{reg.meta.blockNumber.toLocaleString()}</code></> : reg.loading ? 'Connecting…' : 'Registry unavailable'}
            </div>
          </div>
          <p className="sidebar-note">Testnet prototype · not audited</p>
        </div>
      </aside>
    </>
  );
}

function WalletMenu() {
  const w = useWallet();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!w.installed) {
    return <a className="btn btn-secondary" href="https://metamask.io/download/" target="_blank" rel="noreferrer"><Wallet size={16} />Install wallet</a>;
  }
  if (!w.isConnected) {
    return (
      <Button icon={Wallet} loading={w.connecting} onClick={() => w.connect().then(() => toast('Wallet connected to Arc Testnet.', 'success')).catch(() => {})}>
        Connect wallet
      </Button>
    );
  }
  if (w.wrongNetwork) {
    return <Button variant="warning" icon={AlertTriangle} onClick={w.switchNetwork}>Switch to Arc</Button>;
  }
  return (
    <div className="wallet-menu" ref={ref}>
      <button className="wallet-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="avatar" style={{ '--h': parseInt(w.account.slice(2, 6), 16) % 360 }} />
        <span className="wallet-chip-text">
          <b>{shortAddress(w.account)}</b>
          <small>{w.balance ? `${formatUsdc(w.balance)} USDC` : '— USDC'}</small>
        </span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="menu">
          <div className="menu-head">
            <small className="muted">Connected account</small>
            <code>{w.account}</code>
          </div>
          <button onClick={() => { navigator.clipboard?.writeText(w.account); toast('Address copied.', 'success'); setOpen(false); }}><Copy size={15} />Copy address</button>
          <a href={explorerAddress(w.account)} target="_blank" rel="noreferrer"><ExternalLink size={15} />View on explorer</a>
          <a href={FAUCET} target="_blank" rel="noreferrer"><Droplets size={15} />Get test USDC</a>
          <button onClick={() => { w.disconnect(); setOpen(false); }}><LogOut size={15} />Disconnect</button>
        </div>
      )}
    </div>
  );
}

export function Layout({ path, children }) {
  const [menu, setMenu] = useState(false);
  const w = useWallet();
  const toast = useToast();
  useEffect(() => { if (w.error) { toast(w.error, 'error'); w.clearError(); } }, [w.error]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);
  const primaryIndex = PRIMARY.findIndex(([k]) => k === path);
  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <ScrollProgress />
      <Sidebar path={path} open={menu} onClose={() => setMenu(false)} />
      <div className="main">
        <header className="topbar floatnav">
          <a className="brand" href="#/overview" aria-label="Aegis Protocol home">
            <span className="brand-mark"><Shield size={18} /></span>
            <span className="brand-text">Aegis<small>Protocol</small></span>
          </a>
          <SpotlightNavbar
            className="floatnav-links"
            items={PRIMARY.map(([k, label]) => ({ label, href: `#/${k}` }))}
            activeIndex={primaryIndex === -1 ? null : primaryIndex}
            defaultActiveIndex={-1}
          />
          <div className="floatnav-end">
            {path !== 'recovery' && (
              <a className="btn btn-calm btn-sm help-now" href="#/recovery" aria-label="I have been scammed — get help"><HeartHandshake size={15} /><span>I&apos;ve been scammed</span></a>
            )}
            <WalletMenu />
            <button className="icon-btn menu-btn" aria-label="Open all pages" aria-expanded={menu} aria-controls="site-menu" onClick={() => setMenu(true)}><Menu size={20} /></button>
          </div>
        </header>
        {w.wrongNetwork && (
          <div className="netbanner" role="status">
            <AlertTriangle size={16} />Your wallet is on another network. Aegis only works on Arc Testnet.
            <button onClick={w.switchNetwork}>Switch network</button>
          </div>
        )}
        <main className="content" id="main" tabIndex={-1}>{children}</main>
        <footer className="footer">
          <div className="footer-brand">
            <span className="brand-mark"><Shield size={16} /></span>
            <div>
              <b>Aegis Protocol</b>
              <p>Calm, clear help before and after a scam. Arc Testnet prototype · not audited.</p>
            </div>
          </div>
          <nav className="footer-links" aria-label="Footer">
            {NAV.slice(0, 2).flatMap((g) => g.items).map(([k, label]) => <a key={k} href={`#/${k}`}>{label}</a>)}
          </nav>
          <p className="footer-note">Aegis will never ask for your OTP, PIN, password or seed phrase. Reports are public allegations, not proof.</p>
        </footer>
      </div>
    </div>
  );
}

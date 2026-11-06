import React from 'react';
import { Layout, TITLES } from './components/Layout';
import { useRoute } from './state/router';
import { EmptyState, Button } from './components/ui';
import { Compass } from 'lucide-react';
import Overview from './pages/Overview';
import Scanner from './pages/Scanner';
import Registry from './pages/Registry';
import Report from './pages/Report';
import Review from './pages/Review';
import Recovery from './pages/Recovery';
import Deploy from './pages/Deploy';
import About from './pages/About';
import Learn from './pages/Learn';
import Cases from './pages/Cases';
import Help from './pages/Help';

import { PageTransition } from './components/motion';
import { ErrorBoundary } from './components/ErrorBoundary';

// Operator / Arkiv pages pull in the Arkiv SDK and viem: load them only when visited.
const Arkiv = React.lazy(() => import('./pages/Arkiv'));
const OnchainWorkspace = React.lazy(() => import('./pages/OnchainWorkspace'));

const PAGES = { overview: Overview, scanner: Scanner, registry: Registry, report: Report, review: Review, recovery: Recovery, deploy: Deploy, about: About, learn: Learn, cases: Cases, help: Help, arkiv: Arkiv, onchain: OnchainWorkspace };

export default function App() {
  const { path, params } = useRoute();
  const Page = PAGES[path];
  React.useEffect(() => { document.title = `${TITLES[path] || 'Not found'} · Aegis Protocol`; }, [path]);
  return (
    <Layout path={path}>
      <ErrorBoundary resetKey={path}>
      <PageTransition routeKey={path}>
      <React.Suspense fallback={<p className="muted" role="status">Loading…</p>}>
      {Page ? <Page params={params} /> : (
        <EmptyState icon={Compass} title="Page not found" action={<Button onClick={() => { window.location.hash = '/overview'; }}>Go to overview</Button>}>
          This route does not exist.
        </EmptyState>
      )}
      </React.Suspense>
      </PageTransition>
      </ErrorBoundary>
    </Layout>
  );
}

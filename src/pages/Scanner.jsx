import React from 'react';
import { PageHeader, Card, Callout } from '../components/ui';
import { ScanForm } from '../components/ScanForm';

const LEGEND = [
  ['danger', 'Confirmed report / High risk', 'A reviewer confirmed an allegation, or the address matches a known demo threat.'],
  ['warning', 'Under review', 'Open onchain allegations exist that have not been adjudicated.'],
  ['info', 'Reports rejected', 'Allegations existed but were reviewed and rejected.'],
  ['neutral', 'No record', 'Nothing found. This is never a safety verdict.'],
];

export default function Scanner({ params }) {
  return (
    <>
      <PageHeader eyebrow="Detect" title="Address scanner" description="Screen a destination against the shared onchain registry and deterministic local fixtures before you sign." />
      <div className="grid-main">
        <Card title="Screen a destination">
          <ScanForm initial={params.address || ''} />
        </Card>
        <div className="stack">
          <Card title="How to read results">
            <ul className="legend">
              {LEGEND.map(([tone, title, text]) => (
                <li key={tone}><span className={`legend-dot dot-${tone}`} /><div><b>{title}</b><p className="muted">{text}</p></div></li>
              ))}
            </ul>
          </Card>
          <Callout tone="warning" title="Scope of this scanner">
            Checks the latest 100 registry records only. It does not intercept wallet transactions, simulate token transfers, or query external threat feeds.
          </Callout>
        </div>
      </div>
    </>
  );
}

import React from 'react';
import ArkivReports from '../ArkivReports';
import { PageHeader } from '../components/ui';

/** Arc + Arkiv two-signature evidence flow. The component itself is unchanged; this page only frames it. */
export default function Arkiv() {
  return (
    <>
      <PageHeader eyebrow="Community registry" title="Arkiv evidence"
        description="Publish the full evidence for a confirmed Arc report on Arkiv, and search records others have shared. Each step asks for its own wallet signature." />
      <div className="legacy-panel">
        <ArkivReports />
      </div>
    </>
  );
}

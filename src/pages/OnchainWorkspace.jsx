import React from 'react';
import Onchain from '../Onchain';
import { PageHeader } from '../components/ui';

/**
 * Full registry operator panel: v2 pause/unpause, two-step reviewer rotation,
 * evidence URIs and paginated records. The component itself is unchanged.
 */
export default function OnchainWorkspace() {
  return (
    <>
      <PageHeader eyebrow="Operate" title="Onchain workspace"
        description="Every registry action in one place, for reviewers and operators. Most people should use Submit report and Challenge & review instead." />
      <div className="legacy-panel">
        <Onchain />
      </div>
    </>
  );
}

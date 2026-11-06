import React, { useState } from 'react';
import { CheckCircle2, FileCheck2, XCircle } from 'lucide-react';
import { bytesHash, evidenceHash } from '../chain';

/** Lets anyone check that an evidence file or text hashes to an onchain commitment. */
export function EvidenceVerifier({ expected }) {
  const [hash, setHash] = useState('');
  const [name, setName] = useState('');
  const [text, setText] = useState('');

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setName(file.name);
    setText('');
    setHash(bytesHash(new Uint8Array(await file.arrayBuffer())));
  }

  const match = hash && hash.toLowerCase() === expected.toLowerCase();
  return (
    <div className="verifier">
      <div className="verifier-head"><FileCheck2 size={16} /><b>Verify evidence</b></div>
      <p className="muted small">Upload the exact evidence package (or paste its text). Its Keccak-256 hash must equal the onchain commitment.</p>
      <div className="verifier-inputs">
        <label className="file-drop">
          <input type="file" onChange={onFile} />
          <span>{name || 'Choose evidence file…'}</span>
        </label>
        <textarea
          rows={3}
          placeholder="…or paste evidence text"
          value={text}
          onChange={(e) => { setText(e.target.value); setName(''); setHash(e.target.value ? evidenceHash(e.target.value) : ''); }}
        />
      </div>
      {hash && (
        <div className={`verify-result ${match ? 'ok' : 'bad'}`}>
          {match ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <div>
            <b>{match ? 'Evidence matches the onchain hash' : 'Hash does not match'}</b>
            <code>{hash}</code>
          </div>
        </div>
      )}
    </div>
  );
}

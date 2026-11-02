import React from 'react';
import './brand.css';

export default function Brand({ compact = false }) {
  return <span className="iai-brand" role="img" aria-label="IAI doutor">
    <svg className="iai-symbol" viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
      <path className="iai-symbol-ink" d="M19 30C7 35 2 45 2 59V73C2 88 12 96 28 96H50C40 92 38 84 38 73V59C38 47 32 38 19 30Z" />
      <path fill="currentColor" fillRule="evenodd" d="M36 2C17 2 10 12 14 25C17 36 31 40 44 44C55 47 61 54 61 66V81C61 89 66 93 75 93H83L96 100C98 101 100 99 100 96V30C100 10 88 2 68 2H36ZM45 20A10 10 0 1 0 45 40A10 10 0 1 0 45 20Z" clipRule="evenodd" />
    </svg>
    {!compact && <span className="iai-wordmark" aria-hidden="true"><span className="iai-name">IAI</span><span className="iai-doctor">doutor</span></span>}
  </span>;
}

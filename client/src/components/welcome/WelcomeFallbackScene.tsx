import type { JSX } from 'react';
import { BrandMark } from '../BrandMark';
import { IconFile, IconLock, IconShield } from '../ui/Icons';

export function WelcomeFallbackScene(): JSX.Element {
  return (
    <div className="welcome-fallback-scene" aria-hidden="true">
      <div className="welcome-fallback-glow" />

      {/* Floating Document Cards (CSS 3D) */}
      <div className="welcome-fallback-doc welcome-fallback-doc-left">
        <div className="welcome-doc-inner">
          <div className="welcome-doc-badge">
            <IconLock width={12} height={12} />
            <span>CONFIDENTIAL</span>
          </div>
          <div className="welcome-doc-title">
            <IconFile width={14} height={14} />
            <span>Audit_Ledger.enc</span>
          </div>
          <div className="welcome-doc-lines">
            <span style={{ width: '85%' }} />
            <span style={{ width: '65%' }} />
            <span style={{ width: '75%' }} />
          </div>
          <div className="welcome-doc-tag">SHA-256 Chain</div>
        </div>
      </div>

      <div className="welcome-fallback-doc welcome-fallback-doc-right">
        <div className="welcome-doc-inner">
          <div className="welcome-doc-badge">
            <IconShield width={12} height={12} />
            <span>RESTRICTED</span>
          </div>
          <div className="welcome-doc-title">
            <IconFile width={14} height={14} />
            <span>Security_Policy.pdf</span>
          </div>
          <div className="welcome-doc-lines">
            <span style={{ width: '90%' }} />
            <span style={{ width: '60%' }} />
            <span style={{ width: '80%' }} />
          </div>
          <div className="welcome-doc-tag">Zero-Knowledge</div>
        </div>
      </div>

      {/* Central 3D Shield */}
      <div className="welcome-fallback-shield-container">
        <div className="welcome-fallback-shield-glow" />
        <div className="welcome-fallback-shield-frame">
          <BrandMark size={140} />
        </div>
      </div>
    </div>
  );
}

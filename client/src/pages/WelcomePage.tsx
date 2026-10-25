import { useEffect, useState, type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/BrandMark';
import { WelcomeScene } from '../components/welcome/WelcomeScene';
import { useAuth } from '../context/AuthContext';
import { getPostAuthRedirect } from '../lib/routes';

export function WelcomePage(): JSX.Element {
  const navigate = useNavigate();
  const { status, user } = useAuth();
  const [isExiting, setIsExiting] = useState(false);

  // If already authenticated, the destination will be their dashboard
  const destination = status === 'authenticated' ? getPostAuthRedirect(null, user) : '/login';

  const handleEnter = () => {
    if (isExiting) return;
    setIsExiting(true);
    try {
      sessionStorage.setItem('trustvault_welcome_seen', '1');
    } catch {
      // sessionStorage might fail in strict private modes
    }

    // Play smooth 450ms cinematic exit transition before navigation
    setTimeout(() => {
      navigate(destination);
    }, 450);
  };

  const handleSkip = () => {
    try {
      sessionStorage.setItem('trustvault_welcome_seen', '1');
    } catch {
      // ignore
    }
    navigate(destination);
  };

  // Keyboard accessibility: Escape to skip, Enter to enter
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [destination]);

  return (
    <div
      className={`welcome-page ${isExiting ? 'welcome-page-exiting' : ''}`}
      role="main"
      aria-label="Welcome to TrustVault"
    >
      {/* 3D Animated WebGL / CSS Fallback Canvas */}
      <WelcomeScene />

      {/* Subtle Background Glow Gradients */}
      <div className="welcome-glow-top" aria-hidden="true" />
      <div className="welcome-glow-bottom" aria-hidden="true" />
      <div className="welcome-grid-overlay" aria-hidden="true" />

      {/* Top Header Bar */}
      <header className="welcome-header">
        <div className="welcome-brand">
          <BrandMark size={34} />
          <span className="welcome-brand-text">TrustVault</span>
          <span className="welcome-version-pill">v2.4 Enterprise</span>
        </div>

        <div className="welcome-header-actions">
          <button
            type="button"
            className="welcome-skip-btn"
            onClick={handleSkip}
            aria-label="Skip welcome animation to login"
          >
            Skip to Login ↗
          </button>
        </div>
      </header>

      {/* Center Cinematic Content */}
      <div className="welcome-content-wrap">
        <div className="welcome-hero-content">
          <div className="welcome-eyebrow-badge">
            <span className="welcome-pulse-dot" aria-hidden="true" />
            <span>ENTERPRISE ZERO-TRUST SECURITY</span>
          </div>

          <h1 className="welcome-title">
            <span className="welcome-title-line">WELCOME TO</span>{' '}
            <span className="welcome-title-accent">TRUSTVAULT</span>
          </h1>

          <p className="welcome-tagline">
            Your Documents. Your Control. Your Security.
          </p>

          <p className="welcome-description">
            Cryptographic audit trails, multi-tenant workspace isolation, and sovereign document
            protection engineered for modern enterprise security.
          </p>

          {/* Feature Badges */}
          <div className="welcome-feature-pills" aria-label="Core Security Capabilities">
            <div className="welcome-pill">
              <span className="welcome-pill-icon" aria-hidden="true">🛡️</span>
              <span>SHA-256 Hash Chain</span>
            </div>
            <div className="welcome-pill">
              <span className="welcome-pill-icon" aria-hidden="true">🔒</span>
              <span>Strict Multi-Tenant Isolation</span>
            </div>
            <div className="welcome-pill">
              <span className="welcome-pill-icon" aria-hidden="true">⚡</span>
              <span>Real-Time Tamper Evidence</span>
            </div>
          </div>

          {/* Glowing Enter Button */}
          <div className="welcome-cta-container">
            <button
              type="button"
              className="welcome-enter-btn"
              onClick={handleEnter}
              disabled={isExiting}
              autoFocus
              aria-label="Enter TrustVault and proceed to login"
            >
              <span className="welcome-btn-glow" aria-hidden="true" />
              <span className="welcome-btn-text">
                {isExiting ? 'Entering Vault…' : 'Enter TrustVault'}
              </span>
              <svg
                className="welcome-btn-icon"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="welcome-quick-links">
            <span>New workspace?</span>{' '}
            <Link to="/register" className="welcome-link">
              Create Company Workspace
            </Link>
            <span className="welcome-divider">•</span>
            <Link to="/platform-admin/login" className="welcome-link welcome-link-admin">
              Platform Admin Portal
            </Link>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <footer className="welcome-footer">
        <p className="welcome-footer-text">
          Press <kbd className="welcome-kbd">Enter</kbd> to proceed or{' '}
          <kbd className="welcome-kbd">Esc</kbd> to skip. Encrypted session security guaranteed.
        </p>
      </footer>
    </div>
  );
}

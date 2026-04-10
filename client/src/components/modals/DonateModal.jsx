import { Heart, Github, Coffee } from 'lucide-react';
import { useModalA11y } from '../../hooks/useModalA11y';

const KofiIcon = ({ size = 20, className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide lucide-kofi ${className}`}
  >
    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M4 8h14v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" />
    <path d="M11.64 15.3l-2.61-2.6a1.9 1.9 0 0 1 2.68-2.68l.29.28.29-.28a1.9 1.9 0 0 1 2.68 2.68l-2.6 2.6a.43.43 0 0 1-.73.01z" />
  </svg>
);

// Note: Ensure that we have a simple Kofi icon or use an image, but we can use lucid-react generic or text.
export function DonateModal({ isOpen, onClose }) {
  const modalRef = useModalA11y(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div
        className="modal donate-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Support the project"
        style={{ maxWidth: '400px' }}
      >
        <div className="modal-header" style={{ justifyContent: 'flex-start', gap: '16px' }}>
          <div
            className="modal-icon"
            style={{
              color: 'var(--primary-color)',
              background: 'rgba(var(--primary-color-rgb), 0.1)',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
            }}
          >
            <Heart size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 className="modal-title">Support the Project</h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Choose how you'd like to help us keep growing
            </p>
          </div>
        </div>

        <div className="modal-body">
          <div
            className="donate-options"
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <a
              href="https://github.com/sponsors/semi-column"
              target="_blank"
              rel="noopener noreferrer"
              className="donate-btn donate-gh"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                transition: 'all 0.2s ease',
                fontWeight: '500',
              }}
            >
              <Github size={20} />
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', flex: 1 }}>
                <span>GitHub Sponsors</span>
                <span
                  style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'normal' }}
                >
                  Preferred way to support
                </span>
              </div>
            </a>

            <a
              href="https://buymeacoffee.com/semi.column"
              target="_blank"
              rel="noopener noreferrer"
              className="donate-btn donate-bmc"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                transition: 'all 0.2s ease',
                fontWeight: '500',
              }}
            >
              <Coffee size={20} />
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', flex: 1 }}>
                <span>Buy Me a Coffee</span>
                <span
                  style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'normal' }}
                >
                  One-time donations
                </span>
              </div>
            </a>

            <a
              href="https://ko-fi.com/semicolumn"
              target="_blank"
              rel="noopener noreferrer"
              className="donate-btn donate-kofi"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                transition: 'all 0.2s ease',
                fontWeight: '500',
              }}
            >
              <KofiIcon size={20} />
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', flex: 1 }}>
                <span>Ko-fi</span>
                <span
                  style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'normal' }}
                >
                  For PayPal users
                </span>
              </div>
            </a>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
          .donate-btn:hover {
            background: var(--hover-color) !important;
            border-color: var(--primary-color) !important;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }

          @media (max-width: 767px) {
            .donate-modal {
              margin: auto !important;
              max-width: calc(100% - 32px) !important;
              border-radius: var(--radius-lg) !important;
              max-height: 90vh;
            }
            .modal-overlay:has(.donate-modal) {
              align-items: center;
              padding: 16px;
            }
          }
        `,
          }}
        />
      </div>
    </div>
  );
}

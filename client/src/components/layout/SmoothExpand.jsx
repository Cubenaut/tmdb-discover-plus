export function SmoothExpand({ show, children }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: show ? '1fr' : '0fr',
        opacity: show ? 1 : 0,
        pointerEvents: show ? 'auto' : 'none',
        transition: 'grid-template-rows 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
      }}
    >
      <div style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flow-root' }}>{children}</div>
      </div>
    </div>
  );
}

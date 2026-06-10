import { useRef } from 'react';

/**
 * Subtle 3D tilt-on-hover wrapper. Tracks the cursor over the element and applies
 * a perspective rotateX/rotateY, snapping back on leave. Pure transform — cheap,
 * GPU-composited, respects reduced-motion via the CSS transition.
 */
export default function Tilt({ className = '', max = 8, children, ...rest }) {
  const ref = useRef(null);

  function onMove(e) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-4px)`;
  }
  function reset() {
    if (ref.current) ref.current.style.transform = '';
  }

  return (
    <div
      ref={ref}
      className={`tilt ${className}`}
      onMouseMove={onMove}
      onMouseLeave={reset}
      {...rest}
    >
      {children}
    </div>
  );
}

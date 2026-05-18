import { useEffect, useRef, useState } from 'react';

/* Animated integer counter — eases from the previous value to the next.
   Used for dashboard stat cards. No dependency, requestAnimationFrame only. */
export default function CountUp({ value = 0, duration = 900, className }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return <span className={className}>{display.toLocaleString('en-US')}</span>;
}

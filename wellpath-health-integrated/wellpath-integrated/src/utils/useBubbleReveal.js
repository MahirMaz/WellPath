import { useEffect, useRef, useState } from 'react';

export function useBubbleReveal(duration = 150) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    if (open) {
      setMounted(true);
    } else if (mounted) {
      timer.current = setTimeout(() => setMounted(false), duration);
    }
    return () => clearTimeout(timer.current);
  }, [open, duration]);

  const closing = mounted && !open;
  const toggle = () => setOpen((o) => !o);
  const close = () => setOpen(false);
  return { open, setOpen, toggle, close, mounted, closing };
}

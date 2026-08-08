import { useEffect, useRef, useState } from 'react';

// Keeps a conditionally-rendered element mounted long enough to play a closing
// animation. `open` is the desired state; `mounted` says whether to render it;
// `closing` is true while it's animating out (apply your exit animation then).
// Pair with the `.bubble-anim` / `.bubble-anim.closing` CSS classes.
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
    // `mounted` is intentionally excluded so re-opening mid-close cancels cleanly.
  }, [open, duration]);

  const closing = mounted && !open;
  const toggle = () => setOpen((o) => !o);
  const close = () => setOpen(false);
  return { open, setOpen, toggle, close, mounted, closing };
}

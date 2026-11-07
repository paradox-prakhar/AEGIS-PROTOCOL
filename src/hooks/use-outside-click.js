import { useEffect } from 'react';

/**
 * Calls `callback` on a pointer-down outside `ref`. Expected by Vengeance UI's
 * expandable-bento-grid (the registry item references it but does not ship it).
 */
export function useOutsideClick(ref, callback) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      callback(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, callback]);
}

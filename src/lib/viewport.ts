import { useEffect } from 'react';
/** Useful viewport geometry is independent of the current route's document height. */
export function useGameViewport(path: string) {
  useEffect(() => {
    let baseline = window.innerHeight,
      width = window.innerWidth,
      frame = 0;
    const update = () => {
      const vv = window.visualViewport,
        height = vv?.height || window.innerHeight;
      const editable = document.activeElement?.matches(
        'textarea,input:not([type="range"]):not([type="checkbox"]):not([type="color"]):not([type="radio"]):not([type="button"]):not([type="submit"])',
      );
      if (width !== window.innerWidth) {
        width = window.innerWidth;
        baseline = window.innerHeight;
      }
      if (!editable && document.documentElement.dataset.keyboard !== 'open')
        baseline = window.innerHeight;
      baseline = Math.max(baseline, window.innerHeight);
      const compressed = height < baseline - 100;
      const keyboard =
        (!!editable && (compressed || height < 550)) ||
        (document.documentElement.dataset.keyboard === 'open' && compressed);
      document.documentElement.style.setProperty('--viewport-height', `${height}px`);
      document.documentElement.style.setProperty('--viewport-top', `${vv?.offsetTop || 0}px`);
      document.documentElement.dataset.keyboard = keyboard ? 'open' : 'closed';
    };
    const onFocus = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onFocus);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onFocus);
    };
  }, []);
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [path]);
  useEffect(() => {
    const outsideMap = (event: Event) =>
      !(event.target instanceof Element && event.target.closest('.city-map'));
    const gesture = (event: Event) => {
      if (outsideMap(event) && event.cancelable) event.preventDefault();
    };
    const multiTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) gesture(event);
    };
    document.addEventListener('gesturestart', gesture, { passive: false });
    document.addEventListener('gesturechange', gesture, { passive: false });
    document.addEventListener('touchmove', multiTouch, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', gesture);
      document.removeEventListener('gesturechange', gesture);
      document.removeEventListener('touchmove', multiTouch);
    };
  }, []);
}

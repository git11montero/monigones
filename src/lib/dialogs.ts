import { useEffect } from 'react';
/** Accesibilidad común para las ventanas existentes y las nuevas. */
export function useDialogAccessibility() {
  useEffect(() => {
    let prior: HTMLElement | null = null,
      current: HTMLElement | null = null;
    const sync = () => {
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')],
        dialog = dialogs.at(-1) || null;
      if (dialog === current) return;
      if (dialog) {
        prior = document.activeElement as HTMLElement;
        current = dialog;
        dialog.tabIndex = -1;
        requestAnimationFrame(() => {
          if (document.contains(dialog))
            (
              dialog.querySelector<HTMLElement>(
                'button:not(:disabled),input:not(:disabled),select:not(:disabled)',
              ) || dialog
            ).focus();
        });
      } else {
        current = null;
        if (prior && document.contains(prior)) prior.focus();
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true });
    const key = (e: KeyboardEvent) => {
      if (!current) return;
      const elements = [
        ...current.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ),
      ].filter((el) => el.offsetParent !== null);
      if (e.key === 'Escape') {
        const close =
          current.querySelector<HTMLButtonElement>('.modal-close') ||
          elements.find((el) => el.textContent?.trim() === 'Cancelar');
        if (close) {
          e.preventDefault();
          close.click();
        }
      }
      if (e.key === 'Tab') {
        const first = elements[0],
          last = elements.at(-1);
        if (!first) {
          e.preventDefault();
          current.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', key);
    };
  }, []);
}

import { useEffect, useMemo, useState } from 'react';
import { useBeforeUnload, useLocation } from 'react-router-dom';

const SAVE_CONFIRM_MESSAGE = 'Save these changes now?';
const DELETE_CONFIRM_MESSAGE = 'Are you sure you want to delete this data? This action may be irreversible.';
const UNSAVED_LEAVE_MESSAGE = 'You have unsaved changes. Leave this page and discard them?';

const isGuardedPath = (pathname: string): boolean => {
  if (pathname === '/admin/login' || pathname === '/owner/login') {
    return false;
  }

  return pathname.startsWith('/admin') || pathname.startsWith('/staff') || pathname.startsWith('/owner');
};

const isFormValueInput = (target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target instanceof HTMLInputElement) {
    const nonDirtyTypes = new Set(['button', 'submit', 'reset', 'hidden', 'file']);
    return !nonDirtyTypes.has(target.type);
  }

  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
};

const isLikelyDeleteAction = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const control = target.closest('button, [role="button"], a');
  if (!control) {
    return false;
  }

  if (control instanceof HTMLElement && control.dataset.skipDeleteConfirm === 'true') {
    return false;
  }

  const text = [
    control.textContent ?? '',
    (control as HTMLInputElement).value ?? '',
    control.getAttribute('aria-label') ?? '',
    control.getAttribute('title') ?? '',
  ]
    .join(' ')
    .toLowerCase();

  return /(delete|remove|trash|permanent)/.test(text);
};

const AppChangeGuards = () => {
  const location = useLocation();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const guarded = useMemo(() => isGuardedPath(location.pathname), [location.pathname]);

  useBeforeUnload(
    (event) => {
      if (!guarded || !hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
    },
    { capture: true }
  );

  useEffect(() => {
    if (!guarded) {
      setHasUnsavedChanges(false);
      return;
    }

    const handleInput = (event: Event) => {
      if (!isFormValueInput(event.target)) {
        return;
      }

      if (!event.target.closest('form')) {
        return;
      }

      setHasUnsavedChanges(true);
    };

    const handleSubmit = (event: Event) => {
      const submitEvent = event as SubmitEvent;
      const form = submitEvent.target;
      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      if (form.dataset.skipSaveConfirm === 'true') {
        setHasUnsavedChanges(false);
        return;
      }

      const shouldSave = window.confirm(SAVE_CONFIRM_MESSAGE);
      if (!shouldSave) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      setHasUnsavedChanges(false);
    };

    const handleClick = (event: MouseEvent) => {
      if (!isLikelyDeleteAction(event.target)) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const anchor = target.closest('a');
        if (!anchor || !hasUnsavedChanges) {
          return;
        }

        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          return;
        }

        const shouldLeave = window.confirm(UNSAVED_LEAVE_MESSAGE);
        if (!shouldLeave) {
          event.preventDefault();
          event.stopPropagation();
        } else {
          setHasUnsavedChanges(false);
        }
        return;
      }

      const shouldDelete = window.confirm(DELETE_CONFIRM_MESSAGE);
      if (!shouldDelete) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handlePopState = () => {
      if (!hasUnsavedChanges) {
        return;
      }

      const shouldLeave = window.confirm(UNSAVED_LEAVE_MESSAGE);
      if (shouldLeave) {
        setHasUnsavedChanges(false);
        return;
      }

      window.history.go(1);
    };

    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleInput, true);
    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('change', handleInput, true);
      document.removeEventListener('submit', handleSubmit, true);
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [guarded, hasUnsavedChanges]);

  return null;
};

export default AppChangeGuards;

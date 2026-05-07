import { useState, useCallback } from 'react';

/**
 * useConfirmDialog — State management for ConfirmDialog component.
 *
 * Usage:
 *   const confirm = useConfirmDialog();
 *   confirm.open('Delete Patient', 'Are you sure?', async () => { await deletePatient(id); });
 *   <ConfirmDialog {...confirm} onCancel={confirm.close} />
 *
 * @returns {{ isOpen: boolean, title: string, message: string, open: (title, message, onConfirm) => void, close: () => void, onConfirm: (() => void)|null }}
 */
export function useConfirmDialog() {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  const open = useCallback((title, message, onConfirm) => {
    setState({ isOpen: true, title, message, onConfirm });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }));
  }, []);

  return { ...state, open, close };
}

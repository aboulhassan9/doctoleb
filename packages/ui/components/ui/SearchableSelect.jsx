import { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * SearchableSelect — Combobox with filter-as-you-type and keyboard navigation.
 *
 * For lists where a native <select> hurts (patients, doctors, large catalogs).
 * Stays accessible: aria-combobox, aria-activedescendant, Esc closes,
 * ArrowDown/ArrowUp moves the active option, Enter selects, click-outside closes.
 *
 * Options must be `{ value, label, hint? }`. If `getOptionKey` is provided it's
 * used for React keys; otherwise `value` is used.
 *
 * @param {{
 *   label: string,
 *   value?: string | null,
 *   options: Array<{ value: string, label: string, hint?: string }>,
 *   onChange?: (next: string | null) => void,
 *   placeholder?: string,
 *   emptyMessage?: string,
 *   error?: string,
 *   required?: boolean,
 *   disabled?: boolean,
 *   className?: string,
 *   hint?: string,
 *   getOptionKey?: (option: object) => string,
 * }} props
 */
export default function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Search…',
  emptyMessage = 'No matches.',
  error,
  required = false,
  disabled = false,
  className = '',
  hint,
  getOptionKey,
}) {
  const reactId = useId();
  const fieldId = `field-${reactId}`;
  const listId = `list-${reactId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedOption = useMemo(
    () => (Array.isArray(options) ? options.find((opt) => opt.value === value) : null) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const list = Array.isArray(options) ? options : [];
    const term = query.trim().toLowerCase();
    if (!term) return list;
    return list.filter((opt) => {
      const hay = `${opt.label} ${opt.hint ?? ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    function onDocPointerDown(event) {
      if (!wrapperRef.current) return;
      if (wrapperRef.current.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) setActiveIndex(0);
  }, [open, query]);

  const commit = (option) => {
    if (typeof onChange === 'function') onChange(option ? option.value : null);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((current) => Math.min(filtered.length - 1, current + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
    } else if (event.key === 'Enter') {
      if (!open) return;
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) commit(option);
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    } else if (event.key === 'Backspace' && !query && selectedOption) {
      event.preventDefault();
      commit(null);
    }
  };

  return (
    <div ref={wrapperRef} className={`space-y-1.5 ${className}`}>
      <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div
        className={`relative rounded-xl border bg-white transition-all ${error ? 'border-red-300' : 'border-slate-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          {selectedOption && !open && (
            <button
              type="button"
              onClick={() => commit(null)}
              disabled={disabled}
              aria-label={`Clear ${label}`}
              className="grid h-6 shrink-0 place-items-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              {selectedOption.label}
              <span aria-hidden="true" className="ml-1 text-slate-400">×</span>
            </button>
          )}
          <input
            ref={inputRef}
            id={fieldId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            value={open ? query : selectedOption ? '' : query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => !disabled && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedOption && !open ? '' : placeholder}
            disabled={disabled}
            required={required && !selectedOption}
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-slate-300"
          />
        </div>
        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-slate-500" role="option" aria-selected="false">
                {emptyMessage}
              </li>
            )}
            {filtered.map((option, idx) => {
              const key = getOptionKey ? getOptionKey(option) : option.value;
              const isActive = idx === activeIndex;
              const isSelected = selectedOption?.value === option.value;
              return (
                <li
                  key={key}
                  id={`${listId}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    commit(option);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`cursor-pointer px-3 py-2 text-sm transition ${
                    isActive ? 'bg-primary/10 text-slate-900' : 'text-slate-700'
                  } ${isSelected ? 'font-semibold' : ''}`}
                >
                  <div>{option.label}</div>
                  {option.hint && (
                    <div className="text-xs text-slate-500">{option.hint}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">{hint}</p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

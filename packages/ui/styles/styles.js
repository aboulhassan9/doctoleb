/**
 * Shared CSS class constants — Single source of truth for recurring UI patterns.
 *
 * USAGE:
 *   import { INPUT_CLASS, CARD_CLASS, BUTTON_PRIMARY } from '@/lib/styles';
 *   <input className={INPUT_CLASS} />
 *
 * WHY: Eliminates 3+ different input/card/button class strings scattered across pages.
 *      When the design system changes, update ONE file, not 30 pages.
 */

// ── Form Controls ───────────────────────────────────────────────────
export const INPUT_CLASS =
  'w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-[var(--bg-card)] ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ' +
  'transition-colors duration-200 placeholder:text-slate-300';

export const SELECT_CLASS =
  'w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-[var(--bg-card)] ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ' +
  'transition-colors duration-200 appearance-none cursor-pointer';

export const TEXTAREA_CLASS =
  'w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-[var(--bg-card)] ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ' +
  'transition-colors duration-200 placeholder:text-slate-300 resize-none';

// ── Cards & Containers ──────────────────────────────────────────────
export const CARD_CLASS =
  'bg-[var(--bg-card)] rounded-lg border border-slate-200 p-6';

export const CARD_HOVER_CLASS =
  'bg-[var(--bg-card)] rounded-lg border border-slate-200 p-6 ' +
  'hover:border-primary/30 transition-colors duration-200 cursor-pointer';

// ── Buttons ─────────────────────────────────────────────────────────
export const BUTTON_PRIMARY =
  'px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg ' +
  'text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

export const BUTTON_SECONDARY =
  'px-4 py-2.5 bg-[var(--bg-card)] border border-slate-200 text-slate-700 rounded-lg ' +
  'text-sm font-medium hover:bg-slate-50 transition-colors duration-200';

export const BUTTON_DANGER =
  'px-4 py-2.5 bg-error hover:bg-red-700 text-white rounded-lg ' +
  'text-sm font-medium transition-colors duration-200';

export const BUTTON_ICON =
  'w-10 h-10 flex items-center justify-center rounded-lg bg-slate-100 ' +
  'text-slate-600 hover:bg-primary/10 hover:text-primary transition-colors duration-200';

// ── Status Badges ───────────────────────────────────────────────────
export const BADGE_BASE =
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

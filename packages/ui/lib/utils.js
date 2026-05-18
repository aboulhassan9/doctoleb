import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines class names using clsx and merges tailwind classes safely using tailwind-merge.
 *
 * @param {...(string|undefined|null|false|0|Object<string, boolean>|Array<any>)} inputs - Class name inputs
 * @returns {string} Merged class names
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

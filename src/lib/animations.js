/**
 * Shared Framer Motion animation variants.
 * Import these instead of re-declaring in every page.
 */

/** Stagger container — use on a parent to cascade children. */
export const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
};

/** Fade + slide up — standard card/row entrance. */
export const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

/** Form section fade — slightly slower, with beforeChildren. */
export const formFade = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, when: 'beforeChildren' } },
};

/* Shared motion language for the DoctoLeb console.
   One easing curve, one set of variants — applied across the app via
   framer-motion so animation stays coherent instead of ad-hoc per file. */

export const EASE = [0.22, 1, 0.36, 1];

export const transition = { duration: 0.45, ease: EASE };
export const quickTransition = { duration: 0.22, ease: EASE };

export const fade = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition },
};

export const fadeRise = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition },
};

/* Parent wrapper — children with `staggerItem` animate in sequence. */
export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition },
};

/* Full-screen view swap inside <AnimatePresence mode="wait">. */
export const screenTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition },
  exit: { opacity: 0, y: -8, transition: quickTransition },
};

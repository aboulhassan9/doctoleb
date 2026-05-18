export const patientEase = [0.22, 1, 0.36, 1];

export const patientTransition = {
  duration: 0.45,
  ease: patientEase,
};

export const patientQuickTransition = {
  duration: 0.22,
  ease: patientEase,
};

export const patientStagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.04,
    },
  },
};

export const patientFadeRise = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: patientTransition },
};

export const patientScreen = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: patientTransition },
  exit: { opacity: 0, y: -8, transition: patientQuickTransition },
};

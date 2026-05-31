import { gsap } from "gsap";

export const fadeIn = (element, options = {}) => {
  const layoutManaged = element?.dataset?.layoutManaged === "true";
  const fromVars = layoutManaged ? { autoAlpha: 0 } : { autoAlpha: 0, y: options.y ?? 8 };
  const toVars = {
    autoAlpha: 1,
    duration: options.duration ?? 0.32,
    ease: options.ease ?? "power2.out"
  };

  if (!layoutManaged) {
    toVars.y = 0;
  }

  return gsap.fromTo(element, fromVars, toVars);
};

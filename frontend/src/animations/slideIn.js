import { gsap } from "gsap";

export const slideIn = (element, options = {}) =>
  gsap.fromTo(
    element,
    {
      autoAlpha: 0,
      x: options.x ?? 28,
      y: options.y ?? 12,
      scale: options.scale ?? 0.98
    },
    {
      autoAlpha: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: options.duration ?? 0.42,
      ease: "power3.out"
    }
  );

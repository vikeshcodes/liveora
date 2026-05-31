import { gsap } from "gsap";

export const liquidGlow = (element, timeline) => {
  const glow = element.querySelector("[data-glow]");
  if (!glow) {
    return null;
  }

  const fromVars = { autoAlpha: 0.22, scaleX: 0.88 };
  const toVars = {
    autoAlpha: 0.62,
    scaleX: 1,
    duration: 0.8,
    ease: "sine.inOut",
    yoyo: true,
    repeat: 1
  };

  if (timeline) {
    return timeline.fromTo(glow, fromVars, toVars, "<");
  }

  return gsap.fromTo(glow, fromVars, toVars);
};

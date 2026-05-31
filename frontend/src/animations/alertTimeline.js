import { gsap } from "gsap";
import { liquidGlow } from "./liquidGlow";

export const alertTimeline = (element, durationMs = 5000) =>
  new Promise((resolve) => {
    const holdSeconds = Math.max(1, durationMs / 1000 - 0.76);
    const layoutManaged = element?.dataset?.layoutManaged === "true";
    const timeline = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: resolve
    });

    timeline
      .set(element, { display: "block" })
      .fromTo(
        element,
        layoutManaged ? { autoAlpha: 0 } : { autoAlpha: 0, y: -16, scale: 0.97 },
        layoutManaged ? { autoAlpha: 1, duration: 0.38 } : { autoAlpha: 1, y: 0, scale: 1, duration: 0.38 }
      );
    liquidGlow(element, timeline);
    timeline
      .to(element, { autoAlpha: 1, duration: holdSeconds })
      .to(
        element,
        layoutManaged
          ? { autoAlpha: 0, duration: 0.38, ease: "power2.in" }
          : { autoAlpha: 0, y: -10, scale: 0.985, duration: 0.38, ease: "power2.in" }
      )
      .set(element, { display: "none" });
  });

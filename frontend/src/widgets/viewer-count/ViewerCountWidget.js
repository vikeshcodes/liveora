import { fadeIn } from "../../animations/fadeIn";
import { compactNumber, setWidgetPosition } from "../widgetUtils";
import "./viewer-count.css";

export class ViewerCountWidget {
  constructor(config = {}) {
    this.config = config;
    this.element = null;
    this.currentValue = 0;
  }

  render(parent) {
    this.element = document.createElement("section");
    this.element.className = "widget viewer-widget glass-panel";
    this.element.innerHTML = `
      <span class="viewer-dot"></span>
      <span class="viewer-value">0</span>
      <span class="viewer-label">watching</span>
    `;
    setWidgetPosition(this.element, this.config.position ?? "top-left");
    parent.appendChild(this.element);
    return this.element;
  }

  updateConfig(config = {}) {
    this.config = { ...this.config, ...config };
    if (this.element) {
      setWidgetPosition(this.element, this.config.position ?? "top-left");
      this.element.classList.toggle("is-hidden", this.config.enabled === false);
    }
  }

  update(value) {
    if (!this.element) {
      return;
    }

    const target = Number(value ?? 0);
    const start = this.currentValue;
    this.currentValue = target;
    const startedAt = performance.now();
    const duration = 420;
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(start + (target - start) * eased);
      this.element.querySelector(".viewer-value").textContent = compactNumber(next);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    fadeIn(this.element, { y: 4, duration: 0.2 });
  }

  show() {
    this.element?.classList.remove("is-hidden");
  }

  hide() {
    this.element?.classList.add("is-hidden");
  }

  animate() {
    return this.element ? fadeIn(this.element) : null;
  }

  cleanup() {
    this.element?.remove();
  }
}

import { fadeIn } from "../../animations/fadeIn";
import { formatAmount, setWidgetPosition } from "../widgetUtils";
import "./goal.css";

export class GoalWidget {
  constructor(config = {}) {
    this.config = config;
    this.element = null;
    this.bar = null;
  }

  render(parent) {
    this.element = document.createElement("section");
    this.element.className = "widget goal-widget glass-panel";
    this.element.innerHTML = `
      <div class="goal-topline">
        <span class="goal-title">Creator Goal</span>
        <span class="goal-percent">0%</span>
      </div>
      <div class="goal-track">
        <div class="goal-bar"></div>
      </div>
      <div class="goal-values">
        <span class="goal-current">0</span>
        <span class="goal-target">0</span>
      </div>
    `;
    this.bar = this.element.querySelector(".goal-bar");
    setWidgetPosition(this.element, this.config.position ?? "top-center");
    parent.appendChild(this.element);
    return this.element;
  }

  updateConfig(config = {}) {
    this.config = { ...this.config, ...config };
    if (this.element) {
      setWidgetPosition(this.element, this.config.position ?? "top-center");
      this.element.classList.toggle("is-hidden", this.config.enabled === false);
    }
  }

  update(goal) {
    if (!this.element || !goal) {
      return;
    }

    const current = Number(goal.currentValue ?? 0);
    const target = Math.max(1, Number(goal.targetValue ?? 1));
    const percent = Math.min(100, Math.round((current / target) * 100));

    this.element.querySelector(".goal-title").textContent = goal.title ?? "Creator Goal";
    this.element.querySelector(".goal-percent").textContent = `${percent}%`;
    this.element.querySelector(".goal-current").textContent = formatAmount(current, goal.currency);
    this.element.querySelector(".goal-target").textContent = formatAmount(target, goal.currency);
    this.bar.style.transform = `scaleX(${percent / 100})`;
    fadeIn(this.element, { y: 6, duration: 0.22 });
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

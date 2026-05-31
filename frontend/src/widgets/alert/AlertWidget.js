import { gsap } from "gsap";
import { alertTimeline } from "../../animations/alertTimeline";
import { applyWidgetLayout, formatAmount, setWidgetPosition, titleForEvent } from "../widgetUtils";
import "./alert.css";

export class AlertWidget {
  constructor(config = {}) {
    this.config = config;
    this.element = null;
    this.layouts = {};
  }

  render(parent) {
    this.element = document.createElement("section");
    this.element.className = "widget alert-widget";
    this.element.setAttribute("aria-live", "polite");
    this.element.style.display = "none";
    setWidgetPosition(this.element, this.config.position ?? "top-right");
    parent.appendChild(this.element);
    return this.element;
  }

  updateConfig(config = {}) {
    this.config = { ...this.config, ...config };
    if (this.element) {
      setWidgetPosition(this.element, this.config.position ?? "top-right");
      this.element.classList.toggle("is-disabled", this.config.enabled === false);
    }
  }

  updateLayouts(layouts = {}) {
    this.layouts = layouts;
    if (this.element) {
      applyWidgetLayout(this.element, this.layoutForType("subscriber"));
    }
  }

  layoutForType(type) {
    if (type === "superchat" || type === "donation") {
      return this.layouts["superchat-widget"] ?? this.layouts["alert-widget"];
    }
    if (type === "announcement") {
      return this.layouts["announcement-widget"] ?? this.layouts["alert-widget"];
    }
    return this.layouts["alert-widget"];
  }

  async show(event, durationMs) {
    if (!this.element || this.config.enabled === false) {
      return;
    }

    const layout = this.layoutForType(event.type);
    if (layout?.visible === false) {
      return;
    }

    gsap.killTweensOf(this.element);
    this.element.className = `widget alert-widget alert-type-${event.type}`;
    if (layout) {
      applyWidgetLayout(this.element, layout);
    } else {
      setWidgetPosition(this.element, this.config.position ?? "top-right");
    }

    const amount = event.displayAmount ?? formatAmount(event.amount, event.currency);
    const avatar = event.avatarUrl ?? event.meta?.avatarUrl ?? "";
    const levelName = event.levelName ?? event.meta?.levelName ?? "";
    this.element.innerHTML = `
      <div class="alert-card">
        <div class="alert-glow" data-glow></div>
        <div class="alert-kicker"></div>
        <div class="alert-main">
          <div class="alert-mark">${avatar ? `<img alt="" src="${avatar}" />` : ""}</div>
          <div class="alert-copy">
            <div class="alert-title"></div>
            <div class="alert-name"></div>
            <div class="alert-message"></div>
            <div class="alert-level"></div>
          </div>
          <div class="alert-amount"></div>
        </div>
      </div>
    `;

    this.element.querySelector(".alert-kicker").textContent = titleForEvent(event.type);
    this.element.querySelector(".alert-title").textContent =
      event.type === "announcement" ? event.username ?? "Announcement" : titleForEvent(event.type);
    this.element.querySelector(".alert-name").textContent = event.username ?? "Community";
    this.element.querySelector(".alert-message").textContent = event.message ?? "Thanks for supporting the stream.";
    this.element.querySelector(".alert-level").textContent = levelName ? `Level: ${levelName}` : "";
    this.element.querySelector(".alert-amount").textContent = amount;

    await alertTimeline(this.element, durationMs ?? this.config.duration ?? 5000);
  }

  hide() {
    if (this.element) {
      this.element.style.display = "none";
    }
  }

  animate() {
    if (this.element) {
      return alertTimeline(this.element, this.config.duration ?? 5000);
    }

    return Promise.resolve();
  }

  cleanup() {
    if (this.element) {
      gsap.killTweensOf(this.element);
      this.element.remove();
    }
  }
}

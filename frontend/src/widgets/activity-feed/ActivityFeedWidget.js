import { fadeIn } from "../../animations/fadeIn";
import { formatAmount, setWidgetPosition, titleForEvent } from "../widgetUtils";
import "./activity-feed.css";

export class ActivityFeedWidget {
  constructor(config = {}) {
    this.config = config;
    this.element = null;
    this.list = null;
    this.items = [];
  }

  render(parent) {
    this.element = document.createElement("section");
    this.element.className = "widget activity-widget glass-panel";
    this.element.innerHTML = `
      <header class="widget-header">
        <span class="status-dot"></span>
        <span>Activity</span>
      </header>
      <ol class="activity-list"></ol>
    `;
    this.list = this.element.querySelector(".activity-list");
    setWidgetPosition(this.element, this.config.position ?? "middle-right");
    parent.appendChild(this.element);
    return this.element;
  }

  updateConfig(config = {}) {
    this.config = { ...this.config, ...config };
    if (this.element) {
      setWidgetPosition(this.element, this.config.position ?? "middle-right");
      this.element.classList.toggle("is-hidden", this.config.enabled === false);
    }
    this.trim();
  }

  addEvent(event) {
    if (!this.list || this.config.enabled === false) {
      return;
    }

    const item = document.createElement("li");
    item.className = `activity-item activity-${event.type}`;

    const title = document.createElement("span");
    title.className = "activity-title";
    title.textContent = titleForEvent(event.type);

    const detail = document.createElement("span");
    detail.className = "activity-detail";
    const amount = formatAmount(event.amount, event.currency);
    detail.textContent = [event.username, amount].filter(Boolean).join(" - ") || event.message || "Stream event";

    item.append(title, detail);
    this.list.prepend(item);
    this.items.unshift(item);
    this.trim();
    fadeIn(item, { y: -8, duration: 0.24 });
  }

  trim() {
    const maxItems = this.config.maxItems ?? 6;
    while (this.items.length > maxItems) {
      const oldest = this.items.pop();
      oldest?.remove();
    }
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

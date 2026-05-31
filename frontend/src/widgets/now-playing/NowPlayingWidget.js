import { fadeIn } from "../../animations/fadeIn";
import { setWidgetPosition } from "../widgetUtils";
import "./now-playing.css";

export class NowPlayingWidget {
  constructor(config = {}) {
    this.config = config;
    this.element = null;
  }

  render(parent) {
    this.element = document.createElement("section");
    this.element.className = "widget now-playing-widget glass-panel";
    this.element.innerHTML = `
      <span class="now-label">Now Playing</span>
      <strong class="now-title">No track connected</strong>
      <span class="now-source">Local placeholder</span>
    `;
    setWidgetPosition(this.element, this.config.position ?? "bottom-right");
    parent.appendChild(this.element);
    return this.element;
  }

  updateConfig(config = {}) {
    this.config = { ...this.config, ...config };
    if (this.element) {
      setWidgetPosition(this.element, this.config.position ?? "bottom-right");
      this.element.classList.toggle("is-hidden", this.config.enabled === false);
    }
  }

  update(track = {}) {
    if (!this.element) {
      return;
    }

    this.element.querySelector(".now-title").textContent = track.title ?? "No track connected";
    this.element.querySelector(".now-source").textContent = track.source ?? "Local placeholder";
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

import { fadeIn } from "../../animations/fadeIn";
import { setWidgetPosition } from "../widgetUtils";
import "./timer.css";

const formatRemaining = (ms) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const padded = [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${padded}` : padded;
};

export class TimerWidget {
  constructor(config = {}) {
    this.config = config;
    this.element = null;
    this.state = null;
    this.interval = null;
  }

  render(parent) {
    this.element = document.createElement("section");
    this.element.className = "widget timer-widget glass-panel";
    this.element.innerHTML = `
      <span class="timer-label">Focus Timer</span>
      <strong class="timer-value">25:00</strong>
      <span class="timer-state">Ready</span>
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

  handleEvent(event) {
    if (event.meta?.timer) {
      this.update(event.meta.timer);
    }
  }

  update(state) {
    this.state = state;
    this.restartTicker();
    this.updateDisplay();
    if (this.element) {
      fadeIn(this.element, { y: 4, duration: 0.22 });
    }
  }

  restartTicker() {
    clearInterval(this.interval);
    if (this.state?.status === "running") {
      this.interval = setInterval(() => this.updateDisplay(), 1000);
    }
  }

  getRemainingMs() {
    if (!this.state) {
      return 25 * 60 * 1000;
    }

    if (this.state.status === "running" && this.state.endsAt) {
      return Math.max(0, new Date(this.state.endsAt).getTime() - Date.now());
    }

    return this.state.remainingMs;
  }

  updateDisplay() {
    if (!this.element) {
      return;
    }

    const status = this.state?.status ?? "idle";
    this.element.querySelector(".timer-value").textContent = formatRemaining(this.getRemainingMs());
    this.element.querySelector(".timer-state").textContent =
      status === "running" ? "Running" : status === "paused" ? "Paused" : "Ready";
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
    clearInterval(this.interval);
    this.element?.remove();
  }
}

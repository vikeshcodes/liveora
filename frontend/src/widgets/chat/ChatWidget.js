import { fadeIn } from "../../animations/fadeIn";
import { setWidgetPosition } from "../widgetUtils";
import { youtubeBadgeLabel } from "../widgetUtils";
import "./chat.css";

export class ChatWidget {
  constructor(config = {}) {
    this.config = config;
    this.element = null;
    this.list = null;
    this.messages = [];
  }

  render(parent) {
    this.element = document.createElement("section");
    this.element.className = "widget chat-widget glass-panel";
    this.element.innerHTML = `
      <header class="widget-header">
        <span class="status-dot"></span>
        <span>Live Chat</span>
      </header>
      <ol class="chat-list"></ol>
    `;
    this.list = this.element.querySelector(".chat-list");
    setWidgetPosition(this.element, this.config.position ?? "bottom-left");
    parent.appendChild(this.element);
    return this.element;
  }

  updateConfig(config = {}) {
    this.config = { ...this.config, ...config };
    if (this.element) {
      setWidgetPosition(this.element, this.config.position ?? "bottom-left");
      this.element.classList.toggle("is-hidden", this.config.enabled === false);
    }
    this.trim();
  }

  addMessage(event) {
    if (!this.list || this.config.enabled === false) {
      return;
    }

    const item = document.createElement("li");
    item.className = "chat-message";

    const avatar = document.createElement("span");
    avatar.className = "chat-avatar";
    if (event.avatarUrl || event.meta?.avatarUrl) {
      const image = document.createElement("img");
      image.alt = "";
      image.src = event.avatarUrl ?? event.meta.avatarUrl;
      avatar.appendChild(image);
    }

    const body = document.createElement("span");
    body.className = "chat-body";

    const author = document.createElement("span");
    author.className = "chat-author";
    author.textContent = event.username ?? "Viewer";

    const badges = document.createElement("span");
    badges.className = "chat-badges";
    youtubeBadgeLabel(event).forEach((label) => {
      const badge = document.createElement("span");
      badge.className = `chat-badge chat-badge-${label}`;
      badge.textContent = label;
      badges.appendChild(badge);
    });

    const message = document.createElement("span");
    message.className = "chat-text";
    message.textContent = event.message ?? "";

    body.append(author, badges, message);
    item.append(avatar, body);
    this.list.appendChild(item);
    this.messages.push(item);
    this.trim();
    fadeIn(item, { y: 10, duration: 0.26 });
  }

  trim() {
    const maxMessages = this.config.maxMessages ?? 8;
    while (this.messages.length > maxMessages) {
      const oldest = this.messages.shift();
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
    if (this.element) {
      return fadeIn(this.element);
    }

    return null;
  }

  cleanup() {
    this.element?.remove();
  }
}

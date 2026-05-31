const PRIORITY = {
  superchat: 1,
  donation: 2,
  membership: 2,
  subscriber: 3,
  announcement: 5,
  test_alert: 5,
  chat: 6
};

export class EventQueue {
  constructor({ alertWidget, maxLength = 30, durationMs = 5000, onChange = () => {} }) {
    this.alertWidget = alertWidget;
    this.maxLength = maxLength;
    this.durationMs = durationMs;
    this.onChange = onChange;
    this.queue = [];
    this.active = false;
    this.sequence = 0;
  }

  configure({ maxLength, durationMs }) {
    if (Number.isFinite(maxLength)) {
      this.maxLength = maxLength;
    }

    if (Number.isFinite(durationMs)) {
      this.durationMs = durationMs;
    }

    this.trim();
    this.onChange(this.snapshot());
  }

  enqueue(event) {
    if (!event || !event.id) {
      return;
    }

    this.queue.push({
      event,
      priority: PRIORITY[event.type] ?? 10,
      sequence: this.sequence++
    });
    this.queue.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
    this.trim();
    this.onChange(this.snapshot());
    void this.process();
  }

  snapshot() {
    return {
      active: this.active,
      length: this.queue.length
    };
  }

  trim() {
    if (this.queue.length > this.maxLength) {
      this.queue.length = this.maxLength;
    }
  }

  async process() {
    if (this.active || !this.alertWidget) {
      return;
    }

    const next = this.queue.shift();
    if (!next) {
      this.onChange(this.snapshot());
      return;
    }

    this.active = true;
    this.onChange(this.snapshot());

    try {
      await this.alertWidget.show(next.event, next.event.meta?.durationMs ?? this.durationMs);
    } finally {
      this.active = false;
      this.onChange(this.snapshot());
      void this.process();
    }
  }
}

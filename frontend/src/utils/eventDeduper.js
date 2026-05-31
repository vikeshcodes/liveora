export class EventDeduper {
  constructor(maxSize = 400) {
    this.maxSize = maxSize;
    this.ids = new Set();
    this.order = [];
  }

  remember(id) {
    if (!id) {
      return true;
    }

    if (this.ids.has(id)) {
      return false;
    }

    this.ids.add(id);
    this.order.push(id);

    while (this.order.length > this.maxSize) {
      const oldest = this.order.shift();
      this.ids.delete(oldest);
    }

    return true;
  }
}

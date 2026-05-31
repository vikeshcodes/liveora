export const setWidgetPosition = (element, position) => {
  [...element.classList]
    .filter((className) => className.startsWith("widget-position-"))
    .forEach((className) => element.classList.remove(className));
  element.classList.add(`widget-position-${position}`);
  element.style.removeProperty("left");
  element.style.removeProperty("top");
  element.style.removeProperty("width");
  element.style.removeProperty("min-width");
  element.style.removeProperty("height");
  element.style.removeProperty("z-index");
  element.style.removeProperty("transform");
  delete element.dataset.layoutManaged;
};

export const clearWidgetPositionClasses = (element) => {
  [...element.classList]
    .filter((className) => className.startsWith("widget-position-"))
    .forEach((className) => element.classList.remove(className));
};

export const applyWidgetLayout = (element, layout) => {
  if (!element || !layout) {
    return;
  }

  clearWidgetPositionClasses(element);
  element.style.left = "0";
  element.style.top = "0";
  element.style.width = `${layout.width}px`;
  element.style.minWidth = `${layout.width}px`;
  element.style.height = `${layout.height}px`;
  element.style.zIndex = String(layout.zIndex ?? 10);
  element.style.transform = `translate3d(${layout.x}px, ${layout.y}px, 0)`;
  element.dataset.layoutManaged = "true";
  element.classList.toggle("is-hidden", layout.visible === false);
};

export const formatAmount = (amount, currency) => {
  if (amount === null || amount === undefined) {
    return "";
  }

  if (!currency) {
    return String(amount);
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

export const youtubeBadgeLabel = (event) => {
  const badges = [];
  if (event.isChatOwner || event.meta?.isChatOwner) badges.push("owner");
  if (event.isChatModerator || event.meta?.isChatModerator) badges.push("mod");
  if (event.isChatSponsor || event.meta?.isChatSponsor) badges.push("member");
  if (event.isVerified || event.meta?.isVerified) badges.push("verified");
  return badges;
};

export const compactNumber = (value) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(Number(value ?? 0));

export const titleForEvent = (type) => {
  const labels = {
    subscriber: "New Subscriber",
    superchat: "Superchat",
    donation: "Donation",
    membership: "New Member",
    announcement: "Announcement",
    test_alert: "Test Alert",
    chat: "Live Chat",
    goal_update: "Goal Update",
    timer_start: "Timer Started",
    timer_pause: "Timer Paused",
    timer_reset: "Timer Reset"
  };

  return labels[type] ?? "Stream Event";
};

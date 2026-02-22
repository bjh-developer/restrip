// assuming GMT+8

export type DeliveryPeriod = "surprise" | "custom period" | "custom date";
const GMT8_OFFSET_MS = 8 * 60 * 60 * 1000;
const SURPRISE_MIN_DAYS = 30;
const SURPRISE_MAX_DAYS = 180;
const DELIVERY_WINDOW_START_HOUR = 9;
const DELIVERY_WINDOW_END_HOUR = 21;
const DELIVERY_SLOT_MINUTES = 15;
const MIN_LEAD_MINUTES = 60;

interface Gmt8Parts {
  year: number; month: number; day: number; hour: number; minute: number;
}

function getGmt8Parts(date: Date): Gmt8Parts {
  const shifted = new Date(date.getTime() + GMT8_OFFSET_MS);
  return {year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate(), hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(),};
}

function fromGmt8WallClock(
  year: number, month: number, day: number, hour: number, minute: number,
): Date {
  const utcMillis = Date.UTC(year, month, day, hour, minute, 0, 0);
  return new Date(utcMillis - GMT8_OFFSET_MS);
}

function startOfGmt8Day(date: Date): Date {
  const { year, month, day } = getGmt8Parts(date);
  return fromGmt8WallClock(year, month, day, 0, 0);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomSlotMinute(): number {
  const slotsPerHour = 60 / DELIVERY_SLOT_MINUTES;
  const slot = randomIntInclusive(0, slotsPerHour - 1);
  return slot * DELIVERY_SLOT_MINUTES;
}

function randomWindowTimeOnDay(day: Date): Date {
  const { year, month, day: dayOfMonth } = getGmt8Parts(day);
  const hour = randomIntInclusive( DELIVERY_WINDOW_START_HOUR, DELIVERY_WINDOW_END_HOUR - 1, );
  return fromGmt8WallClock(year, month, dayOfMonth, hour, randomSlotMinute());
}

function ceilToNextSlotMinute(minute: number): number {
  return Math.ceil(minute / DELIVERY_SLOT_MINUTES) * DELIVERY_SLOT_MINUTES;
}

function earliestAllowedDelivery(now: Date): Date {
  const withLead = new Date(now.getTime() + MIN_LEAD_MINUTES * 60 * 1000);
  const parts = getGmt8Parts(withLead);
  if (parts.hour < DELIVERY_WINDOW_START_HOUR) { return fromGmt8WallClock( parts.year, parts.month, parts.day, DELIVERY_WINDOW_START_HOUR,0, ); }
  if (parts.hour >= DELIVERY_WINDOW_END_HOUR) {
    const nextDay = addDays( fromGmt8WallClock(parts.year, parts.month, parts.day, 0, 0), 1, );
    const next = getGmt8Parts(nextDay);
    return fromGmt8WallClock( next.year, next.month, next.day, DELIVERY_WINDOW_START_HOUR, 0, );
  }
  let hour = parts.hour;
  let minute = ceilToNextSlotMinute(parts.minute);
  if (minute >= 60) { minute = 0; hour += 1; }
  if (hour >= DELIVERY_WINDOW_END_HOUR) {
    const nextDay = addDays( fromGmt8WallClock(parts.year, parts.month, parts.day, 0, 0), 1, );
    const next = getGmt8Parts(nextDay);
    return fromGmt8WallClock( next.year, next.month, next.day, DELIVERY_WINDOW_START_HOUR, 0, );
  }
  return fromGmt8WallClock(parts.year, parts.month, parts.day, hour, minute);
}

function clampToAllowedWindow(candidate: Date, now: Date): Date {
  const minimum = earliestAllowedDelivery(now);
  return candidate.getTime() < minimum.getTime() ? minimum : candidate;
}

function surpriseDeliveryTime(now: Date): Date {
  const randomDays = randomIntInclusive(SURPRISE_MIN_DAYS, SURPRISE_MAX_DAYS);
  const targetDay = addDays(startOfGmt8Day(now), randomDays);
  return randomWindowTimeOnDay(targetDay);
}

export function computeScheduledSendTime(
  period: DeliveryPeriod,
  selectedDate?: Date,
  now: Date = new Date(),
): Date | undefined {
  if (period === "surprise") { return surpriseDeliveryTime(now); }
  if (!selectedDate) { return undefined; }
  if (period === "custom date") {
    const randomized = randomWindowTimeOnDay(selectedDate);
    return clampToAllowedWindow(randomized, now);
  }
  const randomized = randomWindowTimeOnDay(selectedDate);
  return clampToAllowedWindow(randomized, now);
}

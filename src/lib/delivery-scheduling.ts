import { DateTime } from "luxon";

export type DeliveryPeriod = "surprise" | "custom period" | "custom date";

const SURPRISE_MIN_DAYS = 30;
const SURPRISE_MAX_DAYS = 180;
const DELIVERY_WINDOW_START_HOUR = 9;
const DELIVERY_WINDOW_END_HOUR = 21;
const DELIVERY_SLOT_MINUTES = 15;
const MIN_LEAD_MINUTES = 60;

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomSlotMinute(): number {
  const slot = randomIntInclusive(0, 60 / DELIVERY_SLOT_MINUTES - 1);
  return slot * DELIVERY_SLOT_MINUTES;
}

function randomWindowTimeOnDay(day: DateTime): DateTime {
  const hour = randomIntInclusive(
    DELIVERY_WINDOW_START_HOUR,
    DELIVERY_WINDOW_END_HOUR - 1,
  );
  return day.set({
    hour,
    minute: randomSlotMinute(),
    second: 0,
    millisecond: 0,
  });
}

function ceilToNextSlot(dt: DateTime): DateTime {
  const ceiled =
    Math.ceil(dt.minute / DELIVERY_SLOT_MINUTES) * DELIVERY_SLOT_MINUTES;
  return dt
    .set({ minute: 0, second: 0, millisecond: 0 })
    .plus({ minutes: ceiled });
}

function earliestAllowedDelivery(now: DateTime): DateTime {
  const withLead = now.plus({ minutes: MIN_LEAD_MINUTES });

  if (withLead.hour < DELIVERY_WINDOW_START_HOUR) {
    return withLead.set({
      hour: DELIVERY_WINDOW_START_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
  }

  if (withLead.hour >= DELIVERY_WINDOW_END_HOUR) {
    return withLead.plus({ days: 1 }).set({
      hour: DELIVERY_WINDOW_START_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
  }

  const ceiled = ceilToNextSlot(withLead);

  if (ceiled.hour >= DELIVERY_WINDOW_END_HOUR) {
    return ceiled.plus({ days: 1 }).set({
      hour: DELIVERY_WINDOW_START_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
  }

  return ceiled;
}

function clampToAllowedWindow(candidate: DateTime, now: DateTime): DateTime {
  const minimum = earliestAllowedDelivery(now);
  return candidate < minimum ? minimum : candidate;
}

function surpriseDeliveryTime(now: DateTime): DateTime {
  const randomDays = randomIntInclusive(SURPRISE_MIN_DAYS, SURPRISE_MAX_DAYS);
  const targetDay = now.startOf("day").plus({ days: randomDays });
  return randomWindowTimeOnDay(targetDay);
}

export function computeScheduledSendTime(
  period: DeliveryPeriod,
  timezone: string, // e.g. "Asia/Singapore", "America/New_York"
  selectedDate?: Date,
  now: Date = new Date(),
): Date | undefined {
  const nowDt = DateTime.fromJSDate(now, { zone: timezone });

  if (period === "surprise") {
    return surpriseDeliveryTime(nowDt).toJSDate();
  }

  if (!selectedDate) return undefined;

  const selectedDt = DateTime.fromJSDate(selectedDate, {
    zone: timezone,
  }).startOf("day");
  const randomized = randomWindowTimeOnDay(selectedDt);
  return clampToAllowedWindow(randomized, nowDt).toJSDate();
}

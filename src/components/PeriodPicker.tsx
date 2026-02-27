/**
 * Period Picker Component
 */

import React, { useState, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Choicebox,
  ChoiceboxItem,
  ChoiceboxItemContent,
  ChoiceboxItemDescription,
  ChoiceboxItemHeader,
  ChoiceboxItemIndicator,
  ChoiceboxItemTitle,
} from "../components/ui/shadcn-io/choicebox";
import { format, addDays } from "date-fns";
import type { DateRange } from "react-day-picker";

export type PeriodOption = "surprise" | "custom period" | "custom date";

interface PeriodPickerProps {
  onSelect: (period: PeriodOption, customDate?: Date) => void;
}

interface PeriodConfig {
  id: PeriodOption;
  label: string;
  description: string;
}

interface CustomPeriodState {
  from: Date;
  to?: Date;
}

const MIN_PERIOD_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Last valid delivery slot in recipient's timezone */
const LAST_SLOT_HOUR = 20;
const LAST_SLOT_MINUTE = 45;

const PERIOD_OPTIONS: readonly PeriodConfig[] = [
  {
    id: "surprise",
    label: "Surprise me! 🎲",
    description: "Sends email in 1-6 months on a random day",
  },
  {
    id: "custom period",
    label: "Custom Period",
    description: "Sends email in a custom period on a random day",
  },
  {
    id: "custom date",
    label: "Custom Date",
    description: "Sends email on a specific day",
  },
] as const;

function getRandomDateInRange(startDate: Date, endDate: Date): Date {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime);
}

function getDaysDifference(startDate: Date, endDate: Date): number {
  return Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);
}

/**
 * Returns the current hour and minute in the recipient's timezone.
 */
function getPartsInTimezone(
  date: Date,
  timezone: string,
): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return { hour: +parts.hour, minute: +parts.minute };
}

/**
 * Returns true if it's too late to schedule a delivery today in the recipient's timezone.
 * "Too late" means it's past the last valid slot (20:45).
 */
function isPastLastSlotInTimezone(date: Date, timezone: string): boolean {
  const { hour, minute } = getPartsInTimezone(date, timezone);
  return (
    hour > LAST_SLOT_HOUR ||
    (hour === LAST_SLOT_HOUR && minute >= LAST_SLOT_MINUTE)
  );
}

export const PeriodPicker = React.memo(
  ({ onSelect }: PeriodPickerProps) => {
    const [selected, setSelected] = useState<PeriodOption>("surprise");
    const [showCustomDate, setShowCustomDate] = useState(false);
    const [showCustomPeriod, setShowCustomPeriod] = useState(false);
    const [customDate, setCustomDate] = useState<string>("");
    const [customPeriod, setCustomPeriod] = useState<CustomPeriodState | undefined>();
    const [randomDate, setRandomDate] = useState<Date | undefined>();

    const today = new Date();

    /**
     * Resolve effective timezone: recipient's if provided, else sender's local timezone.
     */
    const effectiveTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    /**
     * Disable today in the calendar if it's already past the last delivery slot
     * in the recipient's timezone. Otherwise only disable past dates.
     */
    const disabledDates = isPastLastSlotInTimezone(today, effectiveTimezone)
      ? [{ before: addDays(today, 1) }]
      : [{ before: today }];

    const handlePeriodSelect = useCallback(
      (period: PeriodOption) => {
        setSelected(period);
        setShowCustomPeriod(period === "custom period");
        setShowCustomDate(period === "custom date");

        if (period === "surprise") {
          onSelect(period);
        } else {
          onSelect(period);
        }
      },
      [onSelect],
    );

    const handleCustomDateChange = useCallback(
      (date: Date | undefined) => {
        if (!date) return;
        setCustomDate(date.toISOString());
        onSelect("custom date", date);
      },
      [onSelect],
    );

    const handleCustomPeriodChange = useCallback(
      (range: DateRange | undefined) => {
        if (!range?.from) {
          setCustomPeriod(undefined);
          return;
        }

        if (!range.to) {
          setCustomPeriod({ from: range.from, to: undefined });
          return;
        }

        const daysDiff = getDaysDifference(range.from, range.to);

        if (daysDiff < MIN_PERIOD_DAYS) {
          setCustomPeriod({ from: range.from, to: undefined });
          return;
        }

        setCustomPeriod({ from: range.from, to: range.to });
        const randomDeliveryDate = getRandomDateInRange(range.from, range.to);
        setRandomDate(randomDeliveryDate);
        onSelect("custom period", randomDeliveryDate);
      },
      [onSelect],
    );

    return (
      <div className="space-y-4 w-full">
        <Choicebox
          defaultValue="surprise"
          value={selected}
          onValueChange={(value) => handlePeriodSelect(value as PeriodOption)}
        >
          {PERIOD_OPTIONS.map((period) => (
            <ChoiceboxItem key={period.id} value={period.id}>
              <ChoiceboxItemHeader>
                <ChoiceboxItemTitle>{period.label}</ChoiceboxItemTitle>
                <ChoiceboxItemDescription>
                  {period.description}
                </ChoiceboxItemDescription>
              </ChoiceboxItemHeader>
              <ChoiceboxItemContent>
                <ChoiceboxItemIndicator />
              </ChoiceboxItemContent>
            </ChoiceboxItem>
          ))}
        </Choicebox>

        {showCustomPeriod && (
          <div className="mt-4 p-4 bg-pastel-blue bg-opacity-20 rounded-lg">
            <label className="block font-body font-semibold text-soft-black mb-2 text-center">
              Pick your period
            </label>
            <div className="flex justify-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    {customPeriod?.from && customPeriod?.to
                      ? `${format(customPeriod.from, "LLL dd, y")} - ${format(
                          customPeriod.to,
                          "LLL dd, y",
                        )}`
                      : "Select a date range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    onSelect={handleCustomPeriodChange}
                    selected={customPeriod}
                    disabled={disabledDates}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {randomDate && customPeriod?.from && customPeriod?.to && (
              <p className="text-xs text-grey mt-2 justify-center text-center">
                You'll open this email and smile on a random day between{" "}
                {format(customPeriod.from, "PPP")} and{" "}
                {format(customPeriod.to, "PPP")}.
              </p>
            )}
          </div>
        )}

        {showCustomDate && (
          <div className="mt-4 p-4 bg-pastel-blue bg-opacity-20 rounded-lg">
            <label className="block font-body font-semibold text-soft-black mb-2 text-center">
              Pick your date
            </label>
            <div className="flex justify-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    {customDate
                      ? format(new Date(customDate), "PPP")
                      : "Select a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    onSelect={(date) => handleCustomDateChange(date as Date)}
                    selected={customDate ? new Date(customDate) : undefined}
                    disabled={disabledDates}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {customDate && (
              <p className="text-xs text-grey mt-2 justify-center text-center">
                You'll open this email and smile on{" "}
                {format(new Date(customDate), "PPP")}.
              </p>
            )}
          </div>
        )}
      </div>
    );
  },
);

PeriodPicker.displayName = "PeriodPicker";
/**
 * Period Picker Component
 *
 * Allows users to select when their memory should be delivered.
 * Supports three delivery timing options:
 * - Surprise: Random date within 1-6 months
 * - Custom Period: Random date within a user-defined range
 * - Custom Date: Specific date chosen by user
 *
 * @module components/PeriodPicker
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
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

/**
 * Available period selection options.
 * Exported for use in parent components.
 */
export type PeriodOption = "surprise" | "custom period" | "custom date";

/** Props for the PeriodPicker component */
interface PeriodPickerProps {
  /**
   * Callback fired when user selects a delivery period.
   * @param period - The selected period type
   * @param customDate - The calculated delivery date (for surprise, this is random)
   */
  onSelect: (period: PeriodOption, customDate?: Date) => void;
}

/** Configuration for a period option */
interface PeriodConfig {
  id: PeriodOption;
  label: string;
  description: string;
}

/** State for custom period date range */
interface CustomPeriodState {
  from: Date;
  to?: Date;
}

/**
 * Minimum days required for a custom period range.
 * Ranges less than this will be rejected.
 */
const MIN_PERIOD_DAYS = 2;

/**
 * Milliseconds in one day (used for date calculations).
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Maximum months for surprise delivery (6 months).
 */
const SURPRISE_MAX_MONTHS = 6;

/**
 * Period options configuration.
 * Defines the available choices in the picker.
 */
const PERIOD_OPTIONS: readonly PeriodConfig[] = [
  {
    id: "surprise",
    label: "Surprise me! 🎲",
    description: "sends email in 1-6 months on a random day",
  },
  {
    id: "custom period",
    label: "Custom Period",
    description: "sends email in a custom period on a random day",
  },
  {
    id: "custom date",
    label: "Custom Date",
    description: "sends email on a specific day",
  },
] as const;

/**
 * Generates a random date within a given range.
 *
 * @param startDate - Start of the range
 * @param endDate - End of the range
 * @returns Random date within the range
 */
function getRandomDateInRange(startDate: Date, endDate: Date): Date {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime);
}

/**
 * Generates a surprise date (random within 1-6 months from now).
 *
 * @returns Random date 1-6 months in the future
 */
function generateSurpriseDate(): Date {
  const now = new Date();
  const maxMs = SURPRISE_MAX_MONTHS * 30 * MS_PER_DAY;
  return new Date(now.getTime() + Math.random() * maxMs);
}

/**
 * Calculates the number of days between two dates.
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of days between dates
 */
function getDaysDifference(startDate: Date, endDate: Date): number {
  return Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);
}

/**
 * Period picker component for selecting memory delivery timing.
 *
 * Provides three options for users to choose when they want to receive
 * their memory: surprise (random), custom period (random within range),
 * or custom date (specific).
 *
 * @example
 * ```tsx
 * <PeriodPicker
 *   onSelect={(period, date) => {
 *     console.log(`Selected: ${period}, Date: ${date}`);
 *   }}
 * />
 * ```
 */
export const PeriodPicker = React.memo(({ onSelect }: PeriodPickerProps) => {
  const [selected, setSelected] = useState<PeriodOption>("surprise");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showCustomPeriod, setShowCustomPeriod] = useState(false);
  const [customDate, setCustomDate] = useState<string>("");
  const [customPeriod, setCustomPeriod] = useState<
    CustomPeriodState | undefined
  >();
  const [randomDate, setRandomDate] = useState<Date | undefined>();

  const today = new Date();

  /**
   * Handles period option selection.
   * Updates UI state and triggers callback with appropriate date.
   */
  const handlePeriodSelect = useCallback(
    (period: PeriodOption) => {
      setSelected(period);
      setShowCustomPeriod(period === "custom period");
      setShowCustomDate(period === "custom date");

      if (period === "surprise") {
        const surpriseDate = generateSurpriseDate();
        onSelect(period, surpriseDate);
      } else {
        // Clear scheduled time when switching to manual selection
        onSelect(period);
      }
    },
    [onSelect],
  );

  /**
   * Handles custom date selection from calendar.
   */
  const handleCustomDateChange = useCallback(
    (date: Date | undefined) => {
      if (!date) return;

      setCustomDate(date.toISOString());
      onSelect("custom date", date);
    },
    [onSelect],
  );

  /**
   * Handles custom period range selection from calendar.
   * Validates that the range is at least MIN_PERIOD_DAYS long.
   */
  const handleCustomPeriodChange = useCallback(
    (range: DateRange | undefined) => {
      if (!range?.from) {
        setCustomPeriod(undefined);
        return;
      }

      if (!range.to) {
        // Only start date selected, waiting for end date
        setCustomPeriod({ from: range.from, to: undefined });
        return;
      }

      // Both dates selected - validate range
      const daysDiff = getDaysDifference(range.from, range.to);

      if (daysDiff < MIN_PERIOD_DAYS) {
        // Range too short, reset end date
        setCustomPeriod({ from: range.from, to: undefined });
        return;
      }

      // Valid range - set state and calculate random date
      setCustomPeriod({ from: range.from, to: range.to });
      const randomDeliveryDate = getRandomDateInRange(range.from, range.to);
      setRandomDate(randomDeliveryDate);
      onSelect("custom period", randomDeliveryDate);
    },
    [onSelect],
  );

  return (
    <div className="space-y-4 w-full">
      {/* Period Selection Options */}
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

      {/* Custom Period Picker (date range) */}
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
                  disabled={[{ before: today }]}
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

      {/* Custom Date Picker (single date) */}
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
                  disabled={[{ before: today }]}
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
});

PeriodPicker.displayName = "PeriodPicker";

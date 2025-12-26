import { useState } from "react";
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

type PeriodOption = "surprise" | "custom period" | "custom date";

interface PeriodPickerProps {
  onSelect: (period: PeriodOption, customDate?: Date) => void;
}

export function PeriodPicker({ onSelect }: PeriodPickerProps) {
  const [selected, setSelected] = useState<PeriodOption>("surprise");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showCustomPeriod, setShowCustomPeriod] = useState(false);
  const [customDate, setCustomDate] = useState<string>("");
  const [customPeriod, setCustomPeriod] = useState<
    { from: Date; to?: Date } | undefined
  >();
  const [randomDate, setRandomDate] = useState<Date | undefined>();

  const today = new Date();

  const periods: Array<{
    id: PeriodOption;
    label: string;
    description: string;
  }> = [
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
  ];

  const handlePeriodSelect = (period: PeriodOption) => {
    setSelected(period);
    setShowCustomPeriod(period === "custom period");
    setShowCustomDate(period === "custom date");

    if (period === "surprise") {
      const surpriseDate = new Date(
        today.getTime() + Math.random() * (6 * 30 * 24 * 60 * 60 * 1000) // Random date within 1-6 months
      );
      onSelect(period, surpriseDate);
    }
  };

  const handleCustomDateChange = (date: Date | undefined) => {
    if (!date) return;
    setCustomDate(date.toISOString());
    onSelect("custom date", date);
  };

  const handleCustomPeriodChange = (range: DateRange | undefined) => {
    if (range?.from) {
      if (range.to) {
        const differenceInDays = Math.ceil(
          (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (differenceInDays < 2) {
          // If the period is less than 2 days, reset the 'to' date
          setCustomPeriod({ from: range.from, to: undefined });
          return;
        }

        setCustomPeriod({ from: range.from, to: range.to });
        const random = new Date(
          range.from.getTime() +
            Math.random() * (range.to.getTime() - range.from.getTime())
        );
        setRandomDate(random);
        onSelect("custom period", random);
      } else {
        // Only 'from' date is set
        setCustomPeriod({ from: range.from, to: undefined });
      }
    } else {
      setCustomPeriod(undefined);
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* Button Group */}
      <Choicebox
        defaultValue="surprise"
        value={selected}
        onValueChange={(value) => handlePeriodSelect(value as PeriodOption)}
      >
        {periods.map((period) => (
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

      {/* Custom Period Picker */}
      {showCustomPeriod && (
        <div className="mt-4 p-4 bg-pastel-blue bg-opacity-20 rounded-lg">
          <label className="block font-body font-semibold text-soft-black mb-2">
            Pick your period
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                {customPeriod?.from && customPeriod?.to
                  ? `${format(customPeriod.from, "LLL dd, y")} - ${format(
                      customPeriod.to,
                      "LLL dd, y"
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
          {randomDate && customPeriod?.from && customPeriod?.to && (
            <p className="text-xs text-grey mt-2">
              You'll open this email and smile on a random day between{" "}
              {format(customPeriod.from, "PPP")} and{" "}
              {format(customPeriod.to, "PPP")}.
            </p>
          )}
        </div>
      )}

      {/* Custom Date Picker */}
      {showCustomDate && (
        <div className="mt-4 p-4 bg-pastel-blue bg-opacity-20 rounded-lg">
          <label className="block font-body font-semibold text-soft-black mb-2">
            Pick your date
          </label>
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
          {customDate && (
            <p className="text-xs text-grey mt-2">
              You'll open this email and smile on{" "}
              {format(new Date(customDate), "PPP")}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

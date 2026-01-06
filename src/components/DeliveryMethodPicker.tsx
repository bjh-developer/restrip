import React, { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Choicebox,
  ChoiceboxItem,
  ChoiceboxItemContent,
  ChoiceboxItemDescription,
  ChoiceboxItemHeader,
  ChoiceboxItemIndicator,
  ChoiceboxItemTitle,
} from "../components/ui/shadcn-io/choicebox";

type DeliveryMethod = "email" | "telegram";

interface DeliveryMethodPickerProps {
  onSelect: (method: DeliveryMethod, value?: string) => void;
  error?: boolean;
}

export const DeliveryMethodPicker = React.memo(
  ({ onSelect, error }: DeliveryMethodPickerProps) => {
    const [selected, setSelected] = useState<DeliveryMethod>("email");
    const [emailInput, setEmailInput] = useState<string>("");

    const methods: Array<{
      id: DeliveryMethod;
      label: string;
      description: string;
    }> = [
      {
        id: "email",
        label: "Email 📧",
        description: "Receive your memory via email",
      },
      {
        id: "telegram",
        label: "Telegram 💬",
        description: "Receive your memory via Telegram",
      },
    ];

    const handleMethodSelect = useCallback(
      (method: DeliveryMethod) => {
        setSelected(method);
        if (method === "email") {
          onSelect(method, emailInput);
        } else {
          onSelect(method, "");
        }
      },
      [onSelect, emailInput],
    );

    const handleEmailChange = useCallback(
      (value: string) => {
        setEmailInput(value);
        onSelect("email", value);
      },
      [onSelect],
    );

    return (
      <div className="space-y-4 w-full">
        {/* Method Selection */}
        <Choicebox
          defaultValue="email"
          value={selected}
          onValueChange={(value) => handleMethodSelect(value as DeliveryMethod)}
        >
          {methods.map((method) => (
            <ChoiceboxItem key={method.id} value={method.id}>
              <ChoiceboxItemHeader>
                <ChoiceboxItemTitle>{method.label}</ChoiceboxItemTitle>
                <ChoiceboxItemDescription>
                  {method.description}
                </ChoiceboxItemDescription>
              </ChoiceboxItemHeader>
              <ChoiceboxItemContent>
                <ChoiceboxItemIndicator />
              </ChoiceboxItemContent>
            </ChoiceboxItem>
          ))}
        </Choicebox>

        {/* Input Field */}
        <div className="mt-4">
          {selected === "email" && (
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Enter your email address"
                value={emailInput}
                onChange={(e) => handleEmailChange(e.target.value)}
                className={error ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}
              />
              <p className="text-sm text-gray-500">
                We'll send your memory to this email address
              </p>
            </div>
          )}
          {selected === "telegram" && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-600">
                ✅ You'll be prompted to start our Telegram bot next
              </p>
            </div>
          )}
        </div>
      </div>
    );
  },
);
DeliveryMethodPicker.displayName = "DeliveryMethodPicker";

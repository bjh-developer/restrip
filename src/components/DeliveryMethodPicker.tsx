import { useState } from "react";
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
}

export function DeliveryMethodPicker({ onSelect }: DeliveryMethodPickerProps) {
  const [selected, setSelected] = useState<DeliveryMethod>("email");
  const [inputValue, setInputValue] = useState<string>("");

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

  const handleMethodSelect = (method: DeliveryMethod) => {
    setSelected(method);
    setInputValue("");
    onSelect(method, "");
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    onSelect(selected, value);
  };

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
          <Input
            type="email"
            placeholder="Enter your email address"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
          />
        )}
        {selected === "telegram" && (
          <Input
            type="text"
            placeholder="Enter your Telegram handle (e.g., @username)"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}

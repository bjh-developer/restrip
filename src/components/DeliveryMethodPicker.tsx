import { useEffect, useState } from "react";
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
import { useAuth } from "@/src/hooks/useAuth";

type DeliveryMethod = "email" | "telegram";

interface DeliveryMethodPickerProps {
  onSelect: (method: DeliveryMethod, value?: string) => void;
}

export function DeliveryMethodPicker({ onSelect }: DeliveryMethodPickerProps) {
  const [selected, setSelected] = useState<DeliveryMethod>("email");
  const [inputValue, setInputValue] = useState<string>("");

  const { user } = useAuth();

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
    if (method === "email") {
      onSelect(method, user?.email || "");
    } else {
      setInputValue("");
      onSelect(method, "");
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    onSelect(selected, value);
  };

useEffect(() => {
    if (selected === "email" && user?.email) {
      onSelect("email", user.email);
    }
}, [user?.email])

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
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600">Sending surprise to:</p>
            <p className="font-medium text-gray-900">{user?.email}</p>
          </div>
        )}
        {selected === "telegram" && (
          <Input
            type="text"
            placeholder="Enter your Telegram handle (e.g. @username)"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}

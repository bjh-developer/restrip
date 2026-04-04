/**
 * Delivery Method Picker Component
 *
 * Allows users to select how they want to receive their memory:
 * - Email: User enters their email address
 * - Telegram: User will be prompted to start the bot later
 *
 * @module components/DeliveryMethodPicker
 */

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

/**
 * Supported delivery methods.
 * Exported for use in parent components.
 */
export type DeliveryMethod = "email" | "telegram";

/** Props for the DeliveryMethodPicker component */
interface DeliveryMethodPickerProps {
  /**
   * Callback fired when delivery method or address changes.
   * @param method - Selected delivery method
   * @param value - Email address (for email method) or empty string (for telegram)
   */
  onSelect: (method: DeliveryMethod, value?: string) => void;

  /**
   * Whether to show error styling on the email input.
   * Used for form validation feedback.
   */
  error?: boolean;

  /**
   * When true, the email input field is hidden.
   * Useful for authenticated pages where the user's email is already known.
   */
  hideEmailInput?: boolean;
}

/** Configuration for a delivery method option */
interface DeliveryMethodConfig {
  id: DeliveryMethod;
  label: string;
  description: string;
}

/**
 * Delivery method options configuration.
 * Defines the available choices in the picker.
 */
const DELIVERY_METHODS: readonly DeliveryMethodConfig[] = [
  {
    id: "email",
    label: "Email",
    description: "Receive your memory via email",
  },
  {
    id: "telegram",
    label: "Telegram",
    description: "Receive your memory via Telegram",
  },
] as const;

/**
 * Delivery method picker component for selecting notification channel.
 *
 * Provides two options for users to choose how they want to receive
 * their scheduled memory: via email or Telegram bot.
 *
 * @example
 * ```tsx
 * <DeliveryMethodPicker
 *   onSelect={(method, email) => {
 *     setDeliveryMethod(method);
 *     setEmail(email);
 *   }}
 *   error={hasValidationError}
 * />
 * ```
 */
export const DeliveryMethodPicker = React.memo(
  ({
    onSelect,
    error,
    hideEmailInput,
    defaultValue,
  }: DeliveryMethodPickerProps & { defaultValue?: DeliveryMethod }) => {
    const [selected, setSelected] = useState<DeliveryMethod>(
      defaultValue ?? "email",
    );
    const [emailInput, setEmailInput] = useState<string>("");

    /**
     * Handles delivery method selection change.
     * Notifies parent with appropriate value based on method.
     */
    const handleMethodSelect = useCallback(
      (method: DeliveryMethod) => {
        setSelected(method);

        if (method === "email") {
          // For email, pass the current email input value
          onSelect(method, emailInput);
        } else {
          // For telegram, no address needed (bot will use chat_id)
          onSelect(method, "");
        }
      },
      [onSelect, emailInput],
    );

    /**
     * Handles email input changes.
     * Updates local state and notifies parent.
     */
    const handleEmailChange = useCallback(
      (value: string) => {
        setEmailInput(value);
        onSelect("email", value);
      },
      [onSelect],
    );

    return (
      <div className="space-y-4 w-full">
        {/* Method Selection Options */}
        <Choicebox
          defaultValue="email"
          value={selected}
          onValueChange={(value) => handleMethodSelect(value as DeliveryMethod)}
        >
          {DELIVERY_METHODS.map((method) => (
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

        {/* Conditional Input Fields */}
        <div className="mt-4">
          {/* Email Input */}
          {selected === "email" && !hideEmailInput && (
            <Input
              type="email"
              placeholder="Enter your email address"
              value={emailInput}
              onChange={(e) => handleEmailChange(e.target.value)}
              className={error ? "border-red-500" : ""}
            />
          )}

          {/* Telegram Info Box */}
          {selected === "telegram" && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-600 text-center">
                You'll be prompted to start our Telegram bot next!
              </p>
            </div>
          )}
        </div>
      </div>
    );
  },
);

DeliveryMethodPicker.displayName = "DeliveryMethodPicker";

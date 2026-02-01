/**
 * Caption Form Component
 *
 * A form for collecting caption, email, and date information for a snap.
 * Currently unused but kept for potential future features. The main upload
 * flow uses inline form fields instead.
 *
 * @module components/CaptionForm
 *
 * @example
 * ```tsx
 * <CaptionForm
 *   onSubmit={(data) => console.log('Submitted:', data)}
 * />
 * ```
 */

"use client";

import { useState, useCallback } from "react";

/**
 * Form data structure for caption submissions.
 * Exported for use in parent components and tests.
 */
export interface CaptionFormData {
  /** User-written caption for the snap */
  caption: string;
  /** Recipient email address */
  email: string;
  /** Selected date in ISO format (YYYY-MM-DD) */
  date: string;
}

/** Props for the CaptionForm component */
export interface CaptionFormProps {
  /**
   * Callback invoked when form is submitted with valid data.
   * @param data - The form data containing caption, email, and date
   */
  onSubmit?: (data: CaptionFormData) => void;
}

/** Shared input/textarea CSS classes for consistent styling */
const INPUT_CLASSES =
  "w-full px-4 py-3 font-body text-soft-black border border-mist-grey rounded-sm focus:outline-none focus:border-2 focus:border-blush-pink focus:px-[15px] focus:py-[11px] placeholder:text-grey transition-all";

/** Shared label CSS classes */
const LABEL_CLASSES =
  "block font-body text-xs font-medium text-grey uppercase tracking-wide mb-2";

/**
 * Returns today's date in ISO format (YYYY-MM-DD).
 * Used as the default date value.
 */
function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * A controlled form for collecting snap metadata.
 *
 * Manages its own state and validates required fields via HTML5 validation.
 * Calls `onSubmit` with collected data when the form is submitted.
 */
export default function CaptionForm({
  onSubmit,
}: CaptionFormProps): React.JSX.Element {
  const [formData, setFormData] = useState<CaptionFormData>({
    caption: "",
    email: "",
    date: getTodayISO(),
  });

  /**
   * Handles form submission, preventing default and calling onSubmit callback.
   */
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onSubmit?.(formData);
    },
    [formData, onSubmit],
  );

  /**
   * Handles input changes, updating the corresponding field in state.
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    },
    [],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-lg space-y-4"
      aria-label="Caption form"
    >
      {/* Caption Field */}
      <div>
        <label htmlFor="caption" className={LABEL_CLASSES}>
          Caption
        </label>
        <textarea
          id="caption"
          name="caption"
          value={formData.caption}
          onChange={handleChange}
          rows={3}
          className={INPUT_CLASSES}
          placeholder="Add a caption to your snap..."
          required
          aria-required="true"
        />
      </div>

      {/* Email Field */}
      <div>
        <label htmlFor="email" className={LABEL_CLASSES}>
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={INPUT_CLASSES}
          placeholder="your@email.com"
          required
          aria-required="true"
          autoComplete="email"
        />
      </div>

      {/* Date Field */}
      <div>
        <label htmlFor="date" className={LABEL_CLASSES}>
          Date
        </label>
        <input
          type="date"
          id="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          className={INPUT_CLASSES}
          required
          aria-required="true"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full min-h-button font-body font-semibold bg-blush-pink text-soft-black rounded-md hover:bg-blush-pink-hover transition-all hover:-translate-y-0.5 active:translate-y-0"
      >
        Submit
      </button>
    </form>
  );
}

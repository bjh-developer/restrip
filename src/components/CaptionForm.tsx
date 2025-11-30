'use client';

import { useState } from 'react';

interface CaptionFormProps {
  onSubmit?: (data: FormData) => void;
}

interface FormData {
  caption: string;
  email: string;
  date: string;
}

export default function CaptionForm({ onSubmit }: CaptionFormProps) {
  const [formData, setFormData] = useState<FormData>({
    caption: '',
    email: '',
    date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-4">
      <div>
        <label htmlFor="caption" className="block font-body text-xs font-medium text-grey uppercase tracking-wide mb-2">
          Caption
        </label>
        <textarea
          id="caption"
          name="caption"
          value={formData.caption}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-3 font-body text-soft-black border border-mist-grey rounded-sm focus:outline-none focus:border-2 focus:border-blush-pink focus:px-[15px] focus:py-[11px] placeholder:text-grey transition-all"
          placeholder="Add a caption to your snap..."
          required
        />
      </div>

      <div>
        <label htmlFor="email" className="block font-body text-xs font-medium text-grey uppercase tracking-wide mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="w-full px-4 py-3 font-body text-soft-black border border-mist-grey rounded-sm focus:outline-none focus:border-2 focus:border-blush-pink focus:px-[15px] focus:py-[11px] placeholder:text-grey transition-all"
          placeholder="your@email.com"
          required
        />
      </div>

      <div>
        <label htmlFor="date" className="block font-body text-xs font-medium text-grey uppercase tracking-wide mb-2">
          Date
        </label>
        <input
          type="date"
          id="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          className="w-full px-4 py-3 font-body text-soft-black border border-mist-grey rounded-sm focus:outline-none focus:border-2 focus:border-blush-pink focus:px-[15px] focus:py-[11px] transition-all"
          required
        />
      </div>

      <button
        type="submit"
        className="w-full min-h-button font-body font-semibold bg-blush-pink text-soft-black rounded-md hover:bg-blush-pink-hover transition-all hover:-translate-y-0.5 active:translate-y-0"
      >
        Submit
      </button>
    </form>
  );
}

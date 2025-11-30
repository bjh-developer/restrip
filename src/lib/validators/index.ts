import { z } from 'zod';

// Snap validation schema
export const snapSchema = z.object({
  caption: z.string().min(1, 'Caption is required').max(500, 'Caption must be less than 500 characters'),
  email: z.string().email('Invalid email address'),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date format',
  }),
});

// Upload validation schema
export const uploadSchema = z.object({
  file: z.instanceof(File).refine((file) => file.size <= 10 * 1024 * 1024, {
    message: 'File size must be less than 10MB',
  }),
  mimeType: z.string().refine(
    (type) => ['image/jpeg', 'image/png', 'image/jpg'].includes(type),
    {
      message: 'Only JPEG and PNG images are allowed',
    }
  ),
});

export type SnapInput = z.infer<typeof snapSchema>;
export type UploadInput = z.infer<typeof uploadSchema>;

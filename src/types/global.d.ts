/**
 * Global type declarations
 */

// UserJot SDK types
interface Window {
  uj?: {
    init: (apiKey: string, options: Record<string, unknown>) => void;
    destroy?: () => void;
    [key: string]: unknown;
  };
  $ujq?: Array<[string, ...unknown[]]>;
}

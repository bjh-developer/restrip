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
  
  // Cloudflare Turnstile CAPTCHA types
  turnstile?: {
    render: (
      container: string | HTMLElement,
      options: {
        sitekey: string;
        callback?: (token: string) => void;
        "error-callback"?: () => void;
        "expired-callback"?: () => void;
        theme?: "light" | "dark" | "auto";
        size?: "normal" | "compact";
      }
    ) => string;
    reset: (widgetId?: string) => void;
    remove: (widgetId?: string) => void;
    getResponse: (widgetId?: string) => string | undefined;
  };
}

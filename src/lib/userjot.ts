/**
 * UserJot SDK Loader
 *
 * Safe initialization of the UserJot feedback widget without innerHTML.
 * Replaces direct innerHTML script injection with proper DOM APIs.
 *
 * @module lib/userjot
 */

/**
 * Load and initialize the UserJot feedback widget.
 * Returns a cleanup function to remove injected scripts.
 *
 * @param configId - The UserJot configuration/API key
 */
export function loadUserJot(configId: string): () => void {
  if (!configId) return () => {};

  // 1. Set up the queue and proxy
  const win = window as unknown as Record<string, unknown>;
  if (!win.$ujq) win.$ujq = [];
  if (!win.uj) {
    win.uj = new Proxy(
      {},
      {
        get:
          (_target: object, prop: string) =>
          (...args: unknown[]) =>
            (win.$ujq as unknown[][]).push([prop, ...args]),
      },
    );
  }

  // 2. Load the SDK script
  const sdkScript = document.createElement("script");
  sdkScript.src = "https://cdn.userjot.com/sdk/v2/uj.js";
  sdkScript.type = "module";
  sdkScript.async = true;
  document.head.appendChild(sdkScript);

  // 3. Initialize with config (via the proxy queue)
  const uj = win.uj as { init: (id: string, opts: object) => void };
  uj.init(configId, {
    widget: true,
    position: "right",
    theme: "auto",
  });

  // Return cleanup
  return () => {
    sdkScript.remove();
  };
}

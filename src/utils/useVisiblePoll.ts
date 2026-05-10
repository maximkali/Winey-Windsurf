import { useEffect, useRef } from 'react';

type Options = {
  intervalMs?: number;
  /**
   * If true, runs immediately on mount (in addition to polling).
   * Defaults to true.
   */
  runImmediately?: boolean;
  /**
   * If true, runs when the tab becomes visible and on window focus.
   * Defaults to true.
   */
  runOnFocusAndVisible?: boolean;
};

type PollContext = {
  isCancelled: () => boolean;
};

/**
 * Shared polling primitive:
 * - runs only when `document.visibilityState === 'visible'`
 * - avoids concurrent overlapping executions (`inFlight`)
 * - cleans up timers/listeners automatically
 *
 * Use this anywhere we want "live game state" without copy/pasting polling boilerplate.
 */
export function useVisiblePoll(
  fn: ((ctx: PollContext) => Promise<void> | void) | (() => Promise<void> | void),
  deps: unknown[],
  { intervalMs = 1000, runImmediately = true, runOnFocusAndVisible = true }: Options = {}
) {
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (cancelled) return;
      if (inFlightRef.current) return;
      try {
        inFlightRef.current = true;
        await (fn as unknown as (ctx: PollContext) => Promise<void> | void)({ isCancelled: () => cancelled });
      } finally {
        inFlightRef.current = false;
      }
    }

    if (runImmediately) void run();

    const pollId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void run();
    }, intervalMs);

    function onFocus() {
      if (!runOnFocusAndVisible) return;
      void run();
    }

    function onVisibilityChange() {
      if (!runOnFocusAndVisible) return;
      if (document.visibilityState === 'visible') void run();
    }

    if (runOnFocusAndVisible) {
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      if (runOnFocusAndVisible) {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('focus', onFocus);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are explicitly provided by the caller
  }, deps);
}



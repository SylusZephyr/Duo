/**
 * Where unexpected client errors go.
 *
 * This replaced a reporter that forwarded to a hosting platform's telemetry
 * hooks, which only existed inside that platform's editor preview. Nothing
 * here talks to a third party: errors are normalised and logged, and there is
 * one obvious place to add a real reporter later.
 *
 * To wire up Sentry or similar, implement `onReport` below — everything in the
 * app already funnels through `reportError`.
 */

export type ErrorContext = Record<string, unknown>;

export type ReportedError = {
  message: string;
  stack?: string;
  route: string;
  context: ErrorContext;
  at: string;
};

type Reporter = (report: ReportedError) => void;

let onReport: Reporter | null = null;

/** Register a reporter once, at startup. */
export function setErrorReporter(reporter: Reporter | null) {
  onReport = reporter;
}

/**
 * Loaders and server functions commonly throw a raw Response, whose String()
 * is the useless "[object Response]". Pull out something readable instead.
 */
export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Response) {
    return {
      message: `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`,
    };
  }
  if (error instanceof Error) {
    return { message: error.message, ...(error.stack ? { stack: error.stack } : {}) };
  }
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

export function reportError(error: unknown, context: ErrorContext = {}) {
  if (typeof window === "undefined") return;

  const { message, stack } = describeError(error);
  const report: ReportedError = {
    message,
    ...(stack ? { stack } : {}),
    route: window.location.pathname,
    context,
    at: new Date().toISOString(),
  };

  console.error("[duo]", report.message, report);

  try {
    onReport?.(report);
  } catch {
    // A failing reporter must never replace the error it was reporting.
  }
}

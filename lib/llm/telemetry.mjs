/**
 * Structured telemetry / audit trail for gateway operations.
 */

/**
 * @typedef {Object} TelemetryEvent
 * @property {string} type
 * @property {string} timestamp
 * @property {Record<string, unknown>} [data]
 */

export class TelemetrySink {
  constructor() {
    /** @type {TelemetryEvent[]} */
    this.events = [];
  }

  /**
   * @param {string} type
   * @param {Record<string, unknown>} [data]
   */
  emit(type, data = {}) {
    const event = Object.freeze({
      type,
      timestamp: new Date().toISOString(),
      data: Object.freeze({ ...data }),
    });
    this.events.push(event);
    return event;
  }

  /** @param {string} type */
  eventsOfType(type) {
    return this.events.filter((e) => e.type === type);
  }
}

/**
 * @param {TelemetrySink|null|undefined} sink
 * @param {string} type
 * @param {Record<string, unknown>} [data]
 */
export function emitTelemetry(sink, type, data) {
  sink?.emit(type, data);
}

export const TELEMETRY = {
  ROUTE_RESOLVED: 'route.resolved',
  ROUTE_ATTEMPT: 'route.attempt',
  ROUTE_FALLBACK: 'route.fallback',
  ROUTES_EXHAUSTED: 'route.exhausted',
  PROMPT_ASSEMBLED: 'prompt.assembled',
  ADAPTER_REQUEST: 'adapter.request',
  ADAPTER_RESPONSE: 'adapter.response',
  RETRY_SCHEDULED: 'retry.scheduled',
  USAGE_RECORDED: 'usage.recorded',
  BUDGET_BLOCKED: 'budget.blocked',
  COMPLETE: 'complete',
  ERROR: 'error',
};

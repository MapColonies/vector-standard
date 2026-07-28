import type { Attributes, Context, Span } from '@opentelemetry/api';
import { trace as traceAPI, SpanStatusCode } from '@opentelemetry/api';

export const TRACER_NAME = 'standard-synchronizer';

export const handleSpanOnSuccess = (span?: Span): void => {
  if (span === undefined) {
    return;
  }

  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
};

export const handleSpanOnError = (span?: Span, error?: unknown): void => {
  if (span === undefined) {
    return;
  }

  span.setStatus({ code: SpanStatusCode.ERROR });

  if (error instanceof Error) {
    const { message, name, stack } = error;
    span.recordException({ message, name, stack });
  }

  span.end();
};

export const startActivePromisifiedSpan = async <T>(
  spanName: string,
  spanAttributes: Attributes,
  context: Context,
  fn: (span: Span) => Promise<T>
): Promise<T> => {
  const tracer = traceAPI.getTracer(TRACER_NAME);
  return tracer.startActiveSpan(spanName, { attributes: spanAttributes }, context, async (span) => {
    try {
      const result = await fn(span);
      handleSpanOnSuccess(span);
      return result;
    } catch (error) {
      handleSpanOnError(span, error);
      throw error;
    }
  });
};

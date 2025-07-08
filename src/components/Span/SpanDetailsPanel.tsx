import React from 'react';
import { IconButton } from '@grafana/ui';

import type { SpanInfo } from '../../pages/TraceDetail';

export const SpanDetailPanel = ({ span, onClose }: { span: SpanInfo; onClose: () => void }) => {
  return (
    <div className="p-4 z-10 bg-black">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Span Details</h3>
        <IconButton name="times" onClick={onClose} variant="secondary" aria-label="Close" />
      </div>
      <div className="flex flex-col gap-2">
        <div>
          <strong>Name:</strong> <pre>{span.name}</pre>
        </div>
        <div>
          <strong>ID:</strong> <pre>{span.spanId}</pre>
        </div>
        <div>
          <strong>Trace ID:</strong>
          <pre>{span.traceId}</pre>
        </div>
        <div>
          <strong>Start Time:</strong> <pre>{span.startTimeUnixNano}</pre>
        </div>
        <div>
          <strong>End Time:</strong> <pre>{span.endTimeUnixNano}</pre>
        </div>
        <div>
          <strong>Duration:</strong> <pre>{span.endTimeUnixNano - span.startTimeUnixNano}ms</pre>
        </div>
      </div>
    </div>
  );
};

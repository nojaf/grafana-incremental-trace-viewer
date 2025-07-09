import React from 'react';
import { IconButton } from '@grafana/ui';

import type { SpanInfo } from '../TraceDetail';
import { mkUnixEpochFromNanoSeconds } from 'utils/utils.timeline';
import { useQuery } from '@tanstack/react-query';
import { searchTags, search } from 'utils/utils.api';

export const SpanDetailPanel = ({
  span,
  onClose,
  datasourceUid,
}: {
  span: SpanInfo;
  onClose: () => void;
  datasourceUid: string;
}) => {
  const result = useQuery<Record<string, any>>({
    queryKey: ['trace', span.traceId, 'span', span.spanId, 'details'],
    queryFn: async () => {
      const qTags = `{ trace:id = "${span.traceId}" && span:id = "${span.spanId}" }`;
      const start = mkUnixEpochFromNanoSeconds(span.startTimeUnixNano);
      const end = mkUnixEpochFromNanoSeconds(span.endTimeUnixNano);
      const tags = await searchTags(datasourceUid, qTags, start, end);
      console.log('TAGS', tags);
      const q = `{ trace:id = "${span.traceId}" && span:id = "${span.spanId}" } | select (${tags
        .map((t) => `span.${t}`)
        .join(', ')})`;
      const data = await search(datasourceUid, q, start, end, 1);
      if (data.traces?.[0]?.spanSets?.[0]?.spans?.[0]) {
        return data.traces[0].spanSets[0].spans[0].attributes;
      }

      return {};
    },
  });

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
        {JSON.stringify(result.data)}
      </div>
    </div>
  );
};

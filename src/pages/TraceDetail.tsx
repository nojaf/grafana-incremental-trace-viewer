import React from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@grafana/ui';
import { testIds } from '../components/testIds';
import { getBackendSrv, PluginPage } from '@grafana/runtime';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lastValueFrom } from 'rxjs';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type components } from '../schema.gen';
import type { datasource } from './TraceOverview';
import { BASE_URL } from '../constants';

type ISODateString = string;

type SpanNode = components['schemas']['SpanNode'];
type GetInitialTraceDetailRequest = components['schemas']['GetInitialTraceDetailRequest'];
type GetAdditionalSpansRequest = components['schemas']['GetAdditionalSpansRequest'];

type SpanNodeProps = SpanNode & {
  index: number;
  loadMore: (index: number, spanId: string, currentLevel: number, skip: number) => void;
};

function getMillisecondsDifferenceNative(startTime: ISODateString, endTime: ISODateString) {
  const s = new Date(startTime);
  const e = new Date(endTime);

  // Validate if the Date objects are valid (e.g., if parsing failed)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) {
    throw new Error('Invalid ISO 8601 date string provided.');
  }

  return e.getTime() - s.getTime();
}

const Span = (props: SpanNodeProps) => {
  return (
    <div
      className="border-l-2 border-gray-200 pl-4 transition-colors duration-200 hover:bg-gray-700 h-full"
      style={{ marginLeft: `calc(1rem * var(--indent-level, ${props.level}))` } as React.CSSProperties}
    >
      <div className="flex items-center gap-4 px-4 py-2 border border-gray-200 h-full">
        <div className="text-sm">
          <strong className="mr-2">Name:</strong> {props.name}
        </div>
        <div className="text-sm">
          <strong className="mr-2">ID:</strong> {props.spanId}
        </div>
        <div className="text-sm">
          <strong className="mr-2">Duration:</strong> {getMillisecondsDifferenceNative(props.startTime, props.endTime)}
          ms
        </div>
        <div className="text-sm">
          <span>
            current children:
            {props.currentChildrenCount}
          </span>
        </div>
        <div className="text-sm">
          <span>total children: {props.totalChildrenCount}</span>
        </div>
        {props.currentChildrenCount < props.totalChildrenCount && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => props.loadMore(props.index, props.spanId, props.level, props.currentChildrenCount)}
          >
            Load more
          </Button>
        )}
      </div>
    </div>
  );
};

function TraceDetail() {
  const {
    traceId,
    spanId: rootSpanId,
    datasourceId,
  } = useParams<{ traceId: string; spanId: string; datasourceId: string }>();
  const queryClient = useQueryClient();
  const parentRef = React.useRef(null);
  const queryKey = ['datasource', datasourceId, 'trace', traceId, 'spans', rootSpanId];

  const result = useQuery<SpanNode[]>(
    {
      queryKey,
      staleTime: 5000,
      queryFn: async () => {
        const backendSrv = getBackendSrv();

        // If the user came from the overview page, the datasource is already in the query client.
        let datasource = queryClient.getQueryData<datasource>(['datasource', datasourceId]);
        // If not, gets it from the API.
        if (datasource === undefined) {
          datasource = await lastValueFrom(
            backendSrv.fetch<datasource>({ url: `/api/datasources/${datasourceId}` })
          ).then((res) => res.data);
          queryClient.setQueryData<datasource>(['datasource', datasourceId], datasource);
        }
        // If the datasource is still undefined, throw an error.
        if (datasource === undefined) {
          throw new Error(`Datasource not found for ${datasourceId}`);
        }

        const responses = getBackendSrv().fetch<SpanNode[]>({
          url: `${BASE_URL}/trace/${traceId}/span/${rootSpanId}`,
          method: 'POST',
          data: {
            url: datasource.url,
            database: datasource.jsonData.database,
            timeField: datasource.jsonData.timeField,
            depth: 3,
            childrenLimit: 5,
          } satisfies GetInitialTraceDetailRequest,
        });
        const response = await lastValueFrom(responses);
        console.log(response.data);
        return response.data;
      },
    },
    queryClient
  );

  const rowVirtualizer = useVirtualizer({
    count: result.isSuccess ? result.data.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    // Potential solution to add sticky headers
    // rangeExtractor: (range) => {}
  });

  const loadMore = (index: number, spanId: string, currentLevel: number, skip: number) => {
    if (!result.isSuccess) {
      return;
    }
    new Promise(async () => {
      const datasource = queryClient.getQueryData<datasource>(['datasource', datasourceId]);
      if (!datasource) {
        throw new Error(`Datasource not found for ${datasourceId}`);
      }

      const responses = getBackendSrv().fetch<SpanNode[]>({
        url: `${BASE_URL}/trace/${traceId}/span/${spanId}/children`,
        method: 'POST',
        data: {
          url: datasource.url,
          database: datasource.jsonData.database,
          timeField: datasource.jsonData.timeField,
          childrenLimit: 3,
          depth: 3,
          level: currentLevel,
          skip: skip,
          take: 10,
        } satisfies GetAdditionalSpansRequest,
      });
      const response = await lastValueFrom(responses);

      const currentSpan = result.data[index];
      // Find the next span with the same level, if our level is 2, we want to find the next span with level 2
      // We insert all new data right before this index.
      let nextSpanWithSameLevel = undefined;
      for (let i = index + 1; i < result.data.length; i++) {
        if (result.data[i].level === currentSpan.level) {
          nextSpanWithSameLevel = i;
          break;
        }
      }
      if (nextSpanWithSameLevel === undefined) {
        nextSpanWithSameLevel = index + currentSpan.currentChildrenCount + 1;
      }

      const newlyAddedChildren = response.data.filter(({ level }: SpanNode) => currentLevel + 1 === level).length;

      queryClient.setQueryData<SpanNode[]>(queryKey, (oldData) => {
        if (!oldData) {
          console.log('oldData is undefined, returning response.data.spans');
          return response.data;
        }
        return currentLevel === 1
          ? // We requested more children for the root span, so we need to insert the new spans after the existing spans.
            [
              // root span
              {
                ...currentSpan,
                currentChildrenCount: currentSpan.currentChildrenCount + newlyAddedChildren,
              },
              // existing children
              ...oldData.slice(index + 1),
              // new children
              ...response.data,
            ]
          : // We need to carefully insert the new spans, we need to insert them before the next span with the same level.
            [
              // Copy everything before the current span
              ...oldData.slice(0, index),
              // Insert the current span with the new children count
              {
                ...currentSpan,
                currentChildrenCount: currentSpan.currentChildrenCount + newlyAddedChildren,
              },
              // existing children (could be nested)
              ...oldData.slice(index + 1, nextSpanWithSameLevel),
              // new children (could be nested)
              ...response.data,
              // Everything after the current span
              ...oldData.slice(index + currentSpan.currentChildrenCount + 1),
            ];
      });
    });
  };

  return (
    <PluginPage>
      <div data-testid={testIds.pageThree.container}>
        This is detail page for span {rootSpanId}
        <br />
        <br />
        {/* The ID parameter is set */}
        {rootSpanId && <strong>ID: {rootSpanId} </strong>}
      </div>
      {result.isLoading && <div>Loading...</div>}
      {result.isError && <div>Error: {result.error.message}</div>}
      {result.isSuccess && (
        /* The scrollable element for your list */
        <div
          ref={parentRef}
          style={{
            height: `60vh`,
            overflow: 'auto',
          }}
        >
          {/* The large inner element to hold all of the items */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
            className="w-full relative"
          >
            {/* Only the visible items in the virtualizer, manually positioned to be in view */}
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const span = result.data[virtualItem.index];
              return (
                <div
                  key={virtualItem.key}
                  className="absolute top-0 left-0 bottom-0 right-0 w-full my-0"
                  style={{
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <Span key={span.spanId} {...span} index={virtualItem.index} loadMore={loadMore} />
                </div>
              );
            })}
          </div>
        </div>
      )}
      <pre>{JSON.stringify(result.data && result.data.length, null, 2)}</pre>
    </PluginPage>
  );
}

export default TraceDetail;

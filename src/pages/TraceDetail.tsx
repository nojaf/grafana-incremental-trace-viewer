import React from 'react';
import { useParams } from 'react-router-dom';
import { testIds } from '../components/testIds';
import { getBackendSrv, PluginPage } from '@grafana/runtime';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lastValueFrom } from 'rxjs';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type components } from '../schema.gen';
import type { datasource } from './TraceOverview';
import { BASE_URL } from '../constants';
import { Span, SpanDetailPanel } from '../components/Span';
import { getMillisecondsDifferenceNative } from '../utils/utils.timeline';

type SpanNode = components['schemas']['SpanNode'];
type GetInitialTraceDetailRequest = components['schemas']['GetInitialTraceDetailRequest'];
type GetAdditionalSpansRequest = components['schemas']['GetAdditionalSpansRequest'];

function TraceDetail() {
  const {
    traceId,
    spanId: rootSpanId,
    datasourceId,
  } = useParams<{ traceId: string; spanId: string; datasourceId: string }>();
  const queryClient = useQueryClient();
  const parentRef = React.useRef(null);
  const queryKey = ['datasource', datasourceId, 'trace', traceId, 'spans', rootSpanId];
  const [selectedSpan, setSelectedSpan] = React.useState<SpanNode | null>(null);

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

  const traceDuration = React.useMemo(() => {
    if (!result.isSuccess || result.data.length === 0) {
      return 0;
    }
    const rootSpan = result.data[0];
    return getMillisecondsDifferenceNative(rootSpan.startTime, rootSpan.endTime);
  }, [result.isSuccess, result.data]);

  const traceStartTime = React.useMemo(() => {
    if (!result.isSuccess || result.data.length === 0) {
      return 0;
    }
    const rootSpan = result.data[0];
    return new Date(rootSpan.startTime).getTime();
  }, [result.isSuccess, result.data]);

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
      <div className="flex h-[calc(100vh-120px)]">
        <div className="flex-grow flex flex-col">
          <div className="flex bg-gray-800 p-2 border-b border-gray-700">
            <div className="w-1/3 font-bold">Span</div>
            <div className="w-2/3 font-bold px-4">
              <div className="w-full relative">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute border-l border-gray-500 h-2 pl-1 text-xs"
                    style={{
                      left: `${(i / 4) * 100}%`,
                    }} // Limitation in tailwind dynamic class construction: Check README.md for more details
                  >
                    {((traceDuration / 1000 / 4) * i).toFixed(2)}s
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-grow" data-testid={testIds.pageThree.container}>
            {result.isLoading && <div>Loading...</div>}
            {result.isError && <div>Error: {result.error.message}</div>}
            {result.isSuccess && (
              <div ref={parentRef} className="h-full overflow-auto">
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                  }} // Limitation in tailwind dynamic class construction: Check README.md for more details
                  className="w-full relative"
                >
                  {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const span = result.data[virtualItem.index];
                    return (
                      <div
                        key={virtualItem.key}
                        className="absolute top-0 left-0 w-full border-b border-[#2d2d2d]"
                        style={{
                          height: `${virtualItem.size}px`,
                          transform: `translateY(${virtualItem.start}px)`,
                        }} // Limitation in tailwind dynamic class construction: Check README.md for more details
                      >
                        <Span
                          key={span.spanId}
                          {...span}
                          index={virtualItem.index}
                          loadMore={loadMore}
                          traceStartTime={traceStartTime}
                          traceDuration={traceDuration}
                          onSelect={setSelectedSpan}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        {selectedSpan && (
          <div className="w-1/3 border-l border-gray-700 min-w-[300px]">
            <SpanDetailPanel span={selectedSpan} onClose={() => setSelectedSpan(null)} />
          </div>
        )}
      </div>
    </PluginPage>
  );
}

export default TraceDetail;

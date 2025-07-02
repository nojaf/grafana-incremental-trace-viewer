import React from 'react';
import { useParams } from 'react-router-dom';
import { testIds } from '../components/testIds';
import { getBackendSrv, PluginPage } from '@grafana/runtime';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lastValueFrom } from 'rxjs';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ApiPaths, type components } from '../schema.gen';
import type { datasource } from './TraceOverview';
import { BASE_URL } from '../constants';
import { Span as SpanComponent, SpanDetailPanel } from '../components/Span';
import { mkMilisecondsFromNanoSeconds } from 'utils/utils.timeline';

type TraceResponse = components['schemas']['TraceDetailResponse'];
type DataSourceInfo = components['schemas']['DataSourceInfo'];

export type Span = {
  spanId: string;
  parentSpanId: string | null;
  traceId: string;
  level: number;
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  name: string;
  hasMore: boolean;
};

/**
 * Maps the span nodes to a list of spans.
 * It also assigns the level to the span.
 * It also sets the hasMore flag to true for the parent span if it has more children.
 * Skips the take + 1 elements.
 * @param spanNodes
 * @param idToLevelMap
 * @returns Span[]
 */
function extractSpans(idToLevelMap: Map<string, number>, responseData: TraceResponse): Span[] {
  const spanNodes =
    responseData.trace?.resourceSpans?.flatMap((r) => r.scopeSpans?.flatMap((s) => s.spans || []) || []) || [];
  spanNodes.sort((a, b) => {
    const start = (a.startTimeUnixNano || 0) - (b.startTimeUnixNano || 0);
    const end = (b.endTimeUnixNano || 0) - (a.endTimeUnixNano || 0);
    return start || end;
  });

  const spans: Span[] = [];
  for (let i = 0; i < spanNodes.length; i++) {
    const span = spanNodes[i];
    if (!span.spanId) {
      continue;
    }

    // Assign the level to the span.
    if (!span.parentSpanId || span.parentSpanId.length === 0) {
      idToLevelMap.set(span.spanId, 0);
    } else {
      let parentLevel = idToLevelMap.get(span.parentSpanId);
      if (parentLevel === undefined) {
        throw new Error(`Parent level not found for ${span.spanId}`);
      }
      idToLevelMap.set(span.spanId, parentLevel + 1);
    }

    const childrenCount = span.attributes?.find((a) => a.key === 'childrenCount')?.value?.intValue || 0;
    const isNotRoot = span.parentSpanId != null && span.parentSpanId.length > 0;

    spans.push({
      spanId: span.spanId,
      parentSpanId: span.parentSpanId ? span.parentSpanId : null,
      traceId: span.traceId || '',
      level: idToLevelMap.get(span.spanId) || 0,
      startTimeUnixNano: span.startTimeUnixNano || 0,
      endTimeUnixNano: span.endTimeUnixNano || 0,
      name: span.name || '',
      // We determine this above.
      hasMore: isNotRoot && childrenCount > 0,
    });
  }
  return spans;
}

function TraceDetail() {
  const { traceId, datasourceId } = useParams<{ traceId: string; datasourceId: string }>();
  // Should we assert for traceId and datasourceId?
  if (!traceId || !datasourceId) {
    throw new Error('traceId and datasourceId are required');
  }

  const queryClient = useQueryClient();
  const parentRef = React.useRef(null);
  const queryKey = ['datasource', datasourceId, 'trace', traceId];
  const [selectedSpan, setSelectedSpan] = React.useState<Span | null>(null);

  const idToLevelMap = React.useRef(new Map<string, number>());

  const result = useQuery<Span[]>(
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

        const responses = getBackendSrv().fetch<TraceResponse>({
          url: `${BASE_URL}${ApiPaths.queryTrace.replace('{traceId}', traceId)}`,
          method: 'POST',
          data: {
            type: datasource.type,
            url: datasource.url,
            database: datasource.jsonData.database,
            timeField: datasource.jsonData.timeField,
          } satisfies DataSourceInfo,
        });
        const response = await lastValueFrom(responses);
        console.log(response.data);
        const spans: Span[] = extractSpans(idToLevelMap.current, response.data);
        return spans;
      },
    },
    queryClient
  );

  const traceDurationInMiliseconds = React.useMemo(() => {
    if (!result.isSuccess || result.data.length === 0) {
      return 0;
    }
    const rootSpan = result.data[0];
    return (
      mkMilisecondsFromNanoSeconds(rootSpan.endTimeUnixNano) - mkMilisecondsFromNanoSeconds(rootSpan.startTimeUnixNano)
    );
  }, [result.isSuccess, result.data]);

  const traceStartTimeInMiliseconds = React.useMemo(() => {
    if (!result.isSuccess || result.data.length === 0) {
      return 0;
    }
    const rootSpan = result.data[0];
    // TODO: not sure if this will work as is in nano seconds.
    return new Date(mkMilisecondsFromNanoSeconds(rootSpan.startTimeUnixNano)).getTime();
  }, [result.isSuccess, result.data]);

  const rowVirtualizer = useVirtualizer({
    count: result.isSuccess ? result.data.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    // Potential solution to add sticky headers
    // rangeExtractor: (range) => {}
  });

  const loadMore = (index: number, spanId: string) => {
    if (!result.isSuccess) {
      return;
    }

    let skip = 0;
    for (let i = index + 1; i < result.data.length; i++) {
      if (result.data[i].parentSpanId !== spanId) {
        break;
      }
      skip++;
    }

    new Promise(async () => {
      const datasource = queryClient.getQueryData<datasource>(['datasource', datasourceId]);
      if (!datasource) {
        throw new Error(`Datasource not found for ${datasourceId}`);
      }

      const responses = getBackendSrv().fetch<TraceResponse>({
        url: `${BASE_URL}${ApiPaths.queryTrace.replace('{traceId}', traceId)}?spanId=${spanId}`,
        method: 'POST',
        data: {
          type: datasource.type,
          url: datasource.url,
          database: datasource.jsonData.database,
          timeField: datasource.jsonData.timeField,
        } satisfies DataSourceInfo,
      });
      const response = await lastValueFrom(responses);
      const spans = extractSpans(idToLevelMap.current, response.data);

      queryClient.setQueryData<Span[]>(queryKey, (oldData) => {
        if (!oldData) {
          return spans;
        }

        let nextSpans: Span[] = [];
        let didAddNewSpans = false;

        for (let i = 0; i < oldData.length; i++) {
          // Add all spans before the current span.
          if (i <= index) {
            nextSpans.push(oldData[i]);
            continue;
          }

          if (i === index + 1) {
            // Add the new spans after their parent span.
            for (let c = 0; c < spans.length; c++) {
              nextSpans.push(spans[c]);
            }
            didAddNewSpans = true;
          }

          nextSpans.push(oldData[i]);
        }

        if (!didAddNewSpans) {
          nextSpans.push(...spans);
        }

        nextSpans[index].hasMore = false;

        return nextSpans;
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
                    {((traceDurationInMiliseconds / 1000 / 4) * i).toFixed(2)}s
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
                    const hasChildren =
                      virtualItem.index !== result.data.length - 1 &&
                      result.data[virtualItem.index + 1].parentSpanId === span.spanId;
                    return (
                      <div
                        key={virtualItem.key}
                        className="absolute top-0 left-0 w-full border-b border-[#2d2d2d]"
                        style={{
                          height: `${virtualItem.size}px`,
                          transform: `translateY(${virtualItem.start}px)`,
                        }} // Limitation in tailwind dynamic class construction: Check README.md for more details
                      >
                        <SpanComponent
                          key={span.spanId}
                          {...span}
                          index={virtualItem.index}
                          loadMore={loadMore}
                          traceStartTimeInMiliseconds={traceStartTimeInMiliseconds}
                          traceDurationInMiliseconds={traceDurationInMiliseconds}
                          onSelect={setSelectedSpan}
                          hasChildren={hasChildren}
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

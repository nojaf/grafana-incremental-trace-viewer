import React from 'react';
import { css } from '@emotion/css';
import { useParams } from 'react-router-dom';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Button } from '@grafana/ui';
import { testIds } from '../components/testIds';
import { getBackendSrv, PluginPage } from '@grafana/runtime';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lastValueFrom } from 'rxjs';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ApiPaths, type components } from '../schema.gen';
import type { datasource } from './TraceOverview';
import { BASE_URL } from '../constants';

type TraceResponse = components['schemas']['TracesData'];
type DataSourceInfo = components['schemas']['DataSourceInfo'];

type Span = {
  spanId: string;
  parentSpanId: string | null;
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
  const spanNodes = responseData.resourceSpans?.flatMap((r) => r.scopeSpans?.flatMap((s) => s.spans || []) || []) || [];

  const spans: Span[] = [];
  for (let i = 0; i < spanNodes.length; i++) {
    const span = spanNodes[i];
    if (!span.spanId) {
      continue;
    }

    // Assign the level to the span.
    if (!span.parentSpanId || span.parentSpanId.length === 0) {
      idToLevelMap.set(spanIdAsString(span.spanId), 0);
    } else {
      let parentLevel = idToLevelMap.get(spanIdAsString(span.parentSpanId));
      if (parentLevel === undefined) {
        throw new Error(`Parent level not found for ${spanIdAsString(span.spanId)}`);
      }
      idToLevelMap.set(spanIdAsString(span.spanId), parentLevel + 1);
    }

    // Skip the take + 1 elements.
    if (i > take) {
      let parentNode = spanNodes[i - take - 1];
      // If this element is <take> removed from the array, we can skip it.
      // It does indicate that the parent has more children.
      if (parentNode.spanId && span.parentSpanId && isIdEqual(parentNode.spanId, span.parentSpanId)) {
        const parent = spans[spans.length - take - 1];
        if (parent.spanId === spanIdAsString(parentNode.spanId)) {
          parent.hasMore = true;
        } else {
          console.warn(`Parent span ${spanIdAsString(parentNode.spanId)} is not ${take} removed from take + 1 child`);
        }
        console.info(`Skipping ${span.name} because`);
        continue;
      }
    }

    spans.push({
      spanId: spanIdAsString(span.spanId),
      parentSpanId: span.parentSpanId ? spanIdAsString(span.parentSpanId) : null,
      level: idToLevelMap.get(spanIdAsString(span.spanId)) || 0,
      startTimeUnixNano: span.startTimeUnixNano || 0,
      endTimeUnixNano: span.endTimeUnixNano || 0,
      name: span.name || '',
      // We determine this above.
      hasMore: false,
    });
  }
  return spans;
}

type SpanNodeProps = Span & {
  index: number;
  loadMore: (index: number, spanId: string, currentLevel: number) => void;
};

// TODO: consider making this configurable by the user.
const take = 10;

function spanIdAsString(spanId: number[]): string {
  return String.fromCodePoint(...spanId);
}

function isIdEqual(id1: number[], id2: number[]): boolean {
  if (id1.length !== id2.length) {
    return false;
  }
  for (let i = 0; i < id1.length; i++) {
    if (id1[i] !== id2[i]) {
      return false;
    }
  }
  return true;
}

const SpanComponent = (props: SpanNodeProps) => {
  const s = useStyles2(getStyles);

  return (
    <div className={s.spanContainer} style={{ '--indent-level': props.level } as React.CSSProperties}>
      <div className={s.spanInfo}>
        <div className={s.spanField}>
          <strong>Name:</strong> {props.name}
        </div>
        <div className={s.spanField}>
          <strong>ID:</strong> {props.spanId}
        </div>
        <div className={s.spanField}>
          <strong>Duration:</strong> {(props.endTimeUnixNano || 0) - (props.startTimeUnixNano || 0)}ms
        </div>
        {props.hasMore && (
          <Button size="sm" variant="secondary" onClick={() => props.loadMore(props.index, props.spanId, props.level)}>
            Load more
          </Button>
        )}
      </div>
    </div>
  );
};

function TraceDetail() {
  const { traceId, datasourceId } = useParams<{ traceId: string; datasourceId: string }>();
  // Should we assert for traceId and datasourceId?
  if (!traceId || !datasourceId) {
    throw new Error('traceId and datasourceId are required');
  }

  const queryClient = useQueryClient();
  const parentRef = React.useRef(null);
  const queryKey = ['datasource', datasourceId, 'trace', traceId];

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
          url: `${BASE_URL}${ApiPaths.queryTrace.replace('{traceId}', traceId)}?depth=3&take=${take + 1}`,
          method: 'POST',
          data: {
            url: datasource.url,
            database: datasource.jsonData.database,
            timeField: datasource.jsonData.timeField,
          } satisfies DataSourceInfo,
        });
        const response = await lastValueFrom(responses);
        const spans: Span[] = extractSpans(idToLevelMap.current, response.data);
        return spans;
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

  const loadMore = (index: number, spanId: string, currentLevel: number) => {
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
        url: `${BASE_URL}${ApiPaths.queryTrace.replace('{traceId}', traceId)}?spanId=${spanId}&depth=3&take=${
          take + 1
        }&skip=${skip}`,
        method: 'POST',
        data: {
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

          // Find the next span with the same level, effectively being a sibling of the current span.
          if (i > index && oldData[i].level === currentLevel) {
            // Add the new spans before the next span with the same level.
            let directChildrenCount = 0; // increment each span that has the same parentSpanId
            for (let c = 0; c < spans.length; c++) {
              if (spans[c].parentSpanId === spanId) {
                directChildrenCount++;
              }
              nextSpans.push(spans[c]);
            }

            nextSpans[index].hasMore = directChildrenCount > take;
            didAddNewSpans = true;
          }

          nextSpans.push(oldData[i]);
        }

        if (!didAddNewSpans) {
          nextSpans.push(...spans);
        }

        return nextSpans;
      });
    });
  };

  return (
    <PluginPage>
      <div data-testid={testIds.pageThree.container}>
        This is detail page for trace {traceId}
        <br />
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
              width: '100%',
              position: 'relative',
            }}
          >
            {/* Only the visible items in the virtualizer, manually positioned to be in view */}
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const span = result.data[virtualItem.index];
              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <SpanComponent key={span.spanId} {...span} index={virtualItem.index} loadMore={loadMore} />
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

const getStyles = (theme: GrafanaTheme2) => ({
  spanContainer: css`
    border-left: 2px solid ${theme.colors.border.weak};
    padding-left: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(1)};
    margin-left: calc(${theme.spacing(2)} * var(--indent-level, 0));
    transition: background-color 0.2s ease;

    &:hover {
      background-color: ${theme.colors.background.secondary};
    }
  `,
  spanInfo: css`
    display: flex;
    align-content: center;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(1)};
    background-color: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.borderRadius()};
  `,
  spanField: css`
    font-size: ${theme.typography.size.sm};

    &:last-child {
      margin-bottom: 0;
    }

    strong {
      color: ${theme.colors.text.primary};
      margin-right: ${theme.spacing(1)};
    }
  `,
});

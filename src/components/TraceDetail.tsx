import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Icon } from '@grafana/ui';

import { testIds } from './testIds';
import { Span as SpanComponent, SpanDetailPanel } from './Span';
import {
  mkMilisecondsFromNanoSeconds,
  mkUnixEpochFromNanoSeconds,
  mkUnixEpochFromMiliseconds,
} from '../utils/utils.timeline';
import { search, SearchResponse, Span } from '../utils/utils.api';
import type { QueryInfo as TraceDetailProps } from './TraceViewerPanel';
import { SpanOverlayDrawer } from './Span/SpanOverlayDrawer';
import { HelpModal } from './HelpModal';
import { ChildStatus, SpanInfo } from 'types';

// default Grafana does not support child count.
// In production, we use a custom build of Grafana that supports child count.
// This value is set at build time via environment variable SUPPORTS_CHILD_COUNT
const supportsChildCount = process.env.SUPPORTS_CHILD_COUNT || false;

function getParentSpanId(span: Span): string | null {
  const attributes = span.attributes;
  if (!attributes) {
    return null;
  }
  const parentSpanId = attributes.find((a) => a.key === 'span:parentID')?.value?.stringValue;
  return parentSpanId || null;
}

async function hasChildren(
  datasourceUid: string,
  traceId: string,
  spanId: string,
  startTimeUnixNano: number,
  endTimeUnixNano: number
): Promise<boolean> {
  const q = `{ trace:id = "${traceId}" && span:parentID = "${spanId}" } | count() > 0`;
  const start = mkUnixEpochFromNanoSeconds(startTimeUnixNano);
  // As a precaution, we add 1 second to the end time.
  // This is to avoid any rounding errors where the microseconds or nanoseconds are not included in the end time.
  const end = mkUnixEpochFromNanoSeconds(endTimeUnixNano) + 1;
  const data = await search(datasourceUid, q, start, end, 1);
  return (data.traces && data.traces.length > 0) || false;
}

/**
 * Extracts and maps span nodes from the search response to a list of SpanInfo objects.
 * Assigns a hierarchical level to each span based on its parent-child relationship.
 * Optionally determines if a span has more children, setting the hasMore flag accordingly.
 *
 * @param idToLevelMap - A map tracking the hierarchical level of each span by span ID.
 * @param traceId - The ID of the trace to extract spans from.
 * @param datasourceUid - The UID of the datasource to use for fetching additional span information.
 * @param responseData - The search response containing trace and span data.
 * @param fixedHasMore - If provided, sets the hasMore flag for all spans to this value instead of checking for children.
 * @returns Promise<SpanInfo[]>
 */
async function extractSpans(
  idToLevelMap: Map<string, number>,
  traceId: string,
  datasourceUid: string,
  responseData: SearchResponse
): Promise<SpanInfo[]> {
  const trace = responseData.traces?.find((t) => t.traceID === traceId);
  if (!trace) {
    throw new Error(`Trace not found for ${traceId}`);
  }

  let spanNodes = trace.spanSets?.flatMap((r) => r.spans || []) || [];

  spanNodes.sort((a, b) => {
    const start = parseInt(a.startTimeUnixNano || '0', 10) - parseInt(b.startTimeUnixNano || '0', 10);
    const end = parseInt(b.durationNanos || '0', 10) - parseInt(a.durationNanos || '0', 10);
    return start || end;
  });

  const spans: SpanInfo[] = [];
  for (let i = 0; i < spanNodes.length; i++) {
    const span = spanNodes[i];
    if (!span.spanID) {
      continue;
    }

    const parentSpanId = getParentSpanId(span);

    // Assign the level to the span.
    if (parentSpanId === null) {
      idToLevelMap.set(span.spanID, 0);
    } else {
      let parentLevel = idToLevelMap.get(parentSpanId);
      if (parentLevel === undefined) {
        throw new Error(`Parent level not found for ${span.spanID}`);
      }
      idToLevelMap.set(span.spanID, parentLevel + 1);
    }

    const startTimeUnixNano = parseInt(span.startTimeUnixNano || '0', 10);
    const durationNanos = parseInt(span.durationNanos || '0', 10);
    const endTimeUnixNano = startTimeUnixNano + durationNanos;
    // This is a rather expensive call.
    // We need to call this for every span.
    let hasRemoteChildren = false;
    // Assuming that the childCount is set by the backend.
    // We can just use that value to determine if the span has more children.
    const childCount = span.attributes?.find((a) => a.key === 'childCount')?.value?.intValue;
    if (childCount !== undefined) {
      hasRemoteChildren = childCount > 0;
    } else {
      // If not, we need to fetch the children count via additional query.
      hasRemoteChildren = await hasChildren(datasourceUid, traceId, span.spanID, startTimeUnixNano, endTimeUnixNano);
    }

    const serviceNamespace =
      span.attributes?.find((a) => a.key === 'service.namespace')?.value?.stringValue || undefined;

    // Using k8s.container.name as the service name since this is specific to our Kubernetes environment.
    // Jaeger UI is pulling this info from the process object which is in our case translated to this attribute.
    const serviceName = span.attributes?.find((a) => a.key === 'k8s.container.name')?.value?.stringValue || undefined;

    spans.push({
      spanId: span.spanID,
      parentSpanId: parentSpanId,
      traceId: traceId,
      level: idToLevelMap.get(span.spanID) || 0,
      startTimeUnixNano: startTimeUnixNano,
      endTimeUnixNano: endTimeUnixNano,
      childStatus: hasRemoteChildren ? ChildStatus.RemoteChildren : ChildStatus.NoChildren,
      name: serviceName || span.name || '',
      serviceNamespace,
    });
  }
  return spans;
}

async function loadMoreSpans(
  traceId: string,
  datasourceUid: string,
  idToLevelMap: Map<string, number>,
  span: SpanInfo
): Promise<SpanInfo[]> {
  const q = `{ trace:id = "${traceId}" && span:parentID = "${
    span.spanId
  }" } | select (span:parentID, span:name, span.k8s.container.name, resource.service.namespace${
    supportsChildCount ? ', childCount' : ''
  })`;
  const start = mkUnixEpochFromNanoSeconds(span.startTimeUnixNano);
  // As a precaution, we add 1 second to the end time.
  // This is to avoid any rounding errors where the microseconds or nanoseconds are not included in the end time.
  const end = mkUnixEpochFromNanoSeconds(span.endTimeUnixNano) + 1;
  // See https://github.com/grafana/tempo/issues/5435
  const data = await search(datasourceUid, q, start, end, 4294967295);
  return await extractSpans(idToLevelMap, traceId, datasourceUid, data);
}

function TraceDetail({
  traceId,
  datasourceUid,
  startTimeInMs,
  panelWidth,
  panelHeight,
}: TraceDetailProps): React.JSX.Element {
  // Should we assert for traceId and datasourceId?
  if (!traceId || !datasourceUid) {
    throw new Error('traceId and datasourceId are required');
  }

  const queryClient = useQueryClient();
  const parentRef = React.useRef(null);
  const queryKey = ['datasource', datasourceUid, 'trace', traceId];
  const [selectedSpan, setSelectedSpan] = React.useState<SpanInfo | null>(null);
  const [showHelpModal, setShowHelpModal] = React.useState(false);

  const idToLevelMap = React.useRef(new Map<string, number>());
  // Keep track of the open/collapsed items in a map
  // filter accordingly in the virtualizer

  const result = useQuery<SpanInfo[]>(
    {
      queryKey,
      staleTime: 5000,
      queryFn: async () => {
        const start = mkUnixEpochFromMiliseconds(startTimeInMs);
        const end = start + 1;
        const q = `{ trace:id = "${traceId}" && nestedSetParent = -1 } | select (span:name, span.k8s.container.name, resource.service.namespace${
          supportsChildCount ? ', childCount' : ''
        })`;
        const data = await search(datasourceUid, q, start, end);
        // We pass in hasMore: false because we are fetching the first round of children later.
        const spans: SpanInfo[] = await extractSpans(idToLevelMap.current, traceId, datasourceUid, data);
        const allSpans = [];
        // We fetch the first round of children for each span.
        for (const span of spans) {
          span.childStatus = ChildStatus.ShowChildren;
          allSpans.push(span);
          const moreSpans = await loadMoreSpans(traceId, datasourceUid, idToLevelMap.current, span);
          allSpans.push(...moreSpans);
        }
        return allSpans;
      },
    },
    queryClient
  );

  const visibleIndexes = React.useMemo(() => {
    if (!result.isSuccess) {
      return [];
    }

    const indexes: number[] = [];
    const collapsedParents = new Set<string>();

    for (let i = 0; i < result.data.length; i++) {
      const span = result.data[i];

      // Mark this span as collapsed if it should hide children
      if (span.childStatus === ChildStatus.HideChildren) {
        collapsedParents.add(span.spanId);
      }

      // Skip if parent is collapsed
      if (span.parentSpanId && collapsedParents.has(span.parentSpanId)) {
        continue;
      }

      indexes.push(i);
    }

    return indexes;
  }, [result.isSuccess, result.data]);

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
    count: visibleIndexes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
  });

  const loadRemoteChildren = async (span: SpanInfo) => {
    if (!result.isSuccess) {
      return;
    }

    // Mark the parent span as loading
    queryClient.setQueryData<SpanInfo[]>(queryKey, (oldData) => {
      if (!oldData) {
        return oldData;
      }
      return oldData.map((s) => (s.spanId === span.spanId ? { ...s, childStatus: ChildStatus.LoadingChildren } : s));
    });

    // Load the children
    const spans = await loadMoreSpans(traceId, datasourceUid, idToLevelMap.current, span);

    // Update the parent span to show children
    queryClient.setQueryData<SpanInfo[]>(queryKey, (oldData) => {
      if (!oldData) {
        return spans;
      }

      let nextSpans: SpanInfo[] = [];

      for (const sp of oldData) {
        nextSpans.push(sp);

        if (sp.spanId === span.spanId) {
          const last = nextSpans.at(-1);
          if (last) {
            last.childStatus = ChildStatus.ShowChildren;
          }
          nextSpans.push(...spans);
        }
      }

      return nextSpans;
    });
  };

  let showChildren = (span: SpanInfo) => {
    queryClient.setQueryData<SpanInfo[]>(queryKey, (oldData) => {
      return oldData?.map((sp) => {
        return sp.spanId === span.spanId ? { ...span, childStatus: ChildStatus.ShowChildren } : sp;
      });
    });
  };

  let hideChildren = (span: SpanInfo) => {
    queryClient.setQueryData<SpanInfo[]>(queryKey, (oldData) => {
      if (!oldData) {
        return oldData;
      }

      const descendantsToHide = new Set<string>([span.spanId]);

      const newData = oldData.map((sp) => {
        // Check if this span should be hidden (either it's the target or its parent is being hidden)
        const shouldHide = sp.spanId === span.spanId || (sp.parentSpanId && descendantsToHide.has(sp.parentSpanId));

        if (shouldHide) {
          descendantsToHide.add(sp.spanId); // Add to set for future children
          // Only change status if it's not NoChildren
          const newStatus =
            sp.childStatus === ChildStatus.NoChildren ? ChildStatus.NoChildren : ChildStatus.HideChildren;
          return { ...sp, childStatus: newStatus };
        }

        return sp;
      });

      return newData;
    });
  };

  function copyTraceId() {
    navigator.clipboard.writeText(traceId);
  }

  const virtualItems = rowVirtualizer.getVirtualItems();

  function copyData() {
    if (!result.isSuccess) {
      return;
    }
    const striped = result.data.map((d) => ({
      level: d.level,
      spanId: d.spanId,
      parentSpanId: d.parentSpanId,
    }));
    navigator.clipboard.writeText(JSON.stringify(striped));
  }

  return (
    <div className="flex relative">
      <div className="flex-grow flex flex-col">
        <div className="flex bg-gray-800 p-2 border-b border-gray-700">
          <div className="w-1/3 font-bold flex items-center justify-between">
            <span onClick={copyTraceId}>Span</span>
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-1 rounded hover:bg-gray-700 transition-colors"
              title="Get help"
            >
              <Icon name="info-circle" className="text-gray-400 hover:text-white w-4 h-4" />
            </button>
          </div>
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
          <button onClick={copyData}>Copy data</button>
          {result.isSuccess && (
            <div ref={parentRef} className="overflow-auto" style={{ height: `calc(${panelHeight}px - 44px)` }}>
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                }} // Limitation in tailwind dynamic class construction: Check README.md for more details
                className="w-full relative"
              >
                {virtualItems.map((virtualItem) => {
                  // The index of result.data
                  const originalIndex = visibleIndexes[virtualItem.index];
                  const span = result.data[originalIndex];
                  let updateChildStatus = (span: SpanInfo) => {};
                  switch (span.childStatus) {
                    case ChildStatus.HideChildren:
                      updateChildStatus = showChildren;
                      break;
                    case ChildStatus.RemoteChildren:
                      updateChildStatus = loadRemoteChildren;
                      break;
                    case ChildStatus.ShowChildren:
                      updateChildStatus = hideChildren;
                      break;
                    case ChildStatus.NoChildren:
                    case ChildStatus.LoadingChildren:
                      break;
                  }
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
                        updateChildStatus={updateChildStatus}
                        traceStartTimeInMiliseconds={traceStartTimeInMiliseconds}
                        traceDurationInMiliseconds={traceDurationInMiliseconds}
                        onSelect={setSelectedSpan}
                        isSelected={selectedSpan?.spanId === span.spanId}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <SpanOverlayDrawer
        isOpen={!!selectedSpan}
        onClose={() => setSelectedSpan(null)}
        title="Span Details"
        panelWidth={panelWidth || window.innerWidth}
      >
        {selectedSpan && (
          <SpanDetailPanel span={selectedSpan} onClose={() => setSelectedSpan(null)} datasourceUid={datasourceUid} />
        )}
      </SpanOverlayDrawer>
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        type="general-help"
        currentWidth={panelWidth}
        currentHeight={window.innerHeight}
      />
    </div>
  );
}

export default TraceDetail;

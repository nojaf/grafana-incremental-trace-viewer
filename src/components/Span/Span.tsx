import React from 'react';
import { Icon } from '@grafana/ui';
import { type components } from '../../schema.gen';
import { calculateColourBySpanId, getMillisecondsDifferenceNative } from '../../utils/utils.timeline';

type SpanNode = components['schemas']['SpanNode'];

type SpanNodeProps = SpanNode & {
  index: number;
  loadMore: (index: number, spanId: string, currentLevel: number, skip: number) => void;
  traceStartTime: number;
  traceDuration: number;
  onSelect: (span: SpanNode) => void;
};

export const Span = (props: SpanNodeProps) => {
  const offset = ((new Date(props.startTime).getTime() - props.traceStartTime) / props.traceDuration) * 100;
  const width = (getMillisecondsDifferenceNative(props.startTime, props.endTime) / props.traceDuration) * 100;

  const hasChildren = props.totalChildrenCount > 0;
  const canLoadMore = props.currentChildrenCount < props.totalChildrenCount;

  return (
    <div
      className="flex items-center hover:bg-gray-700 cursor-pointer h-full text-sm"
      onClick={() => props.onSelect(props)}
    >
      <div
        className="w-1/3 flex items-center justify-between gap-1 pr-2"
        style={{ paddingLeft: `calc(0.5rem * ${props.level})` }} // Limitation in tailwind dynamic class construction: Check README.md for more details
      >
        <div className="flex items-center gap-1 truncate">
          {hasChildren ? <Icon name="angle-down" /> : <span className="inline-block w-4"></span>}
          <span>{props.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {canLoadMore && (
            <Icon
              name="plus"
              className="text-xs cursor-pointer"
              title="Load more traces"
              onClick={(e) => {
                e.stopPropagation();
                props.loadMore(props.index, props.spanId, props.level, props.currentChildrenCount);
              }}
            />
          )}
          {props.totalChildrenCount > 0 && (
            <span className="text-xs text-gray-500">
              {props.currentChildrenCount}/{props.totalChildrenCount}
            </span>
          )}
        </div>
      </div>
      <div
        className="w-2/3 h-full relative border-l-3"
        style={{ borderColor: calculateColourBySpanId(props.level > 2 ? props.parentSpanId : props.spanId) }} // Limitation in tailwind dynamic class construction: Check README.md for more details
      >
        <div className="h-full relative mx-4">
          <div
            className="bg-blue-500 h-3/4 absolute my-auto top-0 bottom-0 rounded-sm min-[2px]"
            style={{ left: `${offset}%`, width: `${Math.max(width, 0.1)}%` }} // Limitation in tailwind dynamic class construction: Check README.md for more details
            title={`Duration: ${getMillisecondsDifferenceNative(props.startTime, props.endTime)}ms`}
          ></div>
        </div>
      </div>
    </div>
  );
};

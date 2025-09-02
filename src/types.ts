import { TimeRange } from '@grafana/data';
import type React from 'react';
import { KeyValue } from 'utils/utils.api';

export enum ChildStatus {
  NoChildren,
  RemoteChildren,
  LoadingChildren,
  ShowChildren,
  HideChildren,
}

export type SpanInfo = {
  spanId: string;
  parentSpanId: string | null;
  traceId: string;
  level: number;
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  name: string;
  childStatus: ChildStatus;
  childCount?: number;
  serviceName?: string;
  warning: string | null;
  events: Array<{ time: number; value: string }>;
  attributes: KeyValue[];
};

export type TraceViewerHeaderProps = {
  traceId: string;
  startTimeInMs: number;
  durationInMs: number;
  panelWidth?: number;
  panelHeight?: number;
  timeRange: TimeRange;
  leftColumnPercent: number;
  onDividerMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onCollapseAll: () => void;
  hasExpandedSpans?: boolean;
  // This is the offset on the right side of the timeline.
  // It is used to shrink the timeline to make room for the top-level span duration.
  timelineOffset: number;
};

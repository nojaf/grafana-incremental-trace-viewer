import { TimeRange } from '@grafana/data';
import type React from 'react';

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
  serviceNamespace?: string;
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
};

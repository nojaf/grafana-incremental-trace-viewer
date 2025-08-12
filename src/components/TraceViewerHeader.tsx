import React from 'react';
import { TraceViewerHeaderProps } from '../types';
import { IconButton } from '@grafana/ui';
// removed unused Help/Info imports after replacing with resize handle
import { isDark } from '../utils/utils.url';

export const TraceViewerHeader = ({
  traceId,
  startTimeInMs,
  durationInMs,
  panelWidth,
  panelHeight,
  timeRange,
  leftColumnPercent,
  onDividerMouseDown,
  onCollapseAll,
  hasExpandedSpans = false,
}: TraceViewerHeaderProps) => {
  function copyTraceId() {
    navigator.clipboard.writeText(traceId);
  }

  // Format the start time
  const formatStartTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // Format duration in seconds
  const formatDuration = (durationMs: number) => {
    return `${(durationMs / 1000).toFixed(2)}s`;
  };

  // Get Grafana-style time range text
  const getTimeRangeText = () => {
    if (!timeRange?.from || !timeRange?.to) {
      return 'Last 90 days';
    }

    const from = new Date(timeRange.from.valueOf());
    const to = new Date(timeRange.to.valueOf());
    const now = new Date();

    // Calculate the difference in milliseconds
    const diffMs = to.getTime() - from.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    // Check if it's a relative time range (ending at "now")
    const isRelative = Math.abs(to.getTime() - now.getTime()) < 60000; // Within 1 minute of now

    if (isRelative) {
      // Format as relative time range
      if (diffMinutes < 60) {
        return `Last ${diffMinutes} minutes`;
      } else if (diffHours <= 24) {
        return `Last ${diffHours} hours`;
      } else if (diffDays <= 7) {
        return `Last ${diffDays} days`;
      } else if (diffWeeks <= 4) {
        return `Last ${diffWeeks} weeks`;
      } else if (diffMonths <= 12) {
        return `Last ${diffMonths} months`;
      } else {
        return `Last ${Math.floor(diffDays / 365)} years`;
      }
    } else {
      // Format as absolute time range
      const fromStr = from.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: from.getFullYear() !== to.getFullYear() ? 'numeric' : undefined,
      });
      const toStr = to.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${fromStr} - ${toStr}`;
    }
  };

  const borderColour = isDark ? 'border-gray-600' : 'border-gray-300';
  const textColour = isDark ? 'text-white' : 'text-black';

  return (
    <>
      <div className={`flex-grow flex flex-row items-center ${borderColour} border-b relative`}>
        <div className="font-bold flex items-center justify-between" style={{ width: `${leftColumnPercent}%` }}>
          <div className="px-3 py-1 text-xs/4 font-light">
            <div className="space-y-1">
              {/* First line: Span ID and time range */}
              <div className="flex items-center space-x-1">
                <span className="text-gray-400">Span:</span>
                <span
                  className={`${textColour} font-semibold cursor-pointer hover:text-gray-300`}
                  onClick={copyTraceId}
                  title="Click to copy trace ID"
                >
                  {traceId.slice(0, 8)}
                </span>
                <span className="text-gray-400">in</span>
                <span className={`${textColour} font-semibold`}>{getTimeRangeText()}</span>
              </div>

              {/* Second line: Start time and duration */}
              <div className="flex items-center space-x-1">
                <span className="text-gray-400">Start:</span>
                <span className={`${textColour}`}>{formatStartTime(startTimeInMs)}</span>
                <span className="text-gray-400 mx-1">|</span>
                <span className="text-gray-400">Duration:</span>
                <span className={`${textColour}`}>{formatDuration(durationInMs)}</span>
              </div>
            </div>
          </div>
          {/* Collapse All Button */}
          <div className="px-3 py-1">
            <IconButton
              variant="secondary"
              name="table-collapse-all"
              size="sm"
              onClick={onCollapseAll}
              title="Collapse all expanded spans"
              disabled={!hasExpandedSpans}
              aria-label="Collapse all expanded spans"
            />
          </div>
        </div>
        <div className="font-bold px-4" style={{ width: `${100 - leftColumnPercent}%` }}>
          <div className="w-full relative">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="absolute border-l border-gray-500 h-2 pl-1 text-xs"
                style={{ left: `${(i / 3) * 100}%` }}
              >
                {i < 3 && `${((durationInMs / 1000 / 3) * i).toFixed(2)}s`}
              </div>
            ))}
            {/* Last value just before the line */}
            <div className="absolute right-[4px] top-0 text-xs">{formatDuration(durationInMs)}</div>
          </div>
        </div>
        {/* Header vertical divider to resize columns */}
        <div
          onMouseDown={onDividerMouseDown}
          title="Drag to resize"
          style={{ left: `calc(${leftColumnPercent}% - 3px)` }}
          className="absolute top-0 h-full w-[6px] cursor-col-resize hover:bg-gray-600/50 active:bg-gray-500/60"
        >
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-[2px] pointer-events-none">
            <span className="block w-1 h-1 rounded-full bg-gray-400"></span>
            <span className="block w-1 h-1 rounded-full bg-gray-400"></span>
            <span className="block w-1 h-1 rounded-full bg-gray-400"></span>
          </div>
        </div>
      </div>
    </>
  );
};

export default TraceViewerHeader;

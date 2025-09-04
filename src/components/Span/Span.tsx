import React, { useCallback, MouseEvent } from 'react';
import { Icon, IconButton, Tooltip } from '@grafana/ui';
import { formatDuration, getColourForValue, mkMilisecondsFromNanoSeconds } from '../../utils/utils.timeline';
import { SpanInfo, ChildStatus } from '../../types';

type SpanNodeProps = SpanInfo & {
  updateChildStatus: (span: SpanInfo) => void;
  traceStartTimeInMiliseconds: number;
  traceDurationInMiliseconds: number;
  onSelect: (span: SpanInfo, selectedElementTopCoordinate?: number) => void;
  isSelected?: boolean;
  leftColumnPercent: number;
  // This is the offset on the right side of the timeline.
  // It is used to shrink the timeline to make room for the top-level span duration.
  timelineOffset: number;
};

const Expand = ({ childStatus, action }: { childStatus: ChildStatus; action: () => void }) => {
  let mouseDown = useCallback(
    (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      action();
    },
    [action]
  );
  switch (childStatus) {
    case ChildStatus.RemoteChildren:
    case ChildStatus.HideChildren:
      return <Icon name="angle-right" onMouseDown={mouseDown} />;
    case ChildStatus.ShowChildren:
      return <Icon name="angle-down" onMouseDown={mouseDown} />;
    case ChildStatus.NoChildren:
      return <Icon name="circle-mono" className="px-1.5 opacity-50" />; // px-1.5 is set to reduce the size of the icon and keep alignment
    case ChildStatus.LoadingChildren:
      return <Icon name="spinner" className="animate-spin" />;
  }
};

export const Span = (props: SpanNodeProps) => {
  const offset =
    ((mkMilisecondsFromNanoSeconds(props.startTimeUnixNano) - props.traceStartTimeInMiliseconds) /
      props.traceDurationInMiliseconds) *
    100;
  const width =
    ((mkMilisecondsFromNanoSeconds(props.endTimeUnixNano) - mkMilisecondsFromNanoSeconds(props.startTimeUnixNano)) /
      props.traceDurationInMiliseconds) *
    100;

  // We don't show the root timing
  const formattedDuration = formatDuration(props.endTimeUnixNano - props.startTimeUnixNano);
  const timing = (
    <div
      className="absolute top-0 h-full flex items-center whitespace-nowrap"
      // We want to display the duration on the right side of the span.
      // We add 1% to the width for some padding.
      style={{ left: `${width + offset + 1}%` }}
    >
      <span className="m-auto leading-none text-gray-500 dark:text-gray-500 font-xs font-mono">
        {formattedDuration}
      </span>
    </div>
  );

  return (
    <div
      className={`flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer h-full text-sm ${
        props.isSelected ? 'bg-blue-100 dark:bg-gray-600 z-1000' : ''
      }`}
    >
      <div
        className="flex items-center justify-between gap-1 pr-2"
        style={{
          paddingLeft: `calc(2rem * ${props.level})`,
          width: `${props.leftColumnPercent}%`,
          minWidth: 0,
        }} // Limitation in tailwind dynamic class construction: Check README.md for more details
      >
        <div className="flex items-center gap-1 truncate" title={`${props.serviceName} - ${props.name}`}>
          <Expand childStatus={props.childStatus} action={() => props.updateChildStatus(props)}></Expand>

          <strong
            style={{ backgroundColor: getColourForValue(props.serviceName || 'default') }}
            className="block p-[3px] min-w-5 mr-1 rounded font-mono font-thin leading-none text-gray-900 dark:text-black text-center"
          >
            {props.childCount || 0}
          </strong>
          {props.warning !== null && (
            <IconButton name="exclamation-circle" variant="destructive" tooltip={props.warning} size="sm" />
          )}
          <span className="text-gray-900 dark:text-white">{props.serviceName}</span>
          <span className="text-gray-400">{props.name}</span>
        </div>
      </div>
      <div
        className="h-full relative border-l-3"
        // We leave a bit or room for the duration text of the top-level span.
        style={{ width: `calc(${100 - props.leftColumnPercent}% - ${props.timelineOffset}px)` }}
        onClick={(e) => props.onSelect(props, e.currentTarget.getBoundingClientRect().top)}
      >
        <div className="h-full relative mx-1">
          {props.events.map((e) => {
            const left =
              ((mkMilisecondsFromNanoSeconds(e.time) - props.traceStartTimeInMiliseconds) /
                props.traceDurationInMiliseconds) *
              100;
            return (
              <span
                key={e.time}
                className="absolute z-2000 h-full w-[1px] bg-neutral-950 flex items-center justify-center"
                style={{ left: `${left}%` }}
              >
                <Tooltip content={e.value} placement="top">
                  <Icon
                    name="circle-mono"
                    size="xs"
                    style={{
                      color: 'white',
                      height: '7px',
                      width: '7px',
                      border: '1px solid black',
                      borderRadius: '50%',
                    }}
                  />
                </Tooltip>
              </span>
            );
          })}
          <div
            className="h-3/4 absolute my-auto top-0 bottom-0 rounded-sm min-w-[2px]"
            style={{
              left: `${offset}%`,
              width: `${Math.max(width, 0.1)}%`,
              backgroundColor: getColourForValue(props.serviceName || 'default'),
            }} // Limitation in tailwind dynamic class construction: Check README.md for more details
            title={`Duration: ${props.endTimeUnixNano - props.startTimeUnixNano}ns`}
            data-testid={`span-duration-${props.name}`}
          ></div>
          {timing}
        </div>
      </div>
    </div>
  );
};

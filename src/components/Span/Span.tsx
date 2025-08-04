import React, { useCallback, MouseEvent } from 'react';
import { Icon } from '@grafana/ui';
import { getColourForValue, mkMilisecondsFromNanoSeconds } from '../../utils/utils.timeline';
import { SpanInfo, ChildStatus } from '../../types';

type SpanNodeProps = SpanInfo & {
  updateChildStatus: (span: SpanInfo) => void;
  traceStartTimeInMiliseconds: number;
  traceDurationInMiliseconds: number;
  onSelect: (span: SpanInfo) => void;
  isSelected?: boolean;
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
      return null;
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

  return (
    <div
      className={`flex items-center hover:bg-gray-700 cursor-pointer h-full text-sm ${
        props.isSelected ? 'bg-gray-600 hover:bg-gray-700 z-1000' : ''
      }`}
    >
      <div
        className="w-1/3 flex items-center justify-between gap-1 pr-2"
        style={{ paddingLeft: `calc(2rem * ${props.level})` }} // Limitation in tailwind dynamic class construction: Check README.md for more details
      >
        <div className="flex items-center gap-1 truncate">
          <Expand childStatus={props.childStatus} action={() => props.updateChildStatus(props)}></Expand>
          {/* {props.hasMore ? <Icon name="angle-down" /> : <span className="inline-block w-4"></span>} */}
          <span>{props.name}</span>
        </div>
      </div>
      <div className="w-2/3 h-full relative border-l-3" onClick={() => props.onSelect(props)}>
        <div className="h-full relative mx-4">
          <div
            className="h-3/4 absolute my-auto top-0 bottom-0 rounded-sm min-w-[2px]"
            style={{
              left: `${offset}%`,
              width: `${Math.max(width, 0.1)}%`,
              backgroundColor: getColourForValue(props.serviceNamespace || 'default'),
            }} // Limitation in tailwind dynamic class construction: Check README.md for more details
            title={`Duration: ${props.endTimeUnixNano - props.startTimeUnixNano}ns`}
          ></div>
        </div>
      </div>
    </div>
  );
};

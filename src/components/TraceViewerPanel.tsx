import React from 'react';
import { PanelProps } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';

interface Props extends PanelProps<{}> {}

type QueryInfo = {
  datasourceUid: string;
  query: string;
  traceId: string;
  traceName: string;
  startTimeInMs: number;
  durationInMs: number;
};

export const TraceViewerPanel: React.FC<Props> = ({ options, data, width, height, fieldConfig, id }) => {
  console.log('data', data);

  let queries: QueryInfo[] = [];
  // if (data.request?.targets.length === 0 || data.series.length === 0 || data.request?.targets.length !== data.series.length) {
  //     return <div>Invalid query data</div>;
  // }
  for (let i = 0; i < data.series.length; i++) {
    const series = data.series[i];
    const target = data.request?.targets[i];
    if (!target || !target.datasource?.uid) {
      continue;
    }
    const traceIds = series.fields.find((f) => f.name === 'traceID')?.values || [];
    const startTimes = series.fields.find((f) => f.name === 'startTime')?.values || [];
    const traceNames = series.fields.find((f) => f.name === 'traceName')?.values || [];
    const traceDurations = series.fields.find((f) => f.name === 'traceDuration')?.values || [];

    for (let j = 0; j < traceIds.length; j++) {
      const traceId = traceIds[j];
      const startTime = startTimes[j];
      const traceName = traceNames[j];
      const traceDuration = traceDurations[j];
      console.log('traceId', traceId, startTime);
      queries.push({
        datasourceUid: target.datasource.uid,
        query: (target as any)['query'],
        traceId,
        startTimeInMs: startTime,
        traceName,
        durationInMs: traceDuration,
      });
    }
  }

  console.table(queries);

  if (data.series.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  return (
    <div>
      Plugin panel here.
      <ul>
        {queries.map((queryInfo) => {
          return (
            <li key={queryInfo.traceId}>
              <pre> {JSON.stringify(queryInfo, undefined, 2)}</pre>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

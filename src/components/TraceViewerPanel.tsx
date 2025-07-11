import React from 'react';
import { PanelProps } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import TraceDetail from './TraceDetail';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

interface Props extends PanelProps<{}> {}

export type QueryInfo = {
  datasourceUid: string;
  query: string;
  traceId: string;
  traceName: string;
  startTimeInMs: number;
  durationInMs: number;
  panelWidth?: number;
};

export const TraceViewerPanel: React.FC<Props> = ({ options, data, width, height, fieldConfig, id }) => {
  console.log('data', data);
  console.log('width', width);
  console.log('height', height);
  // Check if panel size meets minimum requirements
  if (width < 600 || height < 300) {
    return (
      <div className="flex items-center justify-center h-full p-4 text-center">
        <div className="text-red-500">
          <h3 className="text-lg font-semibold mb-2">⚠️ Panel too small for trace visualization</h3>
          <p>This panel requires a minimum size of 600x300 pixels.</p>
          <p className="text-sm text-gray-500 mt-1">
            Current size: {width}x{height} pixels
          </p>
        </div>
      </div>
    );
  }

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

  if (data.series.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="relative overflow-y-scroll max-h-full">
        {queries.map((queryInfo) => {
          return <TraceDetail key={queryInfo.traceId} {...queryInfo} panelWidth={width} />;
        })}
      </div>
    </QueryClientProvider>
  );
};

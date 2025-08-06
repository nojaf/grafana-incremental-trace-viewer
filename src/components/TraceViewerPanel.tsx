import React, { useEffect, useMemo } from 'react';
import { PanelData, PanelProps } from '@grafana/data';
import { Button } from '@grafana/ui';
import TraceDetail from './TraceDetail';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelpModal } from './HelpModal';

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
  panelHeight?: number;
};

function extractQueries(data: PanelData): QueryInfo[] {
  let queries: QueryInfo[] = [];
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
      const startTimeAsString = (startTimes[j] || 0).toString().replace('.', '');
      const startTime = parseInt(
        startTimeAsString.length > 13 ? startTimeAsString.substring(0, 13) : startTimeAsString,
        10
      );
      const traceName = traceNames[j];
      const traceDuration = traceDurations[j];
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
  return queries;
}

export const TraceViewerPanel: React.FC<Props> = ({ options, data, width, height, fieldConfig, id, timeRange }) => {
  const [showHelpModal, setShowHelpModal] = React.useState(false);
  const [helpModalType, setHelpModalType] = React.useState<'panel-too-small' | 'no-data'>('panel-too-small');

  const queries = useMemo(() => extractQueries(data), [data]);
  useEffect(() => {
    if (queries.length > 1) {
      const traceIds = queries.map((q) => '- ' + q.traceId).join('\n');
      console.warn(`Multiple traces found in the query result:\n${traceIds}\nOnly the first trace will be displayed.`);
    }
  }, [queries]);

  // Check if no traces are available (either no series or no traces found in series)
  if (data.series.length === 0 || queries.length === 0) {
    return (
      <>
        <div className="flex items-center justify-center h-full p-4 text-center">
          <div className="text-blue-500">
            <h3 className="text-lg font-semibold mb-2">📊 No trace data available</h3>
            <p>The current query returned no trace data.</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your query or time range to see traces.</p>
            <Button
              onClick={() => {
                setHelpModalType('no-data');
                setShowHelpModal(true);
              }}
              variant="primary"
              className="mt-4"
            >
              Get Help
            </Button>
          </div>
        </div>
        <HelpModal
          isOpen={showHelpModal}
          onClose={() => setShowHelpModal(false)}
          type={helpModalType}
          currentWidth={width}
          currentHeight={height}
        />
      </>
    );
  }
  // Check if panel size meets minimum requirements
  else if (width < 600 || height < 300) {
    return (
      <>
        <div className="flex items-center justify-center h-full p-4 text-center">
          <div className="text-orange-500">
            <h3 className="text-lg font-semibold mb-2">⚠️ Panel too small for trace visualization</h3>
            <p>This panel requires a minimum size of 600x300 pixels.</p>
            <p className="text-sm text-gray-500 mt-1">
              Current size: {width}x{height} pixels
            </p>
            <Button
              onClick={() => {
                setHelpModalType('panel-too-small');
                setShowHelpModal(true);
              }}
              variant="primary"
              className="mt-4"
            >
              Get Help
            </Button>
          </div>
        </div>
        <HelpModal
          isOpen={showHelpModal}
          onClose={() => setShowHelpModal(false)}
          type={helpModalType}
          currentWidth={width}
          currentHeight={height}
        />
      </>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TraceDetail
        key={queries[0].traceId}
        {...queries[0]}
        panelWidth={width}
        panelHeight={height}
        timeRange={timeRange}
      />
    </QueryClientProvider>
  );
};

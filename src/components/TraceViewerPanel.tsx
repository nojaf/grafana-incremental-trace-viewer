import React, { useEffect, useMemo } from 'react';
import { PanelData, PanelProps } from '@grafana/data';
import { Icon, TextLink } from '@grafana/ui';
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
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <Icon name="calendar-slash" size="xxxl" className="text-gray-400 dark:text-zinc-600 mb-5" />
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
            No trace data available for this query
          </h3>
          <p className="text-md text-gray-600 dark:text-zinc-400 mt-1">
            Try adjusting your query or time range to see traces.{' '}
            <TextLink
              onClick={() => {
                setHelpModalType('no-data');
                setShowHelpModal(true);
              }}
              inline={true}
              color="disabled"
              href="#no-data"
            >
              Learn more
            </TextLink>
          </p>
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
        <div className="flex flex-col h-full">
          <p className="bg-red-400 py-1 text-black text-md flex items-center justify-center gap-2 rounded">
            <Icon name="exclamation-triangle" /> Current panel size is {Math.floor(width)}x{Math.floor(height)} pixels
          </p>
          <div className="text-center flex-1 flex flex-col justify-center">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Panel too small</h3>
            <p className="text-gray-600 dark:text-zinc-400">This panel requires a minimum size of 600x300 pixels.</p>
            <TextLink
              onClick={() => {
                setHelpModalType('panel-too-small');
                setShowHelpModal(true);
              }}
              color="disabled"
              inline={true}
              href="#panel-too-small"
              style={{ display: 'block' }}
            >
              Learn more
            </TextLink>
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
        // Grafana adds padding-block of 8px
        panelHeight={height + 16}
        timeRange={timeRange}
      />
    </QueryClientProvider>
  );
};

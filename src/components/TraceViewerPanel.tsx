import React from 'react';
import { PanelProps } from '@grafana/data';
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
};

export const TraceViewerPanel: React.FC<Props> = ({ options, data, width, height, fieldConfig, id }) => {
  console.log('data', data);
  console.log('width', width);
  console.log('height', height);

  const [showHelpModal, setShowHelpModal] = React.useState(false);
  const [helpModalType, setHelpModalType] = React.useState<'panel-too-small' | 'no-data'>('panel-too-small');

  // Check if panel size meets minimum requirements
  if (width < 600 || height < 300) {
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
      // It still is hard to tell what unit start time is.
      console.log('raw start time', startTimes[j]);
      const startTimeAsString = (startTimes[j] || 0).toString().replace('.', '');
      const startTime = parseInt(
        startTimeAsString.length > 13 ? startTimeAsString.substring(0, 13) : startTimeAsString,
        10
      );
      console.log('startTime', startTime);
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

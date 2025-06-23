import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppRootProps } from '@grafana/data';
import { ROUTES } from '../../constants';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const TraceOverview = React.lazy(() => import('../../pages/TraceOverview'));
const TraceDetail = React.lazy(() => import('../../pages/TraceDetail'));
const queryClient = new QueryClient();

function App(props: AppRootProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path={`:datasourceId/${ROUTES.TraceDetails}/:traceId/:spanId`} element={<TraceDetail />} />
        <Route path="*" element={<TraceOverview />} />
      </Routes>
    </QueryClientProvider>
  );
}

export default App;

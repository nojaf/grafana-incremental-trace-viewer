import React from 'react';
import { prefixRoute } from '../utils/utils.routing';
import { ROUTES } from '../constants';
import { testIds } from '../components/testIds';
import { lastValueFrom } from 'rxjs';
import { PluginPage, getBackendSrv } from '@grafana/runtime';
import { Link } from 'react-router-dom';
import { useSuspenseQuery } from '@tanstack/react-query';
import plugin from '../plugin.json';

type simpleTrace = {
  traceId: string;
  spanId: string;
  timestamp: string;
  name: string;
};

type rootTracesResponse = {
  traces: simpleTrace[];
};

function TraceOverview() {
  const result = useSuspenseQuery<simpleTrace[]>({
    queryKey: ['traces'],
    queryFn: () =>
      new Promise(async (resolve, _) => {
        const response = await getBackendSrv().fetch<rootTracesResponse>({
          url: `/api/plugins/${plugin.id}/resources/traces`,
        });
        const value = await lastValueFrom(response);
        console.log(value.data);
        resolve(value.data.traces);
      }),
  });

  return (
    <PluginPage>
      <div data-testid={testIds.pageOne.container}>
        This is the trace overview page. We would need to add filters here ourselves.
        <ul>
          {result.data.map((r) => {
            return (
              <Link key={r.spanId} to={prefixRoute(`${ROUTES.TraceDetails}/${r.traceId}/${r.spanId}`)}>
                <li>
                  {r.name} ({r.spanId})
                </li>
              </Link>
            );
          })}
        </ul>
      </div>
    </PluginPage>
  );
}

export default TraceOverview;

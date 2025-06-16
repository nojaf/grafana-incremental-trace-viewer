import React, { useState } from 'react';
import { prefixRoute } from '../utils/utils.routing';
import { ROUTES } from '../constants';
import { testIds } from '../components/testIds';
import { lastValueFrom } from 'rxjs';
import { PluginPage, getBackendSrv } from '@grafana/runtime';
import { Combobox } from '@grafana/ui';
import { Link } from 'react-router-dom';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import plugin from '../plugin.json';

type datasource = {
  id: number;
  uid: string;
  name: string;
  type: string;
  typeName: string;
  jsonData: {
    // Index name
    database: string;
    timeField: string;
  };
  url: string;
};

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
  const datasources = useSuspenseQuery<datasource[]>({
    queryKey: ['datasources'],
    queryFn: () =>
      new Promise(async (resolve, _) => {
        const response = await getBackendSrv().fetch<datasource[]>({
          url: `/api/datasources`,
        });
        const value = await lastValueFrom(response);
        resolve(value.data);
      }),
  });

  const [selectedSource, setSelectedSource] = useState<number | null>(null);

  const result = useQuery<simpleTrace[]>({
    queryKey: ['traces', selectedSource],
    queryFn: async ({ queryKey }) => {
      const [, sourceId] = queryKey;

      if (sourceId === null) {
        return [];
      }

      const datasource = datasources.data.find((d) => d.id === sourceId);
      if (!datasource) {
        throw new Error(`Datasource with id ${sourceId} not found`);
      }
      const response = getBackendSrv().fetch<rootTracesResponse>({
        url: `/api/plugins/${plugin.id}/resources/traces`,
        method: 'POST',
        data: {
          url: datasource.url,
          database: datasource.jsonData.database,
          timeField: datasource.jsonData.timeField,
        },
      });
      const value = await lastValueFrom(response);
      return value.data.traces;
    },
  });

  const options = datasources.data.map((s) => {
    return {
      label: s.name,
      value: s.id,
      description: s.type,
    };
  });

  return (
    <PluginPage>
      <div data-testid={testIds.pageOne.container}>
        This is the trace overview page. We would need to add filters here ourselves.
        <Combobox
          options={options}
          onChange={(o) => {
            console.log(o);
            setSelectedSource(v.value);
          }}
        />
        {/* <ul>
          {result.data.map((r) => {
            return (
              <Link key={r.spanId} to={prefixRoute(`${ROUTES.TraceDetails}/${r.traceId}/${r.spanId}`)}>
                <li>
                  {r.name} ({r.spanId})
                </li>
              </Link>
            );
          })}
        </ul> */}
      </div>
    </PluginPage>
  );
}

export default TraceOverview;

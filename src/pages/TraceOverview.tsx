import React, { useState } from 'react';
import { prefixRoute } from '../utils/utils.routing';
import { BASE_URL, ROUTES } from '../constants';
import { testIds } from '../components/testIds';
import { lastValueFrom } from 'rxjs';
import { PluginPage, getBackendSrv } from '@grafana/runtime';
import { Combobox } from '@grafana/ui';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { type components, ApiPaths } from '../schema.gen';

export type datasource = {
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

type simpleTrace = components['schemas']['Trace'];
type rootTracesResponse = components['schemas']['Traces'];
type getTracesRequest = components['schemas']['GetTracesRequest'];

function TraceOverview() {
  const queryClient = useQueryClient();
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
    queryKey: ['datasource', selectedSource, 'traces'],
    queryFn: async ({ queryKey }) => {
      const sourceId = queryKey[1];

      if (sourceId === null) {
        return [];
      }

      const datasource = datasources.data.find((d) => d.id === sourceId);
      if (!datasource) {
        throw new Error(`Datasource with id ${sourceId} not found`);
      }
      const response = getBackendSrv().fetch<rootTracesResponse>({
        url: `${BASE_URL}/${ApiPaths.getTraces}`,
        method: 'POST',
        data: {
          url: datasource.url,
          database: datasource.jsonData.database,
          timeField: datasource.jsonData.timeField,
        } satisfies getTracesRequest,
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
        <div className="py-8">
          <Combobox
            options={options}
            placeholder="Select a datasource"
            onChange={(o) => {
              const datasource = datasources.data.find((d) => d.id === o.value);
              if (datasource) {
                queryClient.setQueryData<datasource[]>(['datasource', o.value], datasources.data, {});
                setSelectedSource(o.value);
              }
            }}
          />
        </div>
        {result.isSuccess && result.data.length > 0 && (
          <ul className="p-4">
            {result.data.map((r) => {
              return (
                <Link
                  key={r.spanId}
                  to={prefixRoute(`${selectedSource}/${ROUTES.TraceDetails}/${r.traceId}/${r.spanId}`)}
                >
                  <li>
                    {r.name} ({r.spanId})
                  </li>
                </Link>
              );
            })}
          </ul>
        )}
      </div>
    </PluginPage>
  );
}

export default TraceOverview;

import React from 'react';
import { prefixRoute } from '../utils/utils.routing';
import { useTraceFilters } from '../utils/utils.url';
import { BASE_URL, ROUTES } from '../constants';
import { testIds } from '../components/testIds';
import { lastValueFrom } from 'rxjs';
import { PluginPage, getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { Combobox, Field, Stack, Button, Icon, TimeRangeInput } from '@grafana/ui';
import { DataSourceApi, DataSourceJsonData, dateTime, TimeRange } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
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

type DataSourceInfo = components['schemas']['DataSourceInfo'];
type SearchResponse = components['schemas']['TempoV1Response'];
type TempoTrace = components['schemas']['TempoTrace'];

const debounce = <T extends (...args: any[]) => void>(func: T, delay: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
};

function TraceOverview() {
  const queryClient = useQueryClient();
  const [filters, updateFilters] = useTraceFilters();
  const updateTraceQL = debounce(function (query: string) {
    updateFilters({ query });
  }, 500);
  const [selectedDatasource, setSelectedDatasource] = React.useState<DataSourceApi<
    DataQuery,
    DataSourceJsonData
  > | null>(null);
  const [query, setQuery] = React.useState<DataQuery>({ refId: 'A' });

  const datasources = useSuspenseQuery<datasource[]>({
    queryKey: ['datasources'],
    queryFn: async () => {
      const response = getBackendSrv().fetch<datasource[]>({
        url: `/api/datasources`,
      });
      const value = await lastValueFrom(response);
      const datasource = value.data.filter((d) => d.type === 'tempo' || d.type === 'grafana-opensearch-datasource');
      return datasource;
    },
  });

  const selectedSource = filters.datasource ? parseInt(filters.datasource, 10) : null;
  React.useEffect(() => {
    if (selectedSource) {
      new Promise(async () => {
        const datasource = datasources.data.find((d) => d.id === selectedSource);
        if (datasource) {
          try {
            const datasourceInstance = await getDataSourceSrv().get(datasource.uid);
            setSelectedDatasource(datasourceInstance);
          } catch (error) {
            console.error('Failed to get datasource instance:', error);
          }
        }
      });
    }
  }, [selectedSource, datasources.data]);

  const result = useQuery<TempoTrace[]>({
    queryKey: ['datasource', selectedSource, 'traces', filters],
    queryFn: async ({ queryKey }) => {
      const sourceId = queryKey[1];

      if (sourceId === null) {
        return [];
      }

      const datasource = datasources.data.find((d) => d.id === sourceId);
      if (!datasource) {
        throw new Error(`Datasource with id ${sourceId} not found`);
      }
      const q = encodeURIComponent(filters.query || '{}');
      const start = filters.start ? parseInt(filters.start, 10) : new Date().getTime() / 1000;
      const end = filters.end ? parseInt(filters.end, 10) : new Date().getTime() / 1000;

      const response = getBackendSrv().fetch<SearchResponse>({
        url: `${BASE_URL}${ApiPaths.search}?q=${q}&start=${start}&end=${end}`,
        method: 'POST',
        data: {
          url: datasource.url,
          type: datasource.type,
          database: datasource.jsonData.database,
          timeField: datasource.jsonData.timeField,
        } satisfies DataSourceInfo,
      });
      const value = await lastValueFrom(response);
      return value.data.traces || [];
    },
  });

  const options = datasources.data.map((s) => {
    return {
      label: s.name,
      value: s.id,
      description: s.type,
    };
  });

  const handleClearFilters = () => {
    updateFilters({
      start: undefined,
      end: undefined,
      query: undefined,
      datasource: undefined,
    });
  };

  const hasActiveFilters = filters.query || filters.datasource;

  const handleTimeRangeChange = (timeRange: TimeRange) => {
    updateFilters({
      start: timeRange.from.unix().toString(),
      end: timeRange.to.unix().toString(),
    });
  };

  const getTimeRangeValue = (): TimeRange => {
    const from = filters.start ? dateTime(parseInt(filters.start, 10) * 1000) : dateTime().subtract(1, 'hour');
    const to = filters.end ? dateTime(parseInt(filters.end, 10) * 1000) : dateTime();
    return {
      from,
      to,
      raw: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    };
  };

  return (
    <PluginPage>
      <div data-testid={testIds.pageOne.container}>
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Trace Overview</h2>

          <Stack direction="column">
            {/* Datasource Selection */}
            <div className="mb-6">
              <Field label="Datasource">
                <Combobox
                  options={options}
                  placeholder="Select a datasource"
                  value={selectedSource ? options.find((o) => o.value === selectedSource) : undefined}
                  onChange={async (o) => {
                    const datasource = datasources.data.find((d) => d.id === o.value);
                    if (datasource) {
                      queryClient.setQueryData<datasource[]>(['datasource', o.value], datasources.data, {});
                      updateFilters({ datasource: o.value.toString() });
                    }
                  }}
                />
              </Field>
            </div>

            {/* Filters */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Filters</h3>
                {hasActiveFilters && (
                  <Button variant="secondary" size="sm" onClick={handleClearFilters} icon="times">
                    Clear Filters
                  </Button>
                )}
              </div>

              <Stack direction="column">
                {/* Time Range Filter */}
                <Field label="Time Range" className="self-start">
                  <TimeRangeInput value={getTimeRangeValue()} onChange={handleTimeRangeChange} showIcon />
                </Field>

                {/* Query Editor - dynamically loaded */}
                {selectedDatasource &&
                  selectedDatasource.type === 'tempo' &&
                  selectedDatasource.components?.QueryEditor && (
                    <Field label="Query" className="query-editor">
                      {(() => {
                        try {
                          const QueryEditor = selectedDatasource.components.QueryEditor;
                          return (
                            <QueryEditor
                              datasource={selectedDatasource}
                              query={query}
                              onChange={(newQuery: DataQuery) => {
                                setQuery(newQuery);
                                // query is a TempoQuery, but I'm not sure where that type should come from.
                                const tempoQuery = newQuery as any;
                                if (tempoQuery.query) {
                                  updateTraceQL(tempoQuery.query);
                                }
                                console.log('Query changed:', newQuery);
                              }}
                              onRunQuery={() => {
                                console.log('Run query requested');
                              }}
                            />
                          );
                        } catch (error) {
                          console.error('Failed to render QueryEditor:', error);
                          return <div>Unable to load query editor</div>;
                        }
                      })()}
                    </Field>
                  )}
              </Stack>
            </div>
          </Stack>
          {/* Results */}
          {result.isLoading && (
            <div className="text-center py-8">
              <Icon name="spinner" className="animate-spin text-2xl" />
              <p className="mt-2">Loading traces...</p>
            </div>
          )}

          {result.isError && (
            <div className="text-center py-8 text-red-600">
              <Icon name="exclamation-triangle" className="text-2xl" />
              <p className="mt-2">Error loading traces: {result.error?.message}</p>
            </div>
          )}

          {result.isSuccess && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Traces</h3>
                <span className="text-sm text-gray-500">
                  {result.data.length} trace{result.data.length !== 1 ? 's' : ''} found
                </span>
              </div>

              {result.data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Icon name="info-circle" className="text-2xl" />
                  <p className="mt-2">No traces found matching the current filters</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {result.data.map((r) => {
                    return (
                      <Link key={r.traceID} to={prefixRoute(`${selectedSource}/${ROUTES.TraceDetails}/${r.traceID}`)}>
                        <li className="p-3 hover:bg-gray-500 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">
                                {r.rootTraceName} ({r.rootServiceName})
                              </span>
                            </div>
                            {r.startTime && (
                              <div className="text-sm text-gray-500">{new Date(r.startTime).toLocaleString()}</div>
                            )}
                          </div>
                        </li>
                      </Link>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </PluginPage>
  );
}

export default TraceOverview;

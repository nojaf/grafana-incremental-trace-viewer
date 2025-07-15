import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';

type ValueOneofCase =
  | 'none'
  | 'stringValue'
  | 'boolValue'
  | 'intValue'
  | 'doubleValue'
  | 'arrayValue'
  | 'kvlistValue'
  | 'bytesValue';

type ArrayValue = {
  readonly values?: AnyValue[] | null;
};

type KeyValueList = {
  readonly values?: KeyValue[] | null;
};

export type AnyValue = {
  stringValue?: string | null;
  boolValue?: boolean;
  intValue?: number;
  doubleValue?: number;
  arrayValue?: ArrayValue;
  kvlistValue?: KeyValueList;
  bytesValue?: number[] | null;
  valueCase?: ValueOneofCase;
};

export type KeyValue = {
  key?: string | null;
  value?: AnyValue;
};

export type Span = {
  traceId?: string;
  spanID?: string;
  name?: string | null;
  startTimeUnixNano?: string;
  durationNanos?: string;
  readonly attributes?: KeyValue[];
};

type SpanSet = {
  readonly spans?: Span[];
  readonly matched?: number;
};

export type Trace = {
  readonly traceID: string;
  readonly startTimeUnixNano?: string;
  readonly durationMs?: string;
  readonly spanSets?: SpanSet[];
  readonly rootServiceName?: string;
  readonly rootTraceName?: string;
};

export type SearchResponse = {
  traces?: Trace[];
};

export async function search(
  datasourceUid: string,
  query: string,
  start: number,
  end: number,
  spss?: number
): Promise<SearchResponse> {
  // The end always needs to be greater than the start. If not, we get a bad request from the Tempo API.
  const validEnd = start < end ? end : end + 1;
  const responses = getBackendSrv().fetch<SearchResponse>({
    url: `/api/datasources/proxy/uid/${datasourceUid}/api/search?q=${encodeURIComponent(
      query
    )}&start=${start}&end=${validEnd}${spss ? `&spss=${spss}` : ''}`,
    method: 'GET',
  });
  const response = await lastValueFrom(responses);
  return response.data;
}

type SearchTagsResponse = {
  scopes: Array<{
    name: string;
    tags: string[];
  }>;
};

export async function searchTags(datasourceUid: string, query: string, start: number, end: number): Promise<string[]> {
  // The end always needs to be greater than the start. If not, we get a bad request from the Tempo API.
  const validEnd = start < end ? end : end + 1;
  const responses = getBackendSrv().fetch<SearchTagsResponse>({
    url: `/api/datasources/proxy/uid/${datasourceUid}/api/v2/search/tags?q=${encodeURIComponent(
      query
    )}&start=${start}&end=${validEnd}&scope=span`,
    method: 'GET',
  });
  const response = await lastValueFrom(responses);
  return response.data.scopes.find((scope) => scope.name === 'span')?.tags || [];
}

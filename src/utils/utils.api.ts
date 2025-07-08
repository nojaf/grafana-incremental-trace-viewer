import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';
import { ApiPaths, type components } from '../schema.gen';

type SearchResponse = components['schemas']['TempoV1Response'];

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
    url: `/api/datasources/proxy/uid/${datasourceUid}${ApiPaths.search}?q=${encodeURIComponent(
      query
    )}&start=${start}&end=${validEnd}${spss ? `&spss=${spss}` : ''}`,
    method: 'GET',
  });
  const response = await lastValueFrom(responses);
  return response.data;
}

type SearchTagsResponse = {
  scopes: {
    name: string;
    tags: string[];
  }[];
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

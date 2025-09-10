import { mkUnixEpochFromNanoSeconds } from './utils.timeline';

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
  // Tempo API returns intValue as a string 🙃
  intValue?: string;
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
  attributes?: KeyValue[];
};

type SpanSet = {
  spans?: Span[];
  matched?: number;
};

export type Trace = {
  readonly traceID: string;
  readonly startTimeUnixNano?: string;
  readonly durationMs?: number;
  readonly spanSets?: SpanSet[];
  readonly rootServiceName?: string;
  readonly rootTraceName?: string;
};

export type SearchResponse = {
  traces?: Trace[];
};

export type FetchFunction<TResponse> = (url: string, queryString: string) => Promise<TResponse>;

export async function search(
  fetchFn: FetchFunction<SearchResponse>,
  query: string,
  start: number,
  end: number,
  spss?: number
): Promise<SearchResponse> {
  // The end always needs to be greater than the start. If not, we get a bad request from the Tempo API.
  const validEnd = start < end ? end : end + 1;
  return fetchFn(
    `/api/search`,
    `q=${encodeURIComponent(query)}&start=${start}&end=${validEnd}${spss ? `&spss=${spss}` : ''}`
  );
}

type SearchTagsResponse = {
  scopes: Array<{
    name: string;
    tags: string[];
  }>;
};

export type SearchTagsResult = {
  spanTags: string[];
  resourceTags: string[];
};

// default Grafana does not support child count.
// In production, we use a custom build of Grafana that supports child count.
// This value is set at build time via environment variable SUPPORTS_CHILD_COUNT
export const supportsChildCount = process.env.SUPPORTS_CHILD_COUNT || false;

export async function searchTags(
  fetchFn: FetchFunction<SearchTagsResponse>,
  query: string,
  start: number,
  end: number
): Promise<SearchTagsResult> {
  // The end always needs to be greater than the start. If not, we get a bad request from the Tempo API.
  const validEnd = start < end ? end : end + 1;
  const responseData = await fetchFn(
    `/api/v2/search/tags`,
    `q=${encodeURIComponent(query)}&start=${start}&end=${validEnd}`
  );
  const spanTags = responseData.scopes.find((scope) => scope.name === 'span')?.tags || [];
  const resourceTags = responseData.scopes.find((scope) => scope.name === 'resource')?.tags || [];
  return { spanTags, resourceTags };
}

export type TagAttributes = {
  spanAttributes: Record<string, AnyValue>;
  resourceAttributes: Record<string, AnyValue>;
};

const anyNumberRegex = /\d/;
function escapeTag(str: string) {
  return anyNumberRegex.test(str) || str.includes(' ') ? `"${str}"` : str;
}

async function getTagAttributes(
  fetchFn: FetchFunction<SearchResponse>,
  start: number,
  end: number,
  traceId: string,
  spanId: string,
  tagResult: SearchTagsResult
): Promise<TagAttributes> {
  // There could potentially be a lot of tags, so we need to split them into groups to avoid the query being too long.
  const groups: string[][] = [];
  let currentGroup: string[] = ['span:parentID'];
  let currentLength = 0;
  let maxLength = 500;

  const { spanTags, resourceTags } = tagResult;

  // Add span tags to the groups
  for (const tag of spanTags) {
    const tagIdentifier = `span.${escapeTag(tag)}`;
    if (currentLength + tagIdentifier.length < maxLength) {
      currentGroup.push(tagIdentifier);
      currentLength += tagIdentifier.length;
    } else {
      groups.push(currentGroup);
      currentGroup = [tagIdentifier];
      currentLength = tagIdentifier.length;
    }
  }

  // Add resource tags to the groups
  for (const tag of resourceTags) {
    const tagIdentifier = `resource.${escapeTag(tag)}`;
    if (currentLength + tagIdentifier.length < maxLength) {
      currentGroup.push(tagIdentifier);
      currentLength += tagIdentifier.length;
    } else {
      groups.push(currentGroup);
      currentGroup = [tagIdentifier];
      currentLength = tagIdentifier.length;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  const promises = groups.map(async (group) => {
    const q = `{ trace:id = "${traceId}" && span:id = "${spanId}" } | select(${group.join(', ')})`;
    const data = await search(fetchFn, q, start, end, 1);
    return data?.traces?.[0]?.spanSets?.[0]?.spans?.[0]?.attributes || [];
  });

  const results: KeyValue[][] = await Promise.all(promises);
  const spanAttributes: Record<string, AnyValue> = {};
  const resourceAttributes: Record<string, AnyValue> = {};
  for (const result of results) {
    for (const keyValue of result) {
      if (keyValue.key && keyValue.value !== undefined) {
        if (resourceTags.includes(keyValue.key)) {
          resourceAttributes[keyValue.key] = keyValue.value;
        } else {
          spanAttributes[keyValue.key] = keyValue.value;
        }
      }
    }
  }

  return { spanAttributes, resourceAttributes };
}

export async function getTagAttributesForSpan(
  fetchFn: FetchFunction<any>,
  traceId: string,
  spanId: string,
  startTimeUnixNano: number,
  endTimeUnixNano: number
) {
  const qTags = `{ trace:id = "${traceId}" && span:id = "${spanId}" }`;
  const start = mkUnixEpochFromNanoSeconds(startTimeUnixNano);
  const end = mkUnixEpochFromNanoSeconds(endTimeUnixNano);
  const tagsResult = await searchTags(fetchFn, qTags, start, end);
  return getTagAttributes(fetchFn, start, end, traceId, spanId, tagsResult);
}

import type { SearchResponse } from '../src/utils/utils.api';
import trace from './test-trace.json';

const searchResponse: SearchResponse = {
  traces: [trace],
};

function filterSpansInPlace(filter, response: SearchResponse) {
  for (const trace of response.traces || []) {
    for (const spanSet of trace.spanSets || []) {
      spanSet.spans = spanSet.spans?.filter(filter) || [];
      spanSet.matched = spanSet.spans?.length || 0;
    }
  }
}

Bun.serve({
  port: 5359,
  hostname: '0.0.0.0',
  routes: {
    '/tempo/api/echo': new Response('echo', { headers: { 'Content-Type': 'text/plain' } }),
    '/tempo/api/search': async (req) => {
      console.log(`Received request on test API: ${req.url}`);

      const url = new URL(req.url);
      let query: string | null = null;
      if (url.searchParams.has('q')) {
        query = url.searchParams.get('q');
        console.log('Traceql query:', query);
      }
      let response = structuredClone(searchResponse);

      // Filter out spans with nestedSetParent = -1
      if (query?.includes('nestedSetParent')) {
        filterSpansInPlace(
          (span) => span.attributes?.find((attr) => attr.key === 'nestedSetParent')?.value?.intValue === '-1',
          response
        );
      }

      if (query?.includes('span:parentID =')) {
        const parentId = query?.match(/span:parentID = "([^"]+)"/)?.[1];
        console.log('Parent ID:', parentId);

        // Return children of trace
        // { trace:id = "53484b00671b90759570e5fa7aab800c" && span:parentID = "0d951ad733b4ab2f" } | select (span:name, resource.service.name)
        if (query?.includes('| select')) {
          filterSpansInPlace(
            (span) => span.attributes?.find((attr) => attr.key === 'span:parentID')?.value?.stringValue === parentId,
            response
          );
        }
      }

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    },

    '/tempo/*': async (req) => {
      console.log(`Received request on test API: ${req.url}`);
      return new Response('[]', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*', // Allow all origins
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', // Allow common methods
          'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Allow common headers
        },
      });
    },
  },
});

console.log('Test API running on http://localhost:5359');

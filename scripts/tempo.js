import { inspect } from 'util';

function nanoSecondsToUnixEpoch(nanoSeconds) {
  return Math.floor(nanoSeconds / Math.pow(10, 9));
}

function base64ToHex(base64Str) {
  try {
    const decodedBinaryString = atob(base64Str);
    let hexString = '';
    for (let i = 0; i < decodedBinaryString.length; i++) {
      const hex = decodedBinaryString.charCodeAt(i).toString(16);
      hexString += hex.length === 1 ? '0' + hex : hex;
    }
    return hexString;
  } catch (e) {
    console.error('Error decoding base64:', e);
    return null;
  }
}

const q = '{}';
let start = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 7;
let end = Math.floor(Date.now() / 1000);

const resSearch = await fetch(
  `http://localhost:3200/api/search?start=${start}&end=${end}&q=${encodeURIComponent(q)}&spss=1`,
  {
    method: 'GET', // GET also works with bodies, but ES docs use POST
    headers: { 'Content-Type': 'application/json' },
  }
);

let json = await resSearch.json();
console.log(inspect(json, { depth: 10, colors: true }));

const trace = json.traces[0];
console.log('Trace:', trace);

console.log('--------------------------------');

start = nanoSecondsToUnixEpoch(trace.startTimeUnixNano);
// Just do + 1 to get find the start span (the one without parentID)
end = start + 1;
const q1 = `{ trace:id = "${trace.traceID}" && nestedSetParent = -1 } | select (span:parentID)`;

const resTrace = await fetch(`http://localhost:3200/api/search?q=${encodeURIComponent(q1)}&start=${start}&end=${end}`, {
  method: 'GET', // GET also works with bodies, but ES docs use POST
  headers: { 'Content-Type': 'application/json' },
});

json = await resTrace.json();
console.log(inspect(json, { depth: 10, colors: true }));

console.log('--------------------------------');

const rootSpan = json.traces[0].spanSets
  .flatMap((ss) => ss.spans)
  .find((span) => {
    return span.attributes.some((a) => a.key === 'span:parentID' && a.value.stringValue === '0000000000000000');
  });

console.log('Root span:', rootSpan);

start = nanoSecondsToUnixEpoch(rootSpan.startTimeUnixNano);
end = start + nanoSecondsToUnixEpoch(rootSpan.durationNanos);
if (end === start) {
  end = start + 1;
}
console.log(start, end);

const q2 = `{ span:id = "${rootSpan.spanID}" }`;
const tagSearch = await fetch(
  `http://localhost:3200/api/v2/search/tags?q=${encodeURIComponent(q2)}&start=${start}&end=${end}`,
  {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  }
);

json = await tagSearch.json();
console.log(inspect(json, { depth: 10, colors: true }));

console.log('--------------------------------');

const tags = json.scopes.find((s) => s.name === 'span').tags;

// Get details could be fetched by the search tags
// { span:id = "9777756fa98d005e" } | select (span.child-span-attribute-xyz, span.foo, span.root-span-attribute-xyz, span.yozora)
const q3 = `{ span:id = "${rootSpan.spanID}" } | select (${tags.map((t) => `span.${t}`).join(', ')})`;
console.log(q3);
const spanDetails = await fetch(
  `http://localhost:3200/api/search?q=${encodeURIComponent(q3)}&start=${start}&end=${end}&spss=1`,
  {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  }
);

json = await spanDetails.json();
console.log(inspect(json, { depth: 10, colors: true }));

console.log('--------------------------------');

end = start + trace.durationMs;
const q4 = `{ span:parentID = "${rootSpan.spanID}" }`;
console.log(q4);
const children = await fetch(`http://localhost:3200/api/search?q=${encodeURIComponent(q4)}&start=${start}&end=${end}`, {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
});

json = await children.json();
console.log('children', inspect(json, { depth: 10, colors: true }));

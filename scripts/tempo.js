const q = '{ }';
const start = Math.floor(Date.now() / 1000) - 360000;
const end = Math.floor(Date.now() / 1000);

const resSearch = await fetch(`http://localhost:3200/api/search?start=${start}&end=${end}&q=${encodeURIComponent(q)}`, {
  method: 'GET', // GET also works with bodies, but ES docs use POST
  headers: { 'Content-Type': 'application/json' },
});

let json = await resSearch.json();
console.log(json, { depth: 10 });

const resTrace = await fetch(`http://localhost:3200/api/v2/traces/1cbf18d5d144aa4e7bdd24eed1413c4f`, {
  method: 'GET', // GET also works with bodies, but ES docs use POST
  headers: { 'Content-Type': 'application/json' },
});

json = await resTrace.json();
console.log(json, { depth: 10 });

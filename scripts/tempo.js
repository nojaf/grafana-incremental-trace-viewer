const q = '{ }';
const start = Math.floor(Date.now() / 1000) - 3600;
const end = Math.floor(Date.now() / 1000);

const res = await fetch(`http://localhost:3200/api/search?start=${start}&end=${end}&q=${encodeURIComponent(q)}`, {
  method: 'GET', // GET also works with bodies, but ES docs use POST
  headers: { 'Content-Type': 'application/json' },
});

const json = await res.json();
console.log(json);

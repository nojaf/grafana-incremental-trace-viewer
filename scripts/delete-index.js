const OS = process.env.OPENSEARCH_URL || 'http://localhost:9200';
const IDX = process.env.INDEX || 'ss4o_traces-default-namespace';

async function main() {
  console.log(`Deleting index ${IDX}…`);
  const res = await fetch(`${OS}/${IDX}`, { method: 'DELETE' });
  const j = await res.json();
  if (!res.ok) {
    console.error('❌ delete failed:', j);
    process.exit(1);
  }
  console.log('✔ index deleted:', j);
  console.log('Now re-run your collector (or your JS trace generator) and you’ll get real @timestamp!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

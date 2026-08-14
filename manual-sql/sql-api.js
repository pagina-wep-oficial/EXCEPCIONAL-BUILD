const TOKEN = process.env.DASH_TOKEN;
const QUERY = process.env.SQL_QUERY || "select 'ok' as ping;";
(async () => {
  const r = await fetch('https://api.supabase.com/v1/projects/scaebulgcuvqpucondws/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY })
  });
  const t = await r.text();
  console.log('STATUS ' + r.status);
  console.log(t.slice(0, 2000));
})().catch(e => console.log('ERR ' + e.message));
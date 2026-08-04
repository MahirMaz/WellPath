const BASE = 'http://localhost:3000/api';
const login = await (await fetch(`${BASE}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email:'maria@example.com', password:'password123' }) })).json();
if (!login.token) { console.log('LOGIN FAILED — is the backend running?', login); process.exit(1); }
const H = { 'Content-Type':'application/json', Authorization:`Bearer ${login.token}` };
const pid = login.user?.patientId ?? 2;
const n = Date.now();
const check = (label, answer, status) => {
  const bad = status !== 200 || !answer || String(answer).includes('having trouble');
  console.log(`${bad ? 'FAIL' : ' OK '}  ${label.padEnd(22)} ${bad ? '<-- ' + (answer||'HTTP '+status) : ''}`);
  return !bad;
};
let pass = 0, total = 0;
const call = async (label, body) => {
  total++;
  const res = await fetch(`${BASE}/ai/insights`, { method:'POST', headers:H, body: JSON.stringify({ patientId: pid, ...body }) });
  const d = await res.json().catch(()=>({}));
  if (check(label, d.answer, res.status)) pass++;
};

console.log('--- KPI cards ---');
for (const id of ['steps','sleep','heartRate','exercise','activeMinutes','sedentary','calories','bloodPressure'])
  await call('kpi:'+id, { insightType:'kpi', targetId:id, targetTitle:id, targetContext:{ main:'x', n, rows:[['7-day average','y']] } });

console.log('--- Score cards ---');
for (const id of ['wellpath','activity','consistency'])
  await call('score:'+id, { insightType:'score', targetId:id, targetTitle:id, targetContext:{ score:60, n, factors:[{label:'Sleep',score:40}] } });

console.log('--- Mood ---');
await call('mood', { insightType:'mood', targetId:'mood', targetTitle:'Mood', targetContext:{ n, averageMood:2.1, correlations:[{factor:'Sleep',r:0.5,strength:'clear'}] } });

console.log('--- Ask AI (prompt chip / general) ---');
total++;
{
  const res = await fetch(`${BASE}/ai/insights`, { method:'POST', headers:H, body: JSON.stringify({ patientId: pid, metricId:'sleep', promptId:'sleep_better' }) });
  const d = await res.json().catch(()=>({}));
  if (check('general(sleep)', d.answer, res.status)) pass++;
}

console.log(`\nRESULT: ${pass}/${total} AI sections working`);

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(root, 'dist');
const dataDir = join(root, 'data');
const dataFile = join(dataDir, 'app-data.json');
const port = Number(process.env.PORT || 5173);
let stateCache = null;
let saveQueue = Promise.resolve();

const defaultData = {
  'is-signed-in': false,
  'active-role': 'patient',
  'patient-screen': 'dashboard',
  'theme-mode': 'light',
  'completed-recommendations': [],
  'reviewed-alerts': [],
  'trainer-note': 'You are building a great routine. Consistency is the key this week.',
  'health-log': [
    { day: 'Wed', steps: 7200, sleep: 6.2, hr: 74, exercise: 35 },
    { day: 'Thu', steps: 6500, sleep: 5.7, hr: 76, exercise: 30 },
    { day: 'Fri', steps: 9100, sleep: 7.0, hr: 70, exercise: 55 },
    { day: 'Sat', steps: 8500, sleep: 6.6, hr: 73, exercise: 50 },
    { day: 'Sun', steps: 7600, sleep: 6.1, hr: 75, exercise: 40 },
    { day: 'Mon', steps: 9500, sleep: 6.8, hr: 71, exercise: 60 },
    { day: 'Tue', steps: 8700, sleep: 7.1, hr: 72, exercise: 45 }
  ],
  'health-goals': [
    { id: 1, title: 'Walk 10,000 steps at least 5 days this week', status: 'In progress' },
    { id: 2, title: 'Sleep 7 hours for the next 3 nights', status: 'In progress' },
    { id: 3, title: 'Complete three 45-minute workouts', status: 'Planned' },
    { id: 4, title: 'Review history signals every Friday', status: 'Planned' }
  ],
  'patient-records': [
    {
      id: 1,
      name: 'Alex Johnson',
      dob: '2002-04-12',
      gender: 'Male',
      email: 'alex@example.com',
      clinician: 'Dr. Rivera',
      trainer: 'Jordan Lee',
      consent: true,
      clinical: { systolic: 135, diastolic: 88, bmi: 26.2, restingHr: 72, notes: 'Sample baseline only', medications: 'None listed' },
      wearable: { steps: 8700, activeMinutes: 45, sleep: 7.1, calories: 2240, workouts: 4 },
      lifestyle: { exerciseFrequency: 4, dietaryScore: 7, stressLevel: 4, sedentaryHours: 6 },
      createdAt: '2026-05-27'
    }
  ]
};

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(dataFile)) {
    await writeFile(dataFile, JSON.stringify(defaultData, null, 2));
  }
}

async function readData() {
  await ensureDataFile();
  if (stateCache) return stateCache;
  const contents = await readFile(dataFile, 'utf8');
  stateCache = { ...defaultData, ...JSON.parse(contents) };
  return stateCache;
}

async function saveData(data) {
  await ensureDataFile();
  stateCache = data;
  saveQueue = saveQueue.then(() => writeFile(dataFile, JSON.stringify(data, null, 2)));
  await saveQueue;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleApi(req, res) {
  if (req.url === '/api/health') {
    sendJson(res, 200, { ok: true, storage: 'data/app-data.json' });
    return;
  }

  if (req.url === '/api/state' && req.method === 'GET') {
    sendJson(res, 200, await readData());
    return;
  }

  if (req.url === '/api/state' && req.method === 'PUT') {
    const body = JSON.parse(await readBody(req) || '{}');
    const current = await readData();
    const next = { ...current, ...body };
    await saveData(next);
    sendJson(res, 200, next);
    return;
  }

  sendJson(res, 404, { error: 'API route not found' });
}

function serveStatic(req, res) {
  const requestedPath = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(distDir, safePath);

  if (!filePath.startsWith(distDir) || !existsSync(filePath)) {
    filePath = join(distDir, 'index.html');
  }

  const type = contentTypes[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  createReadStream(filePath).pipe(res);
}

await ensureDataFile();

createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      await handleApi(req, res);
    } else {
      serveStatic(req, res);
    }
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`WellPath Health app running at http://127.0.0.1:${port}`);
  console.log('Data is saved in data/app-data.json');
});

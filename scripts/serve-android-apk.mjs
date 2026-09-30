// Local bench only. Exposes exactly the APK, never the workspace or credentials.
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const apk = fileURLToPath(new URL('../driver-app/android/app/build/outputs/apk/release/app-release.apk', import.meta.url));
if (!fs.existsSync(apk)) throw new Error('Compile o APK antes de iniciar o download local.');
const port = Number(process.env.APK_PORT || 8082);
http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method) || !['/', '/Empimecatronic.apk'].includes(req.url)) {
    res.writeHead(404); res.end(); return;
  }
  const stat = fs.statSync(apk);
  res.writeHead(200, {
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Length': stat.size,
    'Content-Disposition': 'attachment; filename="Empimecatronic.apk"',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = fs.createReadStream(apk);
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}).listen(port, '0.0.0.0', () => console.log(`APK de bancada: http://192.168.0.3:${port}/Empimecatronic.apk (mesma rede). Ctrl+C encerra.`));

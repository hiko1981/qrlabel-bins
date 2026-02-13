import net from 'node:net';
import { z } from 'zod';

const Args = z.object({
  ip: z.string().min(7),
  port: z.coerce.number().int().min(1).max(65535).default(9100),
  httpPort: z.coerce.number().int().min(1).max(65535).default(80),
});

async function sgd(ip: string, port: number, cmds: string[]) {
  const payload = cmds.map((c) => `! U1 ${c}\r\n`).join('');
  const resp = await tcpRoundtrip(ip, port, payload);
  return resp.replace(/\r/g, '').trim();
}

function tcpRoundtrip(host: string, port: number, data: string) {
  return new Promise<string>((resolve, reject) => {
    const socket = new net.Socket();
    let out = '';
    socket.setTimeout(2500);
    socket.once('error', reject);
    socket.once('timeout', () => {
      socket.destroy();
      resolve(out);
    });
    socket.connect(port, host, () => {
      socket.write(data, 'ascii', () => {
        setTimeout(() => socket.end(), 250);
      });
    });
    socket.on('data', (d) => (out += d.toString('utf8')));
    socket.once('close', () => resolve(out));
  });
}

async function main() {
  const argv = Object.fromEntries(
    process.argv
      .slice(2)
      .map((a) => a.split('='))
      .map(([k, v]) => [k?.replace(/^--/, ''), v ?? '']),
  );
  const { ip, port, httpPort } = Args.parse({ ip: argv.ip, port: argv.port, httpPort: argv.httpPort });

  const httpUrl = `http://${ip}:${httpPort}/`;
  let home = '';
  try {
    const r = await fetch(httpUrl, { signal: AbortSignal.timeout(2500) });
    home = await r.text();
  } catch {}

  const statusMatch = home.match(/Status:\s*<[^>]*>([^<]+)</i);
  const errorMatch = home.match(/ERROR CONDITION\s*([^<]+)</i);
  if (statusMatch) console.log(`HTTP status: ${statusMatch[1]!.trim()}`);
  if (errorMatch) console.log(`HTTP error: ${errorMatch[1]!.trim()}`);

  const vars = await sgd(ip, port, [
    'getvar "media.status"',
    'getvar "ezpl.media_type"',
    'getvar "ezpl.print_method"',
    'getvar "media.sense_mode"',
  ]).catch(() => '');

  if (vars) {
    // Response is usually quoted strings back-to-back
    const parts = vars.match(/\"[^\"]*\"/g)?.map((s) => s.slice(1, -1)) ?? [];
    const [mediaStatus, mediaType, printMethod, senseMode] = parts;
    if (mediaStatus) console.log(`SGD media.status: ${mediaStatus}`);
    if (mediaType) console.log(`SGD ezpl.media_type: ${mediaType}`);
    if (printMethod) console.log(`SGD ezpl.print_method: ${printMethod}`);
    if (senseMode) console.log(`SGD media.sense_mode: ${senseMode}`);
  }

  if ((errorMatch?.[1] ?? '').toLowerCase().includes('paper out')) {
    console.log('Hint: Printer thinks no media is present. Re-seat labels, close head, then run media calibration.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


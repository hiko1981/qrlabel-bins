import { spawn } from 'node:child_process';

async function waitFor(url: string, timeoutMs = 30_000) {
  const start = Date.now();
  while (true) {
    try {
      const res = await fetch(url);
      if (res.status >= 200 && res.status < 500) return;
    } catch {}
    if (Date.now() - start > timeoutMs) throw new Error(`Timeout waiting for ${url}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function main() {
  const port = Number(process.env.PORT ?? 3100);
  const base = `http://localhost:${port}`;

  const child = spawn('pnpm', ['exec', 'next', 'dev', '-p', String(port)], {
    stdio: 'inherit',
    env: process.env,
  });

  try {
    await waitFor(`${base}/labels/sample`, 60_000);
    const proc = spawn('pnpm', ['smoke:qr', `--base=${base}`], { stdio: 'inherit', env: process.env });
    const code = await new Promise<number>((resolve) => proc.on('exit', (c) => resolve(c ?? 1)));
    if (code !== 0) process.exit(code);
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

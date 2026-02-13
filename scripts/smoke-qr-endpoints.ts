type Check = {
  path: string;
  expectContentTypePrefix?: string;
  expectAttachment?: boolean;
  expectFilename?: string;
};

async function fetchHead(url: string) {
  const res = await fetch(url, { redirect: 'manual' });
  return res;
}

async function main() {
  const base = (process.argv.find((a) => a.startsWith('--base='))?.slice('--base='.length) ??
    process.env.SMOKE_BASE_URL ??
    'http://localhost:3000') as string;
  const token = (process.argv.find((a) => a.startsWith('--token='))?.slice('--token='.length) ??
    process.env.SMOKE_TOKEN ??
    'JcX5YxtiBOc8aYmP') as string;

  const checks: Check[] = [
    {
      path: `/api/qr/png?token=${encodeURIComponent(token)}`,
      expectContentTypePrefix: 'image/png',
      expectAttachment: true,
      expectFilename: `qrlabel-bin-${token}.png`,
    },
    {
      path: `/api/qr/svg?token=${encodeURIComponent(token)}`,
      expectContentTypePrefix: 'image/svg+xml',
      expectAttachment: true,
      expectFilename: `qrlabel-bin-${token}.svg`,
    },
    {
      path: `/api/qr/pdf?token=${encodeURIComponent(token)}`,
      expectContentTypePrefix: 'application/pdf',
      expectAttachment: true,
      expectFilename: `qrlabel-bin-${token}.pdf`,
    },
    {
      path: `/api/qr/bundle?token=${encodeURIComponent(token)}`,
      expectContentTypePrefix: 'application/zip',
      expectAttachment: true,
      expectFilename: `qrlabel-bin-${token}.zip`,
    },
    { path: `/label/${encodeURIComponent(token)}`, expectContentTypePrefix: 'text/html' },
    { path: `/labels/sample`, expectContentTypePrefix: 'text/html' },
  ];

  let failed = 0;
  for (const c of checks) {
    const url = new URL(c.path, base).toString();
    const res = await fetchHead(url);
    const ct = res.headers.get('content-type') ?? '';
    const cd = res.headers.get('content-disposition') ?? '';
    const okStatus = res.status === 200;
    const okCt = c.expectContentTypePrefix ? ct.startsWith(c.expectContentTypePrefix) : true;
    const okAttachment = c.expectAttachment ? cd.toLowerCase().includes('attachment') : true;
    const okFilename = c.expectFilename ? cd.includes(c.expectFilename) : true;

    if (!okStatus || !okCt || !okAttachment || !okFilename) {
      failed++;
      console.error(`FAIL ${res.status} ${url} ct=${ct} cd=${cd}`);
      continue;
    }
    console.log(`OK   ${res.status} ${url} ct=${ct}`);
  }

  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

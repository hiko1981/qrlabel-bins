export function mustGetEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getOptionalEnv(name: string) {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}


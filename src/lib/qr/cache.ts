export type CachedAsset = {
  contentType: string;
  body: Buffer;
};

const memory = new Map<string, { createdAt: number; asset: CachedAsset }>();

export function getFromMemory(key: string) {
  return memory.get(key)?.asset ?? null;
}

export function setInMemory(key: string, asset: CachedAsset) {
  memory.set(key, { createdAt: Date.now(), asset });
}

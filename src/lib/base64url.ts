export function toBase64Url(data: Uint8Array) {
  return Buffer.from(data).toString('base64url');
}

export function fromBase64Url(base64url: string) {
  return new Uint8Array(Buffer.from(base64url, 'base64url'));
}


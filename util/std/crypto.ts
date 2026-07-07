// Drop-in replacement for jsr:@std/crypto — WebCrypto with async-iterable digest support.

type DigestData =
  | BufferSource
  | AsyncIterable<BufferSource>
  | Iterable<BufferSource>;

async function collect(data: DigestData): Promise<Uint8Array> {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of data as AsyncIterable<BufferSource>) {
    const bytes =
      chunk instanceof ArrayBuffer
        ? new Uint8Array(chunk)
        : new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    chunks.push(bytes);
    total += bytes.length;
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

const subtle = {
  ...globalThis.crypto.subtle,
  async digest(algorithm: AlgorithmIdentifier, data: DigestData): Promise<ArrayBuffer> {
    const bytes = await collect(data);
    return await globalThis.crypto.subtle.digest(algorithm, bytes.buffer as ArrayBuffer);
  },
};

const stdCrypto = {
  getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
  randomUUID: globalThis.crypto.randomUUID.bind(globalThis.crypto),
  subtle,
};

export { stdCrypto as crypto };

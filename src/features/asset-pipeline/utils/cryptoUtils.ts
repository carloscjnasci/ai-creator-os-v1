/**
 * Computes a real SHA-256 lowercase hexadecimal hash of an ArrayBuffer
 * using the Web Crypto API.
 */
export async function computeSha256(arrayBuffer: ArrayBuffer): Promise<string> {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Web Crypto API is not available in the current environment.');
  }
  
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

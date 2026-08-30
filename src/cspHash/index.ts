import { Bytes } from "@sovereignbase/bytecodec";

export const cspHash = async (source: string): Promise<`sha256-${string}`> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    Bytes.fromString(source) as BufferSource,
  );

  return `sha256-${Bytes.toBase64String(digest)}`;
};

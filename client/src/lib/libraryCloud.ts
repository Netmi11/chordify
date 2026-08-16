export type CloudLibraryKey = { libraryId: string; secret: string };

const CLOUD_LIBRARY_KEY = "chordshift-cloud-library-v1";

function randomSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateCloudLibraryKey(storage: Pick<Storage, "getItem" | "setItem">): CloudLibraryKey {
  const raw = storage.getItem(CLOUD_LIBRARY_KEY);
  try {
    const parsed = raw ? JSON.parse(raw) as Partial<CloudLibraryKey> : null;
    if (parsed && typeof parsed.libraryId === "string" && typeof parsed.secret === "string" && parsed.secret.length >= 32) {
      return { libraryId: parsed.libraryId, secret: parsed.secret };
    }
  } catch {
    // Replace invalid data with a new private key.
  }
  const next = { libraryId: crypto.randomUUID(), secret: randomSecret() };
  storage.setItem(CLOUD_LIBRARY_KEY, JSON.stringify(next));
  return next;
}

export function setCloudLibraryKey(storage: Pick<Storage, "setItem">, key: CloudLibraryKey) {
  storage.setItem(CLOUD_LIBRARY_KEY, JSON.stringify(key));
}

export function formatCloudRecoveryCode(key: CloudLibraryKey) {
  return `${key.libraryId}.${key.secret}`;
}

export function parseCloudRecoveryCode(raw: string): CloudLibraryKey | null {
  const [libraryId, secret, ...rest] = raw.trim().split(".");
  if (rest.length || !libraryId || !secret || !/^[0-9a-f-]{36}$/i.test(libraryId) || !/^[0-9a-f]{64}$/i.test(secret)) return null;
  return { libraryId, secret };
}

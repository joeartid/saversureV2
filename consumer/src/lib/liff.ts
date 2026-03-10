import type { Liff } from "@line/liff";

let liffInstance: Liff | null = null;
let initPromise: Promise<Liff> | null = null;

export async function initLiff(liffId: string): Promise<Liff> {
  if (liffInstance) return liffInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const liff = (await import("@line/liff")).default;
    await liff.init({ liffId });
    liffInstance = liff;
    return liff;
  })();

  return initPromise;
}

export function getLiff(): Liff | null {
  return liffInstance;
}

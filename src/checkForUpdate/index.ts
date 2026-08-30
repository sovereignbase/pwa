const checkIntervalMilliseconds = 60_000
let lastVersionCheck = 0

/** Checks the deployed build marker at most once per interval. */
export async function checkForUpdate(
  worker: ServiceWorkerGlobalScope,
  buildIdUrl: string,
  buildId: string
): Promise<void> {
  const now = Date.now()
  if (now - lastVersionCheck < checkIntervalMilliseconds) return
  lastVersionCheck = now

  try {
    const response = await fetch(buildIdUrl, { cache: 'no-store' })
    if (!response.ok || (await response.text()).trim() === buildId) return

    await worker.registration.update()
  } catch {
    // Offline update checks must not prevent cached responses.
  }
}

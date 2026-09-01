/** Checks the deployed build marker after an application navigation. */
export async function checkForUpdate(
  worker: ServiceWorkerGlobalScope,
  buildIdUrl: string,
  buildId: string
): Promise<void> {
  try {
    const response = await fetch(buildIdUrl, { cache: 'no-store' })
    if (!response.ok || (await response.text()).trim() === buildId) return

    await worker.registration.update()
  } catch {
    // Offline update checks must not prevent cached responses.
  }
}

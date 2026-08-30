/** Checks the deployed build marker and asks the browser to update on change. */
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
    // Initialization must remain usable when the deployment is offline.
  }
}

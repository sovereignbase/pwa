import { build, initialize } from "esbuild";
import {
  FileHandle,
  readFile,
  writeFile,
  mkdtempDisposable,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import contentMinifierPlugin from "../scripts/plugins/contentMinifierPlugin.js";
import type { PathLike } from "node:fs";

export async function pwaize(config: PWAizeConfig) {
  await using temp = await mkdtempDisposable(join(tmpdir(), "pwaize-"));

  const buildId = crypto.randomUUID();

  await writeFile(
    join(config.outDir.toString(), "web/pwaize-build-id.txt"),
    buildId,
  );

  const entrypoint = (
    await build({
      entryPoints: [config.entrypoint.toString()],
      write: false,
      bundle: true,
      minify: true,
      treeShaking: true,
      plugins: [contentMinifierPlugin()],
    })
  ).outputFiles[0].text;

  const serviceWorkerPath = join(temp.path, "sw.js");

  await build({
    entryPoints: ["./src/serviceWorker/entrypoint.js"],
    outfile: serviceWorkerPath,
    bundle: true,
    minify: true,
    treeShaking: true,
    define: {
      customInitialize:
        typeof config.serviceWorker?.initialize === "function" ?
          config.serviceWorker.initialize.toString()
        : "undefined",
      customWaitUntil:
        typeof config.serviceWorker?.waitUntil === "function" ?
          config.serviceWorker.waitUntil.toString()
        : "undefined",
      entrypoint: JSON.stringify(entrypoint),
      buildId: JSON.stringify(buildId),
    },
    plugins: [contentMinifierPlugin()],
  });

  const serviceWorker = await readFile(serviceWorkerPath, "utf8");

  const collapsed = serviceWorker.replace(/[\r\n]+/g, "");

  await writeFile(
    join(config.outDir.toString(), "web/ServiceWorker"),
    collapsed,
  );
}

export type PWAizeConfig = {
  /** Stylesheet included in the generated PWA. */
  stylesheet: PathLike | FileHandle;

  /** Application entrypoint included in the generated PWA. */
  entrypoint: PathLike | FileHandle;

  /** Directory where the generated PWA files are written. */
  outDir: PathLike | FileHandle;

  /** Service Worker startup behavior. */
  serviceWorker?: {
    /**
     * Runs synchronously at the top level whenever the Service Worker starts.
     *
     * Use for immediate initialization that must complete as part of evaluating
     * the Service Worker script.
     */
    initialize?: () => void;

    /**
     * Runs asynchronously in the background whenever the Service Worker starts.
     *
     * The returned Promise is passed to `waitUntil` before the Service Worker
     * responds, extending its lifetime until the work completes without
     * delaying the response itself.
     *
     * Use for startup work that must be allowed to finish but does not need to
     * block the Service Worker's response.
     */
    waitUntil?: () => Promise<void>;
  };
};

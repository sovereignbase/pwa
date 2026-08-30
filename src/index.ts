import { build, initialize } from "esbuild";
import {
  FileHandle,
  readFile,
  writeFile,
  mkdtempDisposable,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PathLike } from "node:fs";
import { BCP47LanguageTag } from "@sovereignbase/utils";

import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { minify } from "terser";

/** @returns {import('esbuild').Plugin} */
const terser = {
  name: "terser",

  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length) return;

      const source = await readFile(outfile, "utf8");
      const output = await minify(source, {
        compress: {
          passes: 3,
        },
        mangle: true,
        module: true,
      });
    });
  },
};

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
  defaultLanguage: BCP47LanguageTag;
  canonicalLanguage: BCP47LanguageTag;
  alterantiveLanguages: Array<BCP47LanguageTag>;

  /** Stylesheet included in the generated PWA. */
  stylesheet: string;

  /** Application entrypoint included in the generated PWA. */
  entrypoint: string;

  /** Directory where the generated PWA files are written. */
  outDir: PathLike | FileHandle;

  /** Copied in to outDir root, referencable in code by relative url `/${dirName}*` */
  assetsDir?: PathLike | FileHandle;
  /** Bundled in to outDir with splitting referencable in code by relative url `/${dirName}*` */
  i18nDir?: PathLike | FileHandle;

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

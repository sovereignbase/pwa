import { existsSync, statSync, type PathLike } from 'node:fs'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
import type { BCP47LanguageTag } from '@sovereignbase/utils'

/** Android-specific Trusted Web Activity distribution settings. */
export type AndroidDistributionOptions = {
  /** Android SDK root; requires `jdkPath` to compile binaries. */
  androidSdkPath?: PathLike
  /** Restricts installation to ChromeOS devices. */
  chromeOSOnly?: boolean
  /** Enables notification delegation for the TWA. */
  enableNotifications?: boolean
  /** JDK root; requires `androidSdkPath` to compile binaries. */
  jdkPath?: PathLike
  /** Upload-key alias. Defaults to `upload`. */
  keyAlias?: string
  /** Upload keystore path. Passwords are read only from the environment. */
  keystore?: PathLike
  /** Generates a Meta Quest compatible Android project. */
  metaQuest?: boolean
  /** Minimum supported Android API level. */
  minSdkVersion?: number
  /** Android application ID. Defaults to the shared distribution ID. */
  package?: string
  /** SHA-256 certificate fingerprints written to Digital Asset Links. */
  sha256CertFingerprints?: string[]
}

/** Shared application release metadata and optional distribution targets. */
export type DistributionOptions = {
  /** Enables Android output when defined. */
  android?: AndroidDistributionOptions
  /** Monotonically increasing platform build number. */
  build: number
  /** Stable reverse-domain application identifier. */
  id: string
  /** User-visible semantic application version. */
  version: string
}

type BuildAndroidDistributionOptions = {
  android: AndroidDistributionOptions
  defaultLanguage: BCP47LanguageTag
  distribution: DistributionOptions
  origin: string
  outDirectory: string
  webDirectory: string
}

/** Generates an Android TWA project and, when configured, APK and AAB files. */
export async function buildAndroidDistribution(
  options: BuildAndroidDistributionOptions
): Promise<void> {
  const {
    AndroidSdkTools,
    Config,
    DigitalAssetLinks,
    fetchUtils,
    GradleWrapper,
    JarSigner,
    JdkHelper,
    MockLog,
    TwaGenerator,
    TwaManifest,
  } = await import('@bubblewrap/core')
  const { android, distribution, outDirectory, webDirectory } = options
  const manifestUrl = new URL(
    `/${options.defaultLanguage}/manifest.webmanifest`,
    options.origin
  )
  const webManifest = JSON.parse(
    await readFile(
      join(webDirectory, options.defaultLanguage, 'manifest.webmanifest'),
      'utf8'
    )
  )
  const twaManifest = TwaManifest.fromWebManifestJson(manifestUrl, webManifest)

  twaManifest.appVersionCode = distribution.build
  twaManifest.appVersionName = distribution.version
  twaManifest.enableNotifications = android.enableNotifications ?? false
  twaManifest.fingerprints = (android.sha256CertFingerprints ?? []).map(
    (value) => ({ value })
  )
  twaManifest.generatorApp = '@sovereignbase/pwa'
  twaManifest.isChromeOSOnly = android.chromeOSOnly ?? false
  twaManifest.isMetaQuest = android.metaQuest ?? false
  twaManifest.minSdkVersion =
    android.minSdkVersion ?? (android.metaQuest ? 23 : 21)
  twaManifest.packageId = android.package ?? distribution.id
  twaManifest.signingKey = {
    alias: android.keyAlias ?? 'upload',
    path: android.keystore?.toString() ?? '',
  }

  const validationError = twaManifest.validate()
  if (validationError !== null) {
    throw new Error(`Invalid Android distribution: ${validationError}`)
  }

  const androidDirectory = join(outDirectory, 'android')
  const projectDirectory = join(androidDirectory, 'project')
  const generator = new TwaGenerator()
  await mkdir(projectDirectory, { recursive: true })
  await generator.removeTwaProject(projectDirectory)
  await twaManifest.saveToFile(join(projectDirectory, 'twa-manifest.json'))
  const remoteFetch = fetchUtils.fetch
  fetchUtils.fetch = async (input) => {
    const url = new URL(input)
    if (url.origin === new URL(options.origin).origin) {
      const file = resolve(webDirectory, `.${decodeURIComponent(url.pathname)}`)
      const pathFromWebRoot = relative(webDirectory, file)
      if (
        pathFromWebRoot !== '' &&
        !pathFromWebRoot.startsWith('..') &&
        existsSync(file) &&
        statSync(file).isFile()
      ) {
        const body = await readFile(file)
        return new Response(body, {
          headers: { 'content-type': contentType(file) },
          status: 200,
        }) as never
      }
    }
    return remoteFetch.call(fetchUtils, input)
  }
  try {
    await generator.createTwaProject(
      projectDirectory,
      twaManifest,
      new MockLog()
    )
  } finally {
    fetchUtils.fetch = remoteFetch
  }

  const fingerprints = android.sha256CertFingerprints ?? []
  if (fingerprints.length > 0) {
    const assetLinksDirectory = join(webDirectory, '.well-known')
    await mkdir(assetLinksDirectory, { recursive: true })
    await writeFile(
      join(assetLinksDirectory, 'assetlinks.json'),
      DigitalAssetLinks.generateAssetLinks(
        twaManifest.packageId,
        ...fingerprints
      )
    )
  }

  if (android.androidSdkPath === undefined || android.jdkPath === undefined) {
    return
  }

  const config = new Config(
    android.jdkPath.toString(),
    android.androidSdkPath.toString()
  )
  const jdk = new JdkHelper(process, config)
  const sdk = await AndroidSdkTools.create(process, config, jdk, new MockLog())
  if (!(await sdk.checkBuildTools())) {
    await sdk.installBuildTools()
  }
  const gradle = new GradleWrapper(process, sdk, projectDirectory)
  await Promise.all([gradle.assembleRelease(), gradle.bundleRelease()])

  const unsignedApk = join(
    projectDirectory,
    'app',
    'build',
    'outputs',
    'apk',
    'release',
    'app-release-unsigned.apk'
  )
  const unsignedBundle = join(
    projectDirectory,
    'app',
    'build',
    'outputs',
    'bundle',
    'release',
    'app-release.aab'
  )

  if (android.keystore === undefined) {
    await Promise.all([
      cp(unsignedApk, join(androidDirectory, 'app-release-unsigned.apk')),
      cp(unsignedBundle, join(androidDirectory, 'app-release-unsigned.aab')),
    ])
    return
  }

  const keyPassword = process.env.ANDROID_KEY_PASSWORD
  const storePassword = process.env.ANDROID_KEYSTORE_PASSWORD
  if (keyPassword === undefined || storePassword === undefined) {
    throw new Error(
      'Android signing requires ANDROID_KEYSTORE_PASSWORD and ANDROID_KEY_PASSWORD'
    )
  }
  const alignedApk = join(androidDirectory, 'app-release-aligned.apk')
  const signedApk = join(androidDirectory, 'app-release-signed.apk')
  const signedBundle = join(androidDirectory, 'app-release-signed.aab')
  const signingKey = android.keystore.toString()
  const signingKeyAlias = android.keyAlias ?? 'upload'
  await sdk.zipalign(unsignedApk, alignedApk)
  await Promise.all([
    sdk.apksigner(
      signingKey,
      storePassword,
      signingKeyAlias,
      keyPassword,
      alignedApk,
      signedApk
    ),
    new JarSigner(jdk).sign(
      { alias: signingKeyAlias, path: signingKey },
      storePassword,
      keyPassword,
      unsignedBundle,
      signedBundle
    ),
  ])
}

/** Returns the media type Bubblewrap needs while reading generated files. */
function contentType(file: string): string {
  switch (extname(file).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.svg':
      return 'image/svg+xml'
    case '.webp':
      return 'image/webp'
    case '.webmanifest':
      return 'application/manifest+json'
    default:
      return 'application/octet-stream'
  }
}

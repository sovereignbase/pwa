import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAndroidDistribution } from '../../src/distribution/android/index.js'

const { androidSdk, bubblewrap, fetchUtils } = vi.hoisted(() => {
  const bubblewrap = {
    apksigner: vi.fn(async () => undefined),
    assembleRelease: vi.fn(async () => undefined),
    bundleRelease: vi.fn(async () => undefined),
    checkBuildTools: vi.fn(async () => true),
    createProject: vi.fn(async () => undefined),
    fromWebManifestJson: vi.fn(),
    generateAssetLinks: vi.fn((packageId: string, ...fingerprints: string[]) =>
      JSON.stringify([{ packageId, fingerprints }])
    ),
    installBuildTools: vi.fn(async () => undefined),
    removeProject: vi.fn(async () => undefined),
    remoteFetch: vi.fn(
      async (_input: string) => new Response(null, { status: 404 })
    ),
    saveManifest: vi.fn(async () => undefined),
    signBundle: vi.fn(async () => undefined),
    zipalign: vi.fn(async () => undefined),
  }
  return {
    androidSdk: {
      apksigner: bubblewrap.apksigner,
      checkBuildTools: bubblewrap.checkBuildTools,
      installBuildTools: bubblewrap.installBuildTools,
      zipalign: bubblewrap.zipalign,
    },
    bubblewrap,
    fetchUtils: { fetch: bubblewrap.remoteFetch },
  }
})

vi.mock('@bubblewrap/core', () => ({
  AndroidSdkTools: { create: vi.fn(async () => androidSdk) },
  Config: class Config {},
  DigitalAssetLinks: { generateAssetLinks: bubblewrap.generateAssetLinks },
  fetchUtils,
  GradleWrapper: class GradleWrapper {
    assembleRelease = bubblewrap.assembleRelease
    bundleRelease = bubblewrap.bundleRelease
  },
  JarSigner: class JarSigner {
    sign = bubblewrap.signBundle
  },
  JdkHelper: class JdkHelper {},
  MockLog: class MockLog {},
  TwaGenerator: class TwaGenerator {
    createTwaProject = bubblewrap.createProject
    removeTwaProject = bubblewrap.removeProject
  },
  TwaManifest: { fromWebManifestJson: bubblewrap.fromWebManifestJson },
}))

describe('Android distribution', () => {
  afterEach(() => vi.unstubAllEnvs())

  beforeEach(() => {
    vi.clearAllMocks()
    bubblewrap.checkBuildTools.mockResolvedValue(true)
    bubblewrap.fromWebManifestJson.mockReturnValue(twaManifest())
  })

  it('generates only the project without complete binary toolchain paths', async () => {
    const paths = await projectPaths()
    await buildAndroidDistribution({
      android: { androidSdkPath: 'android-sdk' },
      defaultLanguage: 'en',
      distribution: {
        android: {},
        build: 7,
        id: 'dev.example',
        version: '1.2.3',
      },
      origin: 'https://example.test',
      ...paths,
    })

    const manifest = bubblewrap.fromWebManifestJson.mock.results[0].value
    expect(manifest).toMatchObject({
      appVersionCode: 7,
      appVersionName: '1.2.3',
      enableNotifications: false,
      fingerprints: [],
      generatorApp: '@sovereignbase/pwa',
      isChromeOSOnly: false,
      isMetaQuest: false,
      minSdkVersion: 21,
      packageId: 'dev.example',
    })
    expect(bubblewrap.createProject).toHaveBeenCalledOnce()
    expect(bubblewrap.assembleRelease).not.toHaveBeenCalled()

    const defaultPaths = await projectPaths()
    await buildAndroidDistribution({
      android: { metaQuest: true },
      defaultLanguage: 'en',
      distribution: {
        android: {},
        build: 7,
        id: 'dev.example',
        version: '1.2.3',
      },
      origin: 'https://example.test',
      ...defaultPaths,
    })
    expect(bubblewrap.fromWebManifestJson.mock.results[1].value).toMatchObject({
      isMetaQuest: true,
      minSdkVersion: 23,
    })
  })

  it('writes asset links and builds unsigned APK and AAB outputs', async () => {
    const paths = await projectPaths()
    await rawBinaries(paths.outDirectory)
    bubblewrap.checkBuildTools.mockResolvedValue(false)

    await buildAndroidDistribution({
      android: {
        androidSdkPath: 'android-sdk',
        chromeOSOnly: true,
        enableNotifications: true,
        jdkPath: 'jdk',
        metaQuest: true,
        minSdkVersion: 26,
        package: 'dev.example.android',
        sha256CertFingerprints: ['AA:BB'],
      },
      defaultLanguage: 'en',
      distribution: {
        android: {},
        build: 8,
        id: 'dev.example',
        version: '2.0.0',
      },
      origin: 'https://example.test',
      ...paths,
    })

    expect(bubblewrap.installBuildTools).toHaveBeenCalledOnce()
    expect(bubblewrap.assembleRelease).toHaveBeenCalledOnce()
    expect(bubblewrap.bundleRelease).toHaveBeenCalledOnce()
    expect(
      await readFile(
        join(paths.outDirectory, 'android', 'app-release-unsigned.apk'),
        'utf8'
      )
    ).toBe('apk')
    expect(
      await readFile(
        join(paths.outDirectory, 'android', 'app-release-unsigned.aab'),
        'utf8'
      )
    ).toBe('aab')
    expect(
      JSON.parse(
        await readFile(
          join(paths.webDirectory, '.well-known', 'assetlinks.json'),
          'utf8'
        )
      )
    ).toEqual([{ fingerprints: ['AA:BB'], packageId: 'dev.example.android' }])
  })

  it('serves generated manifests and icons to Bubblewrap locally', async () => {
    const paths = await projectPaths()
    const assets = join(paths.webDirectory, 'assets')
    await mkdir(assets, { recursive: true })
    for (const file of [
      'icon.jpeg',
      'icon.jpg',
      'icon.png',
      'icon.svg',
      'icon.webp',
      'icon.unknown',
    ]) {
      await writeFile(join(assets, file), file)
    }
    const responses: Array<[number, string | null, string]> = []
    bubblewrap.createProject.mockImplementationOnce(async () => {
      for (const path of [
        '/en/manifest.webmanifest',
        '/assets/icon.jpeg',
        '/assets/icon.jpg',
        '/assets/icon.png',
        '/assets/icon.svg',
        '/assets/icon.webp',
        '/assets/icon.unknown',
      ]) {
        const response = await fetchUtils.fetch(`https://example.test${path}`)
        responses.push([
          response.status,
          response.headers.get('content-type'),
          await response.text(),
        ])
      }
      await fetchUtils.fetch('https://different.test/icon.png')
      await fetchUtils.fetch('https://example.test/')
      await fetchUtils.fetch('https://example.test/%2e%2e%2fsecret')
      await fetchUtils.fetch('https://example.test/missing.png')
      await fetchUtils.fetch('https://example.test/assets')
    })

    await buildAndroidDistribution({
      android: {},
      defaultLanguage: 'en',
      distribution: { android: {}, build: 1, id: 'dev.example', version: '1' },
      origin: 'https://example.test',
      ...paths,
    })

    expect(responses.map(([status]) => status)).toEqual(Array(7).fill(200))
    expect(responses.map(([, type]) => type)).toEqual([
      'application/manifest+json',
      'image/jpeg',
      'image/jpeg',
      'image/png',
      'image/svg+xml',
      'image/webp',
      'application/octet-stream',
    ])
    expect(responses[1][2]).toBe('icon.jpeg')
    expect(bubblewrap.remoteFetch).toHaveBeenCalledTimes(5)
    expect(fetchUtils.fetch).toBe(bubblewrap.remoteFetch)
  })

  it('signs APK and AAB outputs with Bubblewrap environment secrets', async () => {
    const paths = await projectPaths()
    await rawBinaries(paths.outDirectory)
    vi.stubEnv('ANDROID_KEYSTORE_PASSWORD', 'store-password')
    vi.stubEnv('ANDROID_KEY_PASSWORD', 'key-password')

    await buildAndroidDistribution({
      android: {
        androidSdkPath: 'android-sdk',
        jdkPath: 'jdk',
        keystore: 'release.keystore',
      },
      defaultLanguage: 'en',
      distribution: {
        android: {},
        build: 9,
        id: 'dev.example',
        version: '3.0.0',
      },
      origin: 'https://example.test',
      ...paths,
    })

    expect(bubblewrap.zipalign).toHaveBeenCalledOnce()
    expect(bubblewrap.apksigner).toHaveBeenCalledWith(
      'release.keystore',
      'store-password',
      'upload',
      'key-password',
      expect.any(String),
      expect.any(String)
    )
    expect(bubblewrap.signBundle).toHaveBeenCalledOnce()
  })

  it('rejects invalid manifests and missing signing secrets', async () => {
    const invalidPaths = await projectPaths()
    bubblewrap.fromWebManifestJson.mockReturnValueOnce(
      twaManifest('iconUrl cannot be empty')
    )
    await expect(
      buildAndroidDistribution({
        android: {},
        defaultLanguage: 'en',
        distribution: {
          android: {},
          build: 1,
          id: 'dev.example',
          version: '1',
        },
        origin: 'https://example.test',
        ...invalidPaths,
      })
    ).rejects.toThrow('Invalid Android distribution: iconUrl cannot be empty')

    const signingPaths = await projectPaths()
    await rawBinaries(signingPaths.outDirectory)
    await expect(
      buildAndroidDistribution({
        android: {
          androidSdkPath: 'android-sdk',
          jdkPath: 'jdk',
          keystore: 'release.keystore',
        },
        defaultLanguage: 'en',
        distribution: {
          android: {},
          build: 1,
          id: 'dev.example',
          version: '1',
        },
        origin: 'https://example.test',
        ...signingPaths,
      })
    ).rejects.toThrow('Android signing requires')
  })
})

async function projectPaths(): Promise<{
  outDirectory: string
  webDirectory: string
}> {
  const outDirectory = await mkdtemp(join(tmpdir(), 'pwa-android-'))
  const webDirectory = join(outDirectory, 'web')
  await mkdir(join(webDirectory, 'en'), { recursive: true })
  await writeFile(
    join(webDirectory, 'en', 'manifest.webmanifest'),
    JSON.stringify({ name: 'Example' })
  )
  return { outDirectory, webDirectory }
}

async function rawBinaries(outDirectory: string): Promise<void> {
  const release = join(
    outDirectory,
    'android',
    'project',
    'app',
    'build',
    'outputs'
  )
  await mkdir(join(release, 'apk', 'release'), { recursive: true })
  await mkdir(join(release, 'bundle', 'release'), { recursive: true })
  await writeFile(
    join(release, 'apk', 'release', 'app-release-unsigned.apk'),
    'apk'
  )
  await writeFile(join(release, 'bundle', 'release', 'app-release.aab'), 'aab')
}

function twaManifest(validationError: string | null = null) {
  return {
    enableNotifications: false,
    fingerprints: [],
    isChromeOSOnly: false,
    isMetaQuest: false,
    minSdkVersion: 21,
    packageId: '',
    saveToFile: bubblewrap.saveManifest,
    signingKey: { alias: '', path: '' },
    validate: () => validationError,
  }
}

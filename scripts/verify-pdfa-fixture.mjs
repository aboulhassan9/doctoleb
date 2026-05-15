import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { get } from 'node:https';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFHexString, PDFName, PDFString, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { attachPdfA2bMetadata } from '../supabase/functions/render-clinical-document/pdfA.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const cacheDir = resolve(root, '.cache', 'verapdf');
const installDir = resolve(cacheDir, 'install');
const fixturePath = resolve(root, '.cache', 'clinical-referral-pdfa-fixture.pdf');
const veraPdfVersion = '1.30.1';
const veraPdfInstallerZip = 'https://software.verapdf.org/releases/verapdf-installer.zip';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    shell: false,
  });
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed${details ? `\n${details}` : ''}`);
  }
  return result;
}

function download(url, target) {
  return new Promise((resolveDownload, reject) => {
    const file = createWriteStream(target);
    get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${url} returned ${response.statusCode}`));
        response.resume();
        return;
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolveDownload));
    }).on('error', reject);
  });
}

function findFile(dir, predicate) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = run(
      process.platform === 'win32' ? 'powershell.exe' : 'find',
      process.platform === 'win32'
        ? ['-NoProfile', '-Command', `Get-ChildItem -Force -LiteralPath '${current.replaceAll("'", "''")}' | ForEach-Object { $_.FullName }`]
        : [current, '-maxdepth', '1', '-mindepth', '1', '-print'],
    ).stdout.split(/\r?\n/).filter(Boolean);

    for (const entry of entries) {
      if (predicate(entry)) return entry;
      const isDirectory = process.platform === 'win32'
        ? run('powershell.exe', ['-NoProfile', '-Command', `(Get-Item -LiteralPath '${entry.replaceAll("'", "''")}').PSIsContainer`]).stdout.trim() === 'True'
        : spawnSync('test', ['-d', entry]).status === 0;
      if (isDirectory) stack.push(entry);
    }
  }
  return null;
}

async function ensureVeraPdf() {
  if (process.env.VERAPDF_BIN) return process.env.VERAPDF_BIN;

  const binName = process.platform === 'win32' ? 'verapdf.bat' : 'verapdf';
  const cachedBin = join(installDir, binName);
  if (existsSync(cachedBin)) return cachedBin;

  mkdirSync(cacheDir, { recursive: true });
  const zipPath = join(cacheDir, basename(veraPdfInstallerZip));
  if (!existsSync(zipPath)) {
    console.log(`[pdfa] downloading veraPDF ${veraPdfVersion}`);
    await download(veraPdfInstallerZip, zipPath);
  }

  const extractedDir = join(cacheDir, 'installer');
  mkdirSync(extractedDir, { recursive: true });
  if (process.platform === 'win32') {
    run('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Force -LiteralPath '${zipPath.replaceAll("'", "''")}' -DestinationPath '${extractedDir.replaceAll("'", "''")}'`,
    ]);
  } else {
    run('unzip', ['-q', '-o', zipPath, '-d', extractedDir]);
  }

  const installerJar = findFile(
    extractedDir,
    (entry) => /verapdf-izpack-installer-.*\.jar$/i.test(entry),
  );
  if (!installerJar) {
    throw new Error('veraPDF installer jar not found after extracting installer zip.');
  }

  const installXml = join(cacheDir, 'auto-install.xml');
  writeFileSync(installXml, `<?xml version="1.0" encoding="UTF-8"?>
<AutomatedInstallation langpack="eng">
  <com.izforge.izpack.panels.htmlhello.HTMLHelloPanel id="welcome"/>
  <com.izforge.izpack.panels.target.TargetPanel id="install_dir">
    <installpath>${installDir}</installpath>
  </com.izforge.izpack.panels.target.TargetPanel>
  <com.izforge.izpack.panels.packs.PacksPanel id="sdk_pack_select">
    <pack index="0" name="veraPDF GUI" selected="false"/>
    <pack index="1" name="veraPDF CLI" selected="true"/>
    <pack index="2" name="veraPDF Documentation" selected="false"/>
  </com.izforge.izpack.panels.packs.PacksPanel>
  <com.izforge.izpack.panels.install.InstallPanel id="install"/>
  <com.izforge.izpack.panels.finish.FinishPanel id="finish"/>
</AutomatedInstallation>
`);

  run('java', ['-jar', installerJar, installXml], { stdio: 'inherit' });
  if (!existsSync(cachedBin)) {
    throw new Error(`veraPDF install completed but ${cachedBin} was not found.`);
  }
  return cachedBin;
}

async function writeReferralFixture() {
  mkdirSync(dirname(fixturePath), { recursive: true });

  const assetsDir = resolve(root, 'supabase/functions/render-clinical-document/assets');
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const [regular, bold] = await Promise.all([
    pdf.embedFont(readFileSync(resolve(assetsDir, 'NotoSans-Regular.ttf')), { subset: true }),
    pdf.embedFont(readFileSync(resolve(assetsDir, 'NotoSans-Bold.ttf')), { subset: true }),
  ]);

  const title = 'Medical Referral for Patient';
  const subject = 'Medical Referral';
  const metadataDate = new Date('2026-05-15T09:00:00Z');
  attachPdfA2bMetadata(
    pdf,
    { PDFName, PDFString, PDFHexString },
    {
      title,
      author: 'Heart Care Clinic',
      subject,
      producer: 'DoctoLeb / pdf-lib 1.17.1',
      creator: 'DoctoLeb render-clinical-document v1.0.0',
      createdAt: metadataDate,
      modifiedAt: metadataDate,
      keywords: ['clinical', subject, 'heart-care'],
      language: 'en',
      stableFileId: '11111111-1111-4111-8111-111111111111:pdfa-fixture',
      iccProfile: readFileSync(resolve(assetsDir, 'sRGB.icc')),
    },
  );

  const page = pdf.addPage([595, 842]);
  page.drawText(title, {
    x: 60,
    y: 750,
    size: 16,
    font: bold,
    color: rgb(15 / 255, 23 / 255, 42 / 255),
  });
  page.drawText('Referral reason: cardiology review requested.', {
    x: 60,
    y: 720,
    size: 11,
    font: regular,
    color: rgb(15 / 255, 23 / 255, 42 / 255),
  });

  writeFileSync(fixturePath, await pdf.save({ useObjectStreams: false }));
  return fixturePath;
}

const verapdf = await ensureVeraPdf();
const fixture = await writeReferralFixture();
const verapdfArgs = ['--format', 'text', '--flavour', '2b', fixture];
const result = process.platform === 'win32'
  ? spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `& '${verapdf.replaceAll("'", "''")}' ${verapdfArgs.map((arg) => `'${arg.replaceAll("'", "''")}'`).join(' ')}`,
    ],
    { cwd: root, encoding: 'utf8' },
  )
  : spawnSync(verapdf, verapdfArgs, { cwd: root, encoding: 'utf8' });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  throw new Error('Referral fixture failed veraPDF PDF/A-2b validation.');
}

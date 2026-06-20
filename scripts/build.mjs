import { rm, mkdir, copyFile, stat, writeFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const root = resolve('.');
const dist = join(root, 'dist');
const entries = [
  'index.html',
  'public/app.js',
  'public/styles.css',
  'public/data/ismsp-defect-bank.json',
  'public/data/wrongnote-graph.json',
  'public/data/criteria-similarity.json',
  'src/i18n.js',
  'src/core/quizEngine.js',
  'src/platform/adapters.js',
];

async function copyTree(sourceDir, targetDir) {
  const items = await readdir(sourceDir, { withFileTypes: true });
  await mkdir(targetDir, { recursive: true });
  for (const item of items) {
    const sourcePath = join(sourceDir, item.name);
    const targetPath = join(targetDir, item.name);
    if (item.isDirectory()) {
      await copyTree(sourcePath, targetPath);
    } else if (item.isFile()) {
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function main() {
  await rm(dist, { recursive: true, force: true });
  for (const entry of entries) {
    const source = join(root, entry);
    await stat(source);
    const target = join(dist, entry);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  await copyTree(join(root, 'src'), join(dist, 'src'));
  await mkdir(dist, { recursive: true });
  await writeFile(join(dist, 'build-info.txt'), `build ok\nentries=${entries.length} plus src tree\n`, 'utf8');
  console.log(`Built ${entries.length} static entries plus src tree into ${dist}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

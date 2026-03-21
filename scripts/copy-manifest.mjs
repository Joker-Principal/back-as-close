import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(currentDir, '..');
const srcDir = resolve(rootDir, 'src');
const distDir = resolve(rootDir, 'dist');

function copyDirectoryRecursive(sourceDir, targetDir) {
    mkdirSync(targetDir, { recursive: true });

    for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
        const srcPath = resolve(sourceDir, entry.name);
        const destPath = resolve(targetDir, entry.name);

        if (entry.isDirectory()) {
            copyDirectoryRecursive(srcPath, destPath);
            continue;
        }

        copyFileSync(srcPath, destPath);
        console.log(`Copied ${relative(rootDir, srcPath)} to ${relative(rootDir, destPath)}.`);
    }
}

mkdirSync(distDir, { recursive: true });

// Copy manifest
const sourceManifest = resolve(srcDir, 'manifest.json');
const targetManifest = resolve(distDir, 'manifest.json');
copyFileSync(sourceManifest, targetManifest);
console.log('Copied manifest.json to dist/.');

// Copy all HTML files from src/ to dist/src/
const distSrcDir = resolve(distDir, 'src');
mkdirSync(distSrcDir, { recursive: true });
for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
        const src = resolve(srcDir, entry.name);
        const dest = resolve(distSrcDir, entry.name);
        copyFileSync(src, dest);
        console.log(`Copied ${relative(rootDir, src)} to dist/src/${entry.name}.`);
    }
}

const srcAssetsDir = resolve(srcDir, 'assets');
const distAssetsDir = resolve(distDir, 'assets');
copyDirectoryRecursive(srcAssetsDir, distAssetsDir);
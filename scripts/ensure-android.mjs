import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptDir);
const androidDir = join(projectRoot, 'android');
const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);

if (nodeMajor < 22) {
  console.error(`Capacitor 8 requires Node.js 22 or newer. Current: ${process.versions.node}`);
  process.exit(1);
}

if (existsSync(androidDir)) {
  process.exit(0);
}

const capCli = join(projectRoot, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor');

if (!existsSync(capCli)) {
  console.error('Capacitor CLI is not installed. Run npm install first.');
  process.exit(1);
}

console.log('Android platform is missing. Creating it with Capacitor...');
const result = spawnSync(process.execPath, [capCli, 'add', 'android'], {
  cwd: projectRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

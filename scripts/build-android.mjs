import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptDir);
const androidDir = join(projectRoot, 'android');
const apkPath = join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

if (!existsSync(androidDir)) {
  console.error('Android platform is missing. Run npm run android:prepare first.');
  process.exit(1);
}

const command = process.platform === 'win32' ? 'gradlew.bat' : 'bash';
const args = process.platform === 'win32' ? ['assembleDebug'] : ['gradlew', 'assembleDebug'];

const result = spawnSync(command, args, {
  cwd: androidDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

if (!existsSync(apkPath)) {
  console.error(`Gradle finished, but APK was not found at: ${apkPath}`);
  process.exit(1);
}

console.log(`Android APK: ${apkPath}`);

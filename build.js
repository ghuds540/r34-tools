const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.join(__dirname, 'dist');
const extensionDir = path.join(__dirname, 'extension');

// Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Read version from manifest
const manifest = JSON.parse(fs.readFileSync(path.join(extensionDir, 'manifest.json'), 'utf8'));
const version = manifest.version;

// Create zip filename (will rename to .xpi after)
const zipFilename = `r34-tools-v${version}.zip`;
const xpiFilename = `r34-tools-v${version}.xpi`;
const zipPath = path.join(distDir, zipFilename);
const xpiPath = path.join(distDir, xpiFilename);

console.log('Building extension...');
console.log(`Version: ${version}`);
console.log(`Output: ${xpiPath}`);

try {
  // Change to extension directory
  const originalDir = process.cwd();
  process.chdir(extensionDir);

  // Get all files
  const files = fs.readdirSync('.')
    .filter(f => !f.startsWith('.'))
    .map(f => `"${f}"`)
    .join(', ');

  // Create zip using PowerShell
  const psCommand = `Compress-Archive -Path ${files} -DestinationPath "${zipPath}" -Force`;
  execSync(`powershell -Command "${psCommand}"`, { stdio: 'inherit' });

  // Change back to original directory
  process.chdir(originalDir);

  // Rename .zip to .xpi
  fs.renameSync(zipPath, xpiPath);

  console.log('\n✓ Extension built successfully!');
  console.log(`\nInstall the extension:`);
  console.log(`1. Open Firefox`);
  console.log(`2. Go to about:addons`);
  console.log(`3. Click gear icon → Install Add-on From File`);
  console.log(`4. Select: ${xpiPath}`);
  console.log(`\nOr drag and drop the .xpi file onto Firefox.`);
} catch (error) {
  console.error('\nBuild failed:', error.message);
  console.error('\nManual build instructions:');
  console.error('1. Navigate to the extension folder');
  console.error('2. Select all files (not the folder itself)');
  console.error('3. Right-click → Send to → Compressed (zipped) folder');
  console.error('4. Rename the .zip file to .xpi');
  process.exit(1);
}

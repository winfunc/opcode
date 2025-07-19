#!/usr/bin/env bun

/**
 * Prepare the CLI for bundling using Bun's native embedding features
 * This modifies the source to use embedded files directly
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Read the original CLI file
const cliPath = './cli.js';
let cliContent = readFileSync(cliPath, 'utf-8');

console.log('Preparing CLI for native Bun embedding...');

// 1. Build list of embedded imports based on what files actually exist
const embeddedImports = [];
const embeddedFilesMapping = [];

// Define all possible ripgrep files
const ripgrepFiles = [
  { path: './vendor/ripgrep/arm64-darwin/rg', var: '__embeddedRgDarwinArm64' },
  { path: './vendor/ripgrep/arm64-darwin/ripgrep.node', var: '__embeddedRgNodeDarwinArm64' },
  { path: './vendor/ripgrep/arm64-linux/rg', var: '__embeddedRgLinuxArm64' },
  { path: './vendor/ripgrep/arm64-linux/ripgrep.node', var: '__embeddedRgNodeLinuxArm64' },
  { path: './vendor/ripgrep/x64-darwin/rg', var: '__embeddedRgDarwinX64' },
  { path: './vendor/ripgrep/x64-darwin/ripgrep.node', var: '__embeddedRgNodeDarwinX64' },
  { path: './vendor/ripgrep/x64-linux/rg', var: '__embeddedRgLinuxX64' },
  { path: './vendor/ripgrep/x64-linux/ripgrep.node', var: '__embeddedRgNodeLinuxX64' },
  { path: './vendor/ripgrep/x64-win32/rg.exe', var: '__embeddedRgWin32' },
  { path: './vendor/ripgrep/x64-win32/ripgrep.node', var: '__embeddedRgNodeWin32' },
];

// Always include yoga.wasm
if (existsSync('./yoga.wasm')) {
  embeddedImports.push('import __embeddedYogaWasm from "./yoga.wasm" with { type: "file" };');
  embeddedFilesMapping.push("  'yoga.wasm': __embeddedYogaWasm,");
} else {
  console.error('Warning: yoga.wasm not found');
}

// Only import ripgrep files that exist
for (const file of ripgrepFiles) {
  if (existsSync(file.path)) {
    embeddedImports.push(`import ${file.var} from "${file.path}" with { type: "file" };`);
    const key = file.path.replace('./', '');
    embeddedFilesMapping.push(`  '${key}': ${file.var},`);
  }
}

const embeddedCode = `
// Embedded files using Bun's native embedding
${embeddedImports.join('\n')}

const __embeddedFiles = {
${embeddedFilesMapping.join('\n')}
};

`;

// Add imports after the shebang
const shebangMatch = cliContent.match(/^#!.*\n/);
if (shebangMatch) {
  cliContent = shebangMatch[0] + embeddedCode + cliContent.substring(shebangMatch[0].length);
} else {
  cliContent = embeddedCode + cliContent;
}

// 2. Replace yoga.wasm loading - handle top-level await properly
// Handle both 1.0.41 and 1.0.55 patterns
// 1.0.41: var k81=await nUA(await VP9(CP9(import.meta.url).resolve("./yoga.wasm")));
// 1.0.55: var B71=await OPA(await WtB(JtB(import.meta.url).resolve("./yoga.wasm")));

// Try 1.0.55 pattern first (newer version)
const yoga155Pattern = /var B71=await OPA\(await WtB\(JtB\(import\.meta\.url\)\.resolve\("\.\/yoga\.wasm"\)\)\);/;
const yoga155Replacement = `var B71=await(async()=>{return await OPA(await Bun.file(__embeddedYogaWasm).arrayBuffer())})();`;

// Try 1.0.41 pattern (older version)
const yoga141Pattern = /var k81=await nUA\(await VP9\(CP9\(import\.meta\.url\)\.resolve\("\.\/yoga\.wasm"\)\)\);/;
const yoga141Replacement = `var k81=await(async()=>{return await nUA(await Bun.file(__embeddedYogaWasm).arrayBuffer())})();`;

if (yoga155Pattern.test(cliContent)) {
  cliContent = cliContent.replace(yoga155Pattern, yoga155Replacement);
  console.log('✓ Replaced yoga.wasm loading with embedded version (1.0.55 pattern)');
} else if (yoga141Pattern.test(cliContent)) {
  cliContent = cliContent.replace(yoga141Pattern, yoga141Replacement);
  console.log('✓ Replaced yoga.wasm loading with embedded version (1.0.41 pattern)');
} else {
  console.error('Warning: Could not find yoga.wasm loading pattern');
  // Try a more general pattern that works for both versions
  const generalYogaPattern = /var\s+(\w+)\s*=\s*await\s+(\w+)\s*\(\s*await\s+(\w+)\s*\([^)]+\.resolve\s*\(\s*["']\.\/yoga\.wasm["']\s*\)\s*\)\s*\)/;
  if (generalYogaPattern.test(cliContent)) {
    cliContent = cliContent.replace(generalYogaPattern, (match, varName, func1, func2) => {
      return `var ${varName}=await(async()=>{return await ${func1}(await Bun.file(__embeddedYogaWasm).arrayBuffer())})()`;
    });
    console.log('✓ Replaced yoga.wasm loading with embedded version (general pattern)');
  }
}

// 3. Replace ripgrep path resolution
// Add check for embedded files in the ripgrep resolver
const ripgrepPattern = /let B=Db\.resolve\(et9,"vendor","ripgrep"\);/;
const ripgrepReplacement = `
if(process.env.CLAUDE_CODE_BUNDLED || typeof __embeddedFiles !== 'undefined'){
  const platform = process.platform === "win32" ? "x64-win32" : \`\${process.arch}-\${process.platform}\`;
  const rgKey = \`vendor/ripgrep/\${platform}/rg\${process.platform === "win32" ? ".exe" : ""}\`;
  if(__embeddedFiles[rgKey]) return __embeddedFiles[rgKey];
}
let B=Db.resolve(et9,"vendor","ripgrep");`;

if (ripgrepPattern.test(cliContent)) {
  cliContent = cliContent.replace(ripgrepPattern, ripgrepReplacement);
  console.log('✓ Added embedded file handling for ripgrep');
}

// 4. Replace ripgrep.node loading - handle the entire if-else structure
// Look for the complete if-else pattern where B is assigned
const ripgrepNodePattern = /if\(typeof Bun!=="undefined"&&Bun\.embeddedFiles\?\.length>0\)B="\.\/ripgrep\.node";else/;
const ripgrepNodeReplacement = `if(typeof Bun!=="undefined"&&Bun.embeddedFiles?.length>0)B=(()=>{
  const platform = process.platform === "win32" ? "x64-win32" : \`\${process.arch}-\${process.platform}\`;
  const nodeKey = \`vendor/ripgrep/\${platform}/ripgrep.node\`;
  return __embeddedFiles[nodeKey] || "./ripgrep.node";
})();else`;

if (ripgrepNodePattern.test(cliContent)) {
  cliContent = cliContent.replace(ripgrepNodePattern, ripgrepNodeReplacement);
  console.log('✓ Added embedded file handling for ripgrep.node');
} else {
  // Fallback to simpler pattern if the exact pattern doesn't match
  const simplePattern = /B="\.\/ripgrep\.node"/;
  if (simplePattern.test(cliContent)) {
    cliContent = cliContent.replace(simplePattern, `B=(()=>{
      const platform = process.platform === "win32" ? "x64-win32" : \`\${process.arch}-\${process.platform}\`;
      const nodeKey = \`vendor/ripgrep/\${platform}/ripgrep.node\`;
      return __embeddedFiles[nodeKey] || "./ripgrep.node";
    })()`);
    console.log('✓ Added embedded file handling for ripgrep.node (fallback pattern)');
  }
}

// Set bundled mode indicator
cliContent = cliContent.replace(
  /process\.env\.CLAUDE_CODE_ENTRYPOINT="cli"/,
  'process.env.CLAUDE_CODE_ENTRYPOINT="cli";process.env.CLAUDE_CODE_BUNDLED="1"'
);

// Write the modified content
const outputPath = './cli-native-bundled.js';
writeFileSync(outputPath, cliContent);

console.log(`\n✅ Created ${outputPath} ready for bundling with native embedding`);
console.log('\nNow you can run:');
console.log(`  bun build --compile --minify ./cli-native-bundled.js --outfile dist/claude-code`); 

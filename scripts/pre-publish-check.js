#!/usr/bin/env node

/**
 * Pre-publish check script
 * Run this before publishing to npm
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Running pre-publish checks...\n');

const checks = [];

// Check 1: Verify dist directory exists
checks.push({
  name: 'Dist directory exists',
  run: () => {
    const distPath = path.join(__dirname, '../dist');
    if (!fs.existsSync(distPath)) {
      throw new Error('dist directory not found. Run: npm run build');
    }
    return true;
  }
});

// Check 2: Verify main entry point exists
checks.push({
  name: 'Main entry point exists',
  run: () => {
    const mainPath = path.join(__dirname, '../dist/index.js');
    if (!fs.existsSync(mainPath)) {
      throw new Error('dist/index.js not found');
    }
    return true;
  }
});

// Check 3: Verify type definitions exist
checks.push({
  name: 'Type definitions exist',
  run: () => {
    const typesPath = path.join(__dirname, '../dist/index.d.ts');
    if (!fs.existsSync(typesPath)) {
      throw new Error('dist/index.d.ts not found');
    }
    return true;
  }
});

// Check 4: Verify package.json has required fields
checks.push({
  name: 'package.json is complete',
  run: () => {
    const pkgPath = path.join(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    const required = ['name', 'version', 'description', 'main', 'types', 'author', 'license'];
    const missing = required.filter(field => !pkg[field]);

    if (missing.length > 0) {
      throw new Error(`package.json missing fields: ${missing.join(', ')}`);
    }

    if (pkg.author === '' || !pkg.author) {
      throw new Error('package.json author field is empty');
    }

    return true;
  }
});

// Check 5: Verify README exists
checks.push({
  name: 'README.md exists',
  run: () => {
    const readmePath = path.join(__dirname, '../README.md');
    if (!fs.existsSync(readmePath)) {
      throw new Error('README.md not found');
    }
    return true;
  }
});

// Check 6: Check for common issues in package.json
checks.push({
  name: 'package.json has no placeholder URLs',
  run: () => {
    const pkgPath = path.join(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    if (pkg.repository?.url?.includes('NO-MAP')) {
      console.warn('⚠️  Warning: repository URL contains placeholder "NO-MAP"');
    }

    if (pkg.bugs?.url?.includes('NO-MAP')) {
      console.warn('⚠️  Warning: bugs URL contains placeholder "NO-MAP"');
    }

    return true;
  }
});

// Check 7: Verify TypeScript compilation
checks.push({
  name: 'TypeScript compilation successful',
  run: () => {
    try {
      execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
      return true;
    } catch (error) {
      throw new Error('TypeScript compilation failed. Run: npm run build');
    }
  }
});

// Check 8: Verify no .npmignore issues
checks.push({
  name: 'Only dist files will be published',
  run: () => {
    const pkgPath = path.join(__dirname, '../package.json');
    const npmignorePath = path.join(__dirname, '../.npmignore');

    if (!fs.existsSync(npmignorePath)) {
      console.warn('⚠️  Warning: .npmignore not found');
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (!pkg.files || !pkg.files.includes('dist')) {
      throw new Error('package.json should include "files": ["dist"]');
    }

    return true;
  }
});

// Run all checks
let passed = 0;
let failed = 0;

console.log('Running checks:\n');

checks.forEach((check, index) => {
  try {
    check.run();
    console.log(`✅ ${index + 1}. ${check.name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${index + 1}. ${check.name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log(`Checks passed: ${passed}/${checks.length}`);
console.log(`Checks failed: ${failed}/${checks.length}`);
console.log('='.repeat(60));

if (failed > 0) {
  console.log('\n❌ Pre-publish checks failed!');
  console.log('Please fix the issues above before publishing.\n');
  process.exit(1);
} else {
  console.log('\n✅ All checks passed!');
  console.log('\nYou can now publish with:');
  console.log('  npm publish');
  console.log('\nOr preview with:');
  console.log('  npm pack --dry-run\n');
  process.exit(0);
}

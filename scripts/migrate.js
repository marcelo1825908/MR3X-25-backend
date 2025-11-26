#!/usr/bin/env node

/**
 * Script to create Prisma migrations with automatic naming
 * Usage: node scripts/migrate.js [migration-name]
 * If no name is provided, it will use a timestamp-based name
 */

const { execSync } = require('child_process');
const path = require('path');

// Get migration name from command line argument or generate one
const customName = process.argv[2];
let migrationName;

if (customName) {
  // Use custom name if provided
  migrationName = customName;
} else {
  // Generate automatic name with timestamp
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  migrationName = `auto_${year}${month}${day}_${hours}${minutes}${seconds}`;
}

console.log(`Creating migration: ${migrationName}`);

try {
  // Run prisma migrate dev with the generated name
  // Use spawn-like approach for better error handling
  const command = `npx prisma migrate dev --name "${migrationName}"`;
  console.log(`Running: ${command}`);
  
  execSync(command, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: { ...process.env },
    shell: true,
  });
  
  console.log(`✅ Migration "${migrationName}" created successfully!`);
} catch (error) {
  console.error('\n❌ Migration failed!');
  if (error.stdout) {
    console.error('STDOUT:', error.stdout.toString());
  }
  if (error.stderr) {
    console.error('STDERR:', error.stderr.toString());
  }
  if (error.message) {
    console.error('Error:', error.message);
  }
  console.error('\n💡 Make sure:');
  console.error('   1. Your database is running and accessible');
  console.error('   2. DATABASE_URL is set correctly in .env');
  console.error('   3. You have pending schema changes');
  process.exit(1);
}


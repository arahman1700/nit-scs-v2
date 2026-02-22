#!/usr/bin/env node
/**
 * Generate VAPID keys for Web Push notifications.
 * Run: node scripts/generate-vapid-keys.js
 * Then add the output to your .env or Render environment variables.
 */
import webPush from 'web-push';

const keys = webPush.generateVAPIDKeys();

console.log('=== VAPID Keys Generated ===\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('\nAdd these to your .env file or deployment environment variables.');
console.log('IMPORTANT: Keep VAPID_PRIVATE_KEY secret!\n');

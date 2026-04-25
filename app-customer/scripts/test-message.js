#!/usr/bin/env node

// Script to test message sending to admin
const fs = require('fs');
const path = require('path');

// Load settings
const settings = require('../settings.json');

console.log('=== Test WhatsApp Message Sending ===\n');

// Check admin configuration
console.log('? Admin Configuration:');
console.log(`Admin numbers: ${JSON.stringify(settings.admins)}`);
console.log(`WhatsApp timeout: ${settings.whatsapp_timeout}ms`);
console.log(`Notification timeout: ${settings.notification_timeout}ms`);
console.log('');

// Check superadmin.txt file
try {
    const superAdminPath = path.join(__dirname, '../config/superadmin.txt');
    if (fs.existsSync(superAdminPath)) {
        const superAdmin = fs.readFileSync(superAdminPath, 'utf8').trim();
        console.log(`Super admin: ${superAdmin}`);
    } else {
        console.log('? File superadmin.txt not found');
    }
} catch (error) {
    console.log('❌ Error reading superadmin.txt:', error.message);
}

console.log('');

// Test message
const testMessage = `? *BOT MESSAGE TEST*\n\n` +
    `? This is a test message to verify WhatsApp connection\n` +
    `? Time: ${new Date().toLocaleString()}\n\n` +
    `? If you receive this message, it means:\n` +
    `? WhatsApp connection is working properly\n` +
    `? Message sending to admin is successful\n` +
    `? Bot is ready to use\n\n` +
    `? *NBB WiFiber Internet Services*`;

console.log('? Test message to be sent:');
console.log(testMessage);
console.log('');

console.log('✅ Script test selesai. Jalankan aplikasi utama untuk test pengiriman pesan.');
console.log('💡 Tips: Gunakan "node scripts/restart-on-error.js" untuk menjalankan dengan auto-restart'); 
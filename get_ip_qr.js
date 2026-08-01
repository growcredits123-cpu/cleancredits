const os = require('os');
const QRCode = require('qrcode');
const path = require('path');

const interfaces = os.networkInterfaces();
let ip = '127.0.0.1';

// Find a likely LAN IP (192.168.x.x, 10.x.x.x, 172.16.x.x - 172.31.x.x)
for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
            ip = iface.address; // Pick the first non-internal IPv4
            if (ip.startsWith('192.168.') || ip.startsWith('10.')) {
                break;
            }
        }
    }
}

console.log('Detected IP:', ip);

const expoUrl = `exp://${ip}:8081`;
console.log('Expo URL:', expoUrl);

const outPath = 'C:/Users/acer/.gemini/antigravity-ide/brain/3421c00a-b7d9-491f-bfe6-8e3e7a7fc6ce/qr.png';

QRCode.toFile(outPath, expoUrl, {
    color: {
        dark: '#000000',  // Black dots
        light: '#ffffff' // White background
    }
}, function (err) {
    if (err) throw err;
    console.log('QR Code generated successfully at', outPath);
});

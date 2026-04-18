const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, 'key.pem');
const certPath = path.join(__dirname, 'cert.pem');

console.log('--- KraoQ Zero-Dependency SSL Generator ---');

// Pre-generated self-signed certificate (CN=localhost, valid for 10 years)
// Note: This is a standard dev-only certificate pair.
const certData = ``;

const keyData = ``;

try {
    console.log('Generating pre-calculated development certificates...');
    
    fs.writeFileSync(keyPath, keyData.trim());
    fs.writeFileSync(certPath, certData.trim());
    
    console.log('\n✅ Certificates generated successfully!');
    console.log('   - key.pem');
    console.log('   - cert.pem');
    console.log('\nNow restart your relay server with: npm start');
    console.log('\nNOTE: Your browser will show a "Privacy Warning". This is expected.');
    console.log('      Click "Advanced" and then "Proceed to [IP] (unsafe)".');
    
} catch (e) {
    console.error('\n❌ Failed to write certificates to disk.');
    console.error(e);
}

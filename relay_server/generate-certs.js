const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

const keyPath = path.join(__dirname, 'key.pem');
const certPath = path.join(__dirname, 'cert.pem');

async function generate() {
    console.log('--- KraoQ SSL Generator ---');
    console.log('Generating a self-signed development certificate...');

    const pems = await selfsigned.generate(
        [{ name: 'commonName', value: 'localhost' }],
        {
            keyType: 'rsa',
            keySize: 2048,
            algorithm: 'sha256',
            notAfterDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
            extensions: [
                { name: 'basicConstraints', cA: true },
                { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
                { name: 'extKeyUsage', serverAuth: true },
                {
                    name: 'subjectAltName',
                    altNames: [
                        { type: 2, value: 'localhost' },
                        { type: 7, ip: '127.0.0.1' }
                    ]
                }
            ]
        }
    );

    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);

    console.log('\nCertificates generated successfully!');
    console.log('   - key.pem');
    console.log('   - cert.pem');
    console.log('\nTo bundle them into certificate.pfx (requires OpenSSL):');
    console.log('   openssl pkcs12 -export -out certificate.pfx -inkey key.pem -in cert.pem -password pass:$PFX_PASSPHRASE');
    console.log('\nNOTE: Your browser will show a "Privacy Warning". This is expected.');
    console.log('      Click "Advanced" and then "Proceed to [IP] (unsafe)."');
}

generate().catch((e) => {
    console.error('\nFailed to generate certificates.');
    console.error(e.message);
    process.exit(1);
});
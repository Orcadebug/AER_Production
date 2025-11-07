#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { generateKeyPair, exportJWK, exportPKCS8 } from 'jose';

async function main() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const kid = `aer-${randomUUID()}`;

  const jwk = await exportJWK(publicKey);
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  jwk.kid = kid;

  const jwks = { keys: [jwk] };
  const pkcs8 = await exportPKCS8(privateKey);

  await mkdir('secrets', { recursive: true });
  await writeFile('secrets/convex_jwt_private_key.pem', pkcs8, { encoding: 'utf8', mode: 0o600 });
  await writeFile('secrets/convex_jwks.json', JSON.stringify(jwks, null, 2), { encoding: 'utf8', mode: 0o600 });

  console.log('Generated new JWT key pair for Convex Auth.');
  console.log('Private key: secrets/convex_jwt_private_key.pem');
  console.log('JWKS:        secrets/convex_jwks.json');
  console.log('\nNext steps:');
  console.log('1) Open Convex dashboard for your deployment.');
  console.log('2) Set environment variable JWT_PRIVATE_KEY to the PEM file contents.');
  console.log('3) Set environment variable JWKS to the contents of the JWKS JSON file.');
  console.log('4) Save, then redeploy: npx convex deploy');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

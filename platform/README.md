# Guardian Security Platform

A modular companion to Ring Guardian Prototype that adds:
- A verifiable **security manifest** (authorship + lineage-safe protocols)
- A secure **action registry** (locks, appliances, prompts)
- Signed **audit logs** to protect provenance and enable enterprise integration

## Why this matters
- Establishes authorship and governance in code, not just docs
- Eases enterprise adoption (Microsoft Security, others) via clean interfaces
- Keeps consent and privacy at the core

## Quick start
```bash
# Install
npm init -y
# (No external deps required for demo; uses Node's crypto)

# Use in your runtime
const { createPlatform } = require('./platform/guardian-platform');
const manifest = require('./platform/security-manifest.json');

const platform = createPlatform({ manifest });

// Example: execute actions with audit
(async () => {
  await platform.execute('notify.prompt', { to: 'parent-1', message: 'Ceremonial Steward Alert: Test', actions: ['Yes','No'] });
  await platform.execute('lock.frontDoor', { lockId: 'front-lock' });
  await platform.execute('appliance.shutOff', { applianceId: 'oven', consentGranted: true });

  const signed = platform.generateSignedReport();
  console.log('Signed Report:', signed.signature.slice(0, 64) + '...');
})();

const fs = require('fs');
const path = require('path');

const contracts = [
  ['KAIROToken', 'KAIROTokenABI'],
  ['LiquidityPool', 'LiquidityPoolABI'],
  ['StakingManager', 'StakingManagerABI'],
  ['AffiliateDistributor', 'AffiliateDistributorABI'],
  ['CoreMembershipSubscription', 'CoreMembershipSubscriptionABI'],
  ['AtomicP2p', 'AtomicP2pABI'],
  ['MockUSDT', 'MockUSDTABI'],
];

contracts.forEach(([name, exportName]) => {
  const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', `${name}.sol`, `${name}.json`);
  const art = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const content = `export const ${exportName} = ${JSON.stringify(art.abi, null, 2)} as const;\n`;
  const outPath = path.join(__dirname, '..', 'frontend', 'src', 'config', 'abis', `${name}.ts`);
  fs.writeFileSync(outPath, content);
  console.log(`Updated ${name}.ts (${art.abi.length} ABI entries)`);
});

console.log('\nAll ABIs updated successfully!');

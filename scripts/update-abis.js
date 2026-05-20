const fs = require('fs');
const path = require('path');

const contracts = [
  ['KAIROToken', 'KAIROTokenABI', 'KAIROToken.sol'],
  ['LiquidityPool', 'LiquidityPoolABI', 'LiquidityPool.sol'],
  ['StakingManager', 'StakingManagerABI', 'StakingManager.sol'],
  ['AffiliateDistributor', 'AffiliateDistributorABI', 'AffiliateDistributor.sol'],
  ['CoreMembershipSubscription', 'CoreMembershipSubscriptionABI', 'CoreMembershipSubscription.sol'],
  ['AtomicP2p', 'AtomicP2pABI', 'AtomicP2p.sol'],
  ['MockUSDT', 'MockUSDTABI', 'test/MockUSDT.sol'],
];

contracts.forEach(([name, exportName, solDir]) => {
  const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', solDir, `${name}.json`);
  const art = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const content = `export const ${exportName} = ${JSON.stringify(art.abi, null, 2)} as const;\n`;
  const outPath = path.join(__dirname, '..', 'frontend', 'src', 'config', 'abis', `${name}.ts`);
  fs.writeFileSync(outPath, content);
  console.log(`Updated ${name}.ts (${art.abi.length} ABI entries)`);
});

console.log('\nAll ABIs updated successfully!');

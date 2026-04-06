const fs = require('fs');
const path = require('path');

const contracts = [
  'KAIROToken',
  'LiquidityPool', 
  'StakingManager',
  'AffiliateDistributor',
  'CoreMembershipSubscription',
  'AtomicP2p',
  'MockUSDT'
];

const outDir = path.join(__dirname, 'frontend/src/config/abis');
fs.mkdirSync(outDir, { recursive: true });

contracts.forEach(c => {
  const artPath = path.join(__dirname, 'artifacts/contracts', c + '.sol', c + '.json');
  const art = JSON.parse(fs.readFileSync(artPath, 'utf8'));
  const content = 'export const ' + c + 'ABI = ' + JSON.stringify(art.abi, null, 2) + ' as const;\n';
  fs.writeFileSync(path.join(outDir, c + '.ts'), content);
  console.log(c + ' done: ' + art.abi.length + ' entries');
});

// Create barrel export
const barrel = contracts.map(c => "export { " + c + "ABI } from './" + c + "';").join('\n') + '\n';
fs.writeFileSync(path.join(outDir, 'index.ts'), barrel);
console.log('Barrel export created');

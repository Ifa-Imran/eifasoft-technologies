// End-to-end test of the P2POrderHistory data flow against mainnet
import { createPublicClient, http, parseAbiItem } from 'viem';
import { bsc } from 'viem/chains';

const RPC = 'https://opbnb-mainnet-rpc.bnbchain.org';
const P2P = '0xD9CaCE2B7C23013E3eDFf93dbF1CeE197AC386B2';

const client = createPublicClient({ chain: bsc, transport: http(RPC) });

// Find users who created orders via events
const latest = await client.getBlockNumber();
const from = latest > 500000n ? latest - 500000n : 0n;

console.log('Scanning events from block', from, 'to', latest, '...');

// Use smaller chunks to avoid RPC limits
const CHUNK = 45000n;
let creators = new Set();

async function scanChunks(event, label) {
  let f = from;
  let count = 0;
  while (f <= latest) {
    const to = f + CHUNK - 1n > latest ? latest : f + CHUNK - 1n;
    try {
      const logs = await client.getLogs({ address: P2P, event, fromBlock: f, toBlock: to });
      for (const l of logs) {
        const creator = l.args.creator;
        if (creator) creators.add(creator);
        count++;
      }
    } catch (e) {
      console.log(`  chunk ${f}-${to} failed:`, (e.shortMessage || e.message || '').slice(0, 80));
    }
    f = to + 1n;
  }
  console.log(`${label}: ${count} events`);
}

await scanChunks(parseAbiItem('event BuyOrderCreated(uint256 indexed orderId, address indexed creator, uint256 usdtAmount, uint256 timestamp)'), 'BuyOrderCreated');
await scanChunks(parseAbiItem('event SellOrderCreated(uint256 indexed orderId, address indexed creator, uint256 kairoAmount, uint256 timestamp)'), 'SellOrderCreated');

console.log('\nUnique creators found:', creators.size);
const users = [...creators].slice(0, 3);
console.log('Testing first 3:', users);

const p2pAbi = [
  parseAbiItem('function getUserOrders(address user) view returns (uint256[] buyOrderIds, uint256[] sellOrderIds)'),
  parseAbiItem('function getUserTrades(address user) view returns (uint256[] tradeIds)'),
  parseAbiItem('function getBuyOrder(uint256 orderId) view returns ((address creator, uint256 usdtAmount, uint256 usdtRemaining, bool active, uint256 createdAt))'),
  parseAbiItem('function getSellOrder(uint256 orderId) view returns ((address creator, uint256 kairoAmount, uint256 kairoRemaining, bool active, uint256 createdAt))'),
  parseAbiItem('function getTrade(uint256 tradeId) view returns ((uint256 buyOrderId, uint256 sellOrderId, address buyer, address seller, uint256 kairoAmount, uint256 usdtAmount, uint256 price, uint256 kairoFee, uint256 usdtFee, uint256 executedAt))'),
];

for (const user of users) {
  console.log(`\n=== User ${user} ===`);
  try {
    const orders = await client.readContract({ address: P2P, abi: p2pAbi, functionName: 'getUserOrders', args: [user] });
    const trades = await client.readContract({ address: P2P, abi: p2pAbi, functionName: 'getUserTrades', args: [user] });
    console.log('  buyOrderIds:', orders[0].map(String));
    console.log('  sellOrderIds:', orders[1].map(String));
    console.log('  tradeIds:', trades.map(String));

    // Test multicall like the hook does
    const buyCalls = orders[0].map(id => ({ address: P2P, abi: p2pAbi, functionName: 'getBuyOrder', args: [id] }));
    if (buyCalls.length > 0) {
      const results = await client.multicall({ contracts: buyCalls });
      console.log('  multicall getBuyOrder results:');
      results.forEach((r, i) => {
        if (r.status === 'success') {
          const o = r.result;
          console.log(`    #${orders[0][i]}: usdtAmount=${o.usdtAmount} remaining=${o.usdtRemaining} active=${o.active} createdAt=${o.createdAt}`);
        } else {
          console.log(`    #${orders[0][i]}: FAILED - ${r.error?.shortMessage || r.error}`);
        }
      });
    }
  } catch (e) {
    console.log('  ERROR:', (e.shortMessage || e.message || '').slice(0, 200));
  }
}

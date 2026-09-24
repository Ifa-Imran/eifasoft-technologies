// Quick check: does the deployed AtomicP2p contract support getUserOrders/getUserTrades/getTrade?
import { createPublicClient, http, parseAbiItem } from 'viem';
import { bsc } from 'viem/chains';

const RPC = 'https://opbnb-mainnet-rpc.bnbchain.org';
const P2P = '0xD9CaCE2B7C23013E3eDFf93dbF1CeE197AC386B2';

const client = createPublicClient({ chain: bsc, transport: http(RPC) });

const zero = '0x0000000000000000000000000000000000000000';

async function safeCall(name, args) {
  try {
    const abi = { getUserOrders: 'function getUserOrders(address user) view returns (uint256[] buyOrderIds, uint256[] sellOrderIds)' }[name];
    return await client.readContract({
      address: P2P,
      abi: [parseAbiItem(abi)],
      functionName: name,
      args,
    });
  } catch (e) {
    return `REVERT: ${(e.shortMessage || e.message || '').slice(0, 120)}`;
  }
}

console.log('block:', await client.getBlockNumber());

const userOrders = await safeCall('getUserOrders', [zero]);
console.log('getUserOrders(zero):', userOrders);

// getTrade(0) — check function exists
try {
  const r = await client.readContract({
    address: P2P,
    abi: [parseAbiItem('function getTrade(uint256 tradeId) view returns ((uint256 buyOrderId, uint256 sellOrderId, address buyer, address seller, uint256 kairoAmount, uint256 usdtAmount, uint256 price, uint256 kairoFee, uint256 usdtFee, uint256 executedAt))')],
    functionName: 'getTrade',
    args: [0n],
  });
  console.log('getTrade(0):', r);
} catch (e) {
  console.log('getTrade(0) REVERT:', (e.shortMessage || e.message || '').slice(0, 150));
}

// getBuyOrder(0) — check function exists
try {
  const r = await client.readContract({
    address: P2P,
    abi: [parseAbiItem('function getBuyOrder(uint256 orderId) view returns ((address creator, uint256 usdtAmount, uint256 usdtRemaining, bool active, uint256 createdAt))')],
    functionName: 'getBuyOrder',
    args: [0n],
  });
  console.log('getBuyOrder(0):', r);
} catch (e) {
  console.log('getBuyOrder(0) REVERT:', (e.shortMessage || e.message || '').slice(0, 150));
}

/**
 * Diagnostic script using viem (same library as frontend) to replicate
 * the BFS multicall logic from useAffiliate.ts and find why active directs = 0
 */
import { createPublicClient, http, formatUnits, parseAbi } from 'viem';
import { opBNBTestnet } from 'viem/chains';

const WALLET = '0x6726F92AE08A26a411fAdC5B0bb8f0A28b6Dd7cA' as const;
const STAKING = '0x548cd2EE5BbeaeB80a5396a872E36d31eB3bFe7E' as const;
const AFFILIATE = '0x1f230901951A3fd731156a5E8A28D1925bfBDE39' as const;

const stakingAbi = [
  { type: 'function', name: 'getTotalActiveStakeValue', stateMutability: 'view', inputs: [{ name: '_user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'hasActivePosition', stateMutability: 'view', inputs: [{ name: '_user', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'getUserStakes', stateMutability: 'view', inputs: [{ name: '_user', type: 'address' }], outputs: [{ name: '', type: 'tuple[]', components: [{ name: 'originalAmount', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'tier', type: 'uint256' }, { name: 'startTime', type: 'uint256' }, { name: 'lastCompound', type: 'uint256' }, { name: 'totalEarned', type: 'uint256' }, { name: 'hardCap', type: 'uint256' }, { name: 'active', type: 'bool' }] }] },
] as const;

const affiliateAbi = parseAbi([
  'function getDirectReferrals(address _user) external view returns (address[])',
]);

async function main() {
  const client = createPublicClient({
    chain: opBNBTestnet,
    transport: http('https://opbnb-testnet.publicnode.com'),
  });

  console.log('=== VIEM DIAGNOSTIC (replicating frontend BFS logic) ===');
  console.log('Wallet:', WALLET);
  console.log('Chain:', opBNBTestnet.id, opBNBTestnet.name);
  console.log();

  // Step 1: Get direct referrals (same as frontend line 201-207)
  console.log('--- Step 1: getDirectReferrals ---');
  let directs: string[] = [];
  try {
    directs = await client.readContract({
      address: AFFILIATE,
      abi: affiliateAbi,
      functionName: 'getDirectReferrals',
      args: [WALLET],
    }) as string[];
    console.log(`Got ${directs.length} direct referrals:`, directs);
  } catch (err) {
    console.error('FAILED to get directs:', err);
    return;
  }

  // Step 2: Replicate the BFS level 1 multicall (frontend lines 218-232)
  console.log('\n--- Step 2: Multicall getTotalActiveStakeValue (BFS level 1 pattern) ---');
  const volCalls = directs.map(addr => ({
    address: STAKING,
    abi: stakingAbi,
    functionName: 'getTotalActiveStakeValue' as const,
    args: [addr as `0x${string}`],
  }));

  try {
    const results = await client.multicall({ contracts: volCalls });
    let totalVol = 0n;
    console.log('Multicall results:');
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      console.log(`  [${i}] ${directs[i]}: status=${r.status}, result=${r.status === 'success' ? r.result : r.error}`);
      if (r.status === 'success' && r.result) {
        totalVol += BigInt(r.result as any);
      }
    }
    console.log(`Level 1 totalVol = ${formatUnits(totalVol, 18)} USDT`);
  } catch (err) {
    console.error('MULTICALL FAILED:', err);
  }

  // Step 3: Replicate the team analytics multicall (frontend lines 317-337)
  console.log('\n--- Step 3: Analytics multicall (directAddrs from Set, lowercased) ---');
  // Frontend stores as lowercased in Set, then spreads to array
  const directAddrsLower = directs.map(a => a.toLowerCase());
  console.log('Lowercased addrs:', directAddrsLower);

  const stakeCalls = directAddrsLower.map(addr => ({
    address: STAKING,
    abi: stakingAbi,
    functionName: 'getTotalActiveStakeValue' as const,
    args: [addr as `0x${string}`],
  }));

  let directActive = 0;
  let directBusiness = 0n;
  try {
    const results = await client.multicall({ contracts: stakeCalls });
    console.log('Analytics multicall results:');
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      console.log(`  [${i}] ${directAddrsLower[i]}: status=${r.status}, result=${r.status === 'success' ? r.result : r.error}`);
      if (r.status === 'success') {
        const val = BigInt(r.result as any);
        if (val > 0n) { directActive++; directBusiness += val; }
      }
    }
    console.log(`directActive = ${directActive}`);
    console.log(`directBusiness = ${formatUnits(directBusiness, 18)} USDT`);
  } catch (err) {
    console.error('ANALYTICS MULTICALL FAILED:', err);
  }

  // Step 4: Individual calls for each direct (not multicall) to compare
  console.log('\n--- Step 4: Individual readContract calls (no multicall) ---');
  for (const addr of directs) {
    try {
      const val = await client.readContract({
        address: STAKING,
        abi: stakingAbi,
        functionName: 'getTotalActiveStakeValue',
        args: [addr as `0x${string}`],
      });
      const active = await client.readContract({
        address: STAKING,
        abi: stakingAbi,
        functionName: 'hasActivePosition',
        args: [addr as `0x${string}`],
      });
      console.log(`  ${addr}: stakeValue=${formatUnits(val as bigint, 18)} USDT, hasActive=${active}`);
    } catch (err: any) {
      console.error(`  ${addr}: ERROR - ${err.message?.slice(0, 100)}`);
    }
  }

  // Step 5: Check if multicall3 contract exists
  console.log('\n--- Step 5: Check Multicall3 contract ---');
  try {
    const code = await client.getCode({ address: '0xcA11bde05977b3631167028862bE2a173976CA11' });
    console.log(`Multicall3 bytecode length: ${code ? code.length : 0}`);
    console.log(`Multicall3 exists: ${code && code !== '0x'}`);
  } catch (err: any) {
    console.error('Multicall3 check failed:', err.message);
  }

  // Step 6: Test getLogs with fromBlock: 0n (same as frontend BFS)
  console.log('\n--- Step 6: Test getLogs (TeamEarned) fromBlock: 0n ---');
  try {
    const logs = await client.getLogs({
      address: AFFILIATE,
      event: {
        type: 'event',
        name: 'TeamEarned',
        inputs: [
          { type: 'address', name: 'upline', indexed: true },
          { type: 'address', name: 'staker', indexed: true },
          { type: 'uint256', name: 'level', indexed: false },
          { type: 'uint256', name: 'amount', indexed: false },
        ],
      },
      args: { upline: WALLET },
      fromBlock: 0n,
      toBlock: 'latest',
    });
    console.log(`TeamEarned logs found: ${logs.length}`);
  } catch (err: any) {
    console.error('getLogs FAILED (fromBlock:0n):', err.message?.slice(0, 200));
  }

  // Step 6b: Test getLogs with safe fromBlock range
  console.log('\n--- Step 6b: Test getLogs with safe fromBlock ---');
  try {
    const latestBlock = await client.getBlockNumber();
    const safeFrom = latestBlock > 500_000n ? latestBlock - 500_000n : 0n;
    console.log(`Using fromBlock: ${safeFrom} (latest: ${latestBlock})`);
    const logs = await client.getLogs({
      address: AFFILIATE,
      event: {
        type: 'event',
        name: 'TeamEarned',
        inputs: [
          { type: 'address', name: 'upline', indexed: true },
          { type: 'address', name: 'staker', indexed: true },
          { type: 'uint256', name: 'level', indexed: false },
          { type: 'uint256', name: 'amount', indexed: false },
        ],
      },
      args: { upline: WALLET },
      fromBlock: safeFrom,
      toBlock: 'latest',
    });
    console.log(`TeamEarned logs found with safe range: ${logs.length}`);
  } catch (err: any) {
    console.error('getLogs also failed with safe range:', err.message?.slice(0, 200));
  }

  // Step 6c: Check actual getUserStakes with CORRECT ABI (matching contract struct)
  console.log('\n--- Step 6c: getUserStakes with correct ABI ---');
  const correctStakingAbi = [
    { type: 'function', name: 'getUserStakes', stateMutability: 'view',
      inputs: [{ name: '_user', type: 'address' }],
      outputs: [{ name: '', type: 'tuple[]', components: [
        { name: 'amount', type: 'uint256' },
        { name: 'originalAmount', type: 'uint256' },
        { name: 'startTime', type: 'uint256' },
        { name: 'lastCompoundTime', type: 'uint256' },
        { name: 'harvestedRewards', type: 'uint256' },
        { name: 'totalEarned', type: 'uint256' },
        { name: 'compoundEarned', type: 'uint256' },
        { name: 'active', type: 'bool' },
        { name: 'tier', type: 'uint8' },
      ]}]
    },
  ] as const;
  try {
    const stakes = await client.readContract({
      address: STAKING,
      abi: correctStakingAbi,
      functionName: 'getUserStakes',
      args: [WALLET],
    });
    for (let i = 0; i < (stakes as any[]).length; i++) {
      const s = (stakes as any[])[i];
      console.log(`Stake ${i}: amount=${formatUnits(s.amount, 18)}, original=${formatUnits(s.originalAmount, 18)}, tier=${s.tier}, active=${s.active}, startTime=${s.startTime}, totalEarned=${formatUnits(s.totalEarned, 18)}, compoundEarned=${formatUnits(s.compoundEarned, 18)}, hardCap=3x=${formatUnits(s.originalAmount * 3n, 18)}`);
    }
  } catch (err: any) {
    console.error('getUserStakes failed:', err.message?.slice(0, 200));
  }

  // Step 7: Test the FULL BFS flow (simulating exact frontend useEffect)
  console.log('\n--- Step 7: Full BFS simulation (frontend useEffect) ---');
  try {
    const contractAddr = AFFILIATE;
    const levelMembers: Map<number, Set<string>> = new Map();
    const levelBusiness: Map<number, bigint> = new Map();
    for (let i = 1; i <= 15; i++) {
      levelMembers.set(i, new Set());
      levelBusiness.set(i, 0n);
    }

    let currentLevel: string[] = [];
    const deepMembers: string[] = [];
    try {
      const directs = await client.readContract({
        address: contractAddr,
        abi: affiliateAbi,
        functionName: 'getDirectReferrals',
        args: [WALLET],
      }) as string[];
      currentLevel = directs || [];
      console.log(`BFS start: ${currentLevel.length} directs`);
    } catch { currentLevel = []; }

    for (let lvl = 1; currentLevel.length > 0; lvl++) {
      console.log(`BFS level ${lvl}: ${currentLevel.length} members`);
      if (lvl <= 15) {
        const membersSet = levelMembers.get(lvl)!;
        for (const addr of currentLevel) membersSet.add(addr.toLowerCase());

        const volCalls2 = currentLevel.map(addr => ({
          address: STAKING,
          abi: stakingAbi,
          functionName: 'getTotalActiveStakeValue' as const,
          args: [addr as `0x${string}`],
        }));
        try {
          const results = await client.multicall({ contracts: volCalls2 });
          let totalVol = 0n;
          for (const r of results) {
            if (r.status === 'success' && r.result) totalVol += BigInt(r.result as any);
          }
          levelBusiness.set(lvl, totalVol);
          console.log(`  Level ${lvl} business: ${formatUnits(totalVol, 18)} USDT`);
        } catch (e: any) { console.error(`  Level ${lvl} multicall FAILED:`, e.message?.slice(0, 100)); }
      } else {
        for (const addr of currentLevel) deepMembers.push(addr.toLowerCase());
      }

      const nextLevel: string[] = [];
      const refCalls = currentLevel.map(addr => ({
        address: contractAddr,
        abi: affiliateAbi,
        functionName: 'getDirectReferrals' as const,
        args: [addr as `0x${string}`],
      }));
      try {
        const results = await client.multicall({ contracts: refCalls });
        for (const r of results) {
          if (r.status === 'success' && Array.isArray(r.result)) {
            nextLevel.push(...(r.result as string[]));
          }
        }
      } catch (e: any) { console.error(`  Ref multicall FAILED:`, e.message?.slice(0, 100)); }
      currentLevel = nextLevel;
    }

    console.log('BFS complete. Computing analytics...');

    // Analytics
    const directAddrs = levelMembers.get(1) ? [...levelMembers.get(1)!] : [];
    const allTeamAddrs: string[] = [];
    for (let i = 1; i <= 15; i++) {
      const s = levelMembers.get(i);
      if (s) allTeamAddrs.push(...s);
    }
    allTeamAddrs.push(...deepMembers);
    console.log(`Direct addrs: ${directAddrs.length}, Total team: ${allTeamAddrs.length}`);

    let directActive2 = 0;
    let directBusiness2 = 0n;
    if (directAddrs.length > 0) {
      const stakeCalls2 = directAddrs.map(addr => ({
        address: STAKING,
        abi: stakingAbi,
        functionName: 'getTotalActiveStakeValue' as const,
        args: [addr as `0x${string}`],
      }));
      try {
        const results = await client.multicall({ contracts: stakeCalls2 });
        for (const r of results) {
          if (r.status === 'success') {
            const val = BigInt(r.result as any);
            if (val > 0n) { directActive2++; directBusiness2 += val; }
          }
        }
      } catch (e: any) { console.error('Analytics multicall FAILED:', e.message?.slice(0, 100)); }
    }

    let activeTeamStakes = 0;
    const teamCalls = allTeamAddrs.map(addr => ({
      address: STAKING,
      abi: stakingAbi,
      functionName: 'getTotalActiveStakeValue' as const,
      args: [addr as `0x${string}`],
    }));
    try {
      const results = await client.multicall({ contracts: teamCalls });
      for (const r of results) {
        if (r.status === 'success' && BigInt(r.result as any) > 0n) activeTeamStakes++;
      }
    } catch (e: any) { console.error('Team multicall FAILED:', e.message?.slice(0, 100)); }

    console.log('\n=== FINAL ANALYTICS ===');
    console.log(`directTotal: ${directAddrs.length}`);
    console.log(`directActive: ${directActive2}`);
    console.log(`directBusiness: ${formatUnits(directBusiness2, 18)} USDT`);
    console.log(`totalTeamSize: ${allTeamAddrs.length}`);
    console.log(`activeTeamStakes: ${activeTeamStakes}`);
    console.log('Level stats:');
    for (let i = 1; i <= 15; i++) {
      const m = levelMembers.get(i)?.size || 0;
      const b = levelBusiness.get(i) || 0n;
      if (m > 0) console.log(`  Level ${i}: ${m} members, ${formatUnits(b, 18)} USDT business`);
    }
  } catch (err: any) {
    console.error('FULL BFS SIMULATION FAILED:', err.message?.slice(0, 300));
    console.error('Stack:', err.stack?.slice(0, 500));
  }
}

main().catch(console.error);

// Constructor args for CoreMembershipSubscription verification
// Constructor: (address _kairoToken, address _usdt, address _liquidityPool,
//               address _stakingManager, address _affiliateDistributor,
//               address _systemWallet, address _admin,
//               uint256 _subscribeDeadline, uint256 _claimDeadline)
module.exports = [
  "0x3DA7B98DE7085eda9b991fAD4762b274E9ADb496", // kairoToken
  "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3", // usdt
  "0xe3084fadF0db28F5f97162da1dde542a50cBc264", // liquidityPool
  "0xB6724041A765e0BE0B212dB57Ff317cCEF5A1EDd", // stakingManager
  "0xf53C1735e345dEBe19a3168BFE6AA3CC07FdBCD6", // affiliateDistributor
  "0x624D0985D844Cd1DF132723a9d849FE1A34cAf9D", // systemWallet
  "0x34277284E5Aa048eb4D7D09c297003875dA2A0F4", // admin (deployer)
  Math.floor(new Date("2026-05-16T00:00:00Z").getTime() / 1000), // subscribeDeadline
  Math.floor(new Date("2026-06-01T00:00:00Z").getTime() / 1000), // claimDeadline
];

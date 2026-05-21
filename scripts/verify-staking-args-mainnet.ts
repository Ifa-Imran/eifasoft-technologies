// Constructor args for StakingManager verification on opBNB mainnet
// Constructor: (address _kairoToken, address _liquidityPool, address _usdt, address _developmentFundWallet, address[7] _daoWallets, address _admin)
module.exports = [
  "0x8D01409fB9Adc19F5f1Fb7eD47c12D5A88051AeD", // kairoToken
  "0x26782184F8346832a2e0c84DEe09deFFF23DBf56", // liquidityPool
  "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3", // usdt
  "0x96c01bc3142eFB0379C96ac5157d04cA6ED1d796", // developmentFundWallet
  [
    "0x4465f4e53241c118a19d092d2495984f467a01a9", // DAO 1 (1%)
    "0x3c5bB7A176F2787de0A6Ae73C6Eff4Ff5dD63295", // DAO 2 (1%)
    "0xe3E3Ca6feD0F6Bd26B1E684854F2B7AFB49b2805", // DAO 3 (1%)
    "0x20d8cF481f06459FdFEAfF9219AD7a979eE06c32", // DAO 4 (0.5%)
    "0xBDAb83d8eb19b0454648Db15897796BCFBB2F9B7", // DAO 5 (0.5%)
    "0x12f25959b654F308BC1C5224bC856fCf50529e60", // DAO 6 (0.5%)
    "0x7DdD88D53A0FEBee5035C97461fba609880311A5", // DAO 7 (0.5%)
  ], // daoWallets
  "0x5f1DcDaBaa4df191C9faEf933583D6B7721b3268", // admin (deployer)
];

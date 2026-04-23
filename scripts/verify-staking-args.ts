// Constructor args for StakingManager verification
// Constructor: (address _kairoToken, address _liquidityPool, address _usdt, address _developmentFundWallet, address[6] _daoWallets, address _admin)
const deployer = "0x34277284E5Aa048eb4D7D09c297003875dA2A0F4";
module.exports = [
  "0x3DA7B98DE7085eda9b991fAD4762b274E9ADb496", // kairoToken
  "0xe3084fadF0db28F5f97162da1dde542a50cBc264", // liquidityPool
  "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3", // usdt
  "0x1bdbE7e3411E6439741335f1FC9fa37Adf385E07", // developmentFundWallet
  [
    "0x4465f4e53241c118a19d092d2495984f467a01a9",
    "0x3c5bB7A176F2787de0A6Ae73C6Eff4Ff5dD63295",
    "0xA91970AcA653591fd20231ad29ecCA0c7F691ceB",
    "0xe3E3Ca6feD0F6Bd26B1E684854F2B7AFB49b2805",
    "0x20d8cF481f06459FdFEAfF9219AD7a979eE06c32",
    "0xBDAb83d8eb19b0454648Db15897796BCFBB2F9B7",
  ], // daoWallets
  deployer, // admin
];

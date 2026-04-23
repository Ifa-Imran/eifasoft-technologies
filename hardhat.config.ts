import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    opbnbTestnet: {
      url: process.env.OPBNB_TESTNET_RPC || "https://opbnb-testnet-rpc.bnbchain.org",
      chainId: 5611,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 200000000, // 0.2 gwei
      timeout: 180000, // 3 minutes
      httpHeaders: {},
    },
    opbnbMainnet: {
      url: process.env.OPBNB_MAINNET_RPC || "https://opbnb-mainnet-rpc.bnbchain.org",
      chainId: 204,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 100000000, // 0.1 gwei
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  etherscan: {
    apiKey: "NICW8RM1VDUM6VHMZ5JWBUPR5689IT8H9H",
    customChains: [
      {
        network: "opbnbMainnet",
        chainId: 204,
        urls: {
          apiURL: "https://api-opbnb.bscscan.com/api",
          browserURL: "https://opbnbscan.com/",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
};

export default config;

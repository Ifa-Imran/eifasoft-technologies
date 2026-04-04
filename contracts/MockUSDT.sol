// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDT - Test USDT Token for opBNB Testnet
 * @dev Simple ERC20 token that anyone can mint for testing purposes
 */
contract MockUSDT is ERC20 {
    uint8 private _decimals = 18;

    constructor() ERC20("Test USDT", "USDT") {
        // Mint 1,000,000 USDT to deployer for initial liquidity
        _mint(msg.sender, 1_000_000 * 10**18);
    }

    /**
     * @dev Anyone can mint tokens for testing
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @dev Faucet function - mint 10,000 USDT to caller
     */
    function faucet() external {
        _mint(msg.sender, 10_000 * 10**18);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}

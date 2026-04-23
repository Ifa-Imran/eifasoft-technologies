// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDT - Test-only USDT Token (NOT for production)
 * @dev Simple ERC20 token that anyone can mint for testing purposes
 */
contract MockUSDT is ERC20 {
    uint8 private _decimals = 18;

    constructor() ERC20("Test USDT", "USDT") {
        _mint(msg.sender, 1_000_000 * 10**18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function faucet() external {
        _mint(msg.sender, 10_000 * 10**18);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}

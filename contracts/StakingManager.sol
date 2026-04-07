// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IKAIROToken - Interface for KAIRO token interactions
 */
interface IKAIROToken {
    function mint(address to, uint256 amount) external;
    function mintTo(address recipient, uint256 usdAmount) external;
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
    function getTotalBurned() external view returns (uint256);
    function getSocialLockAmount() external view returns (uint256);
    function getEffectiveSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title ILiquidityPool - Interface for LiquidityPool interactions
 */
interface ILiquidityPool {
    function getLivePrice() external view returns (uint256);
    function receiveStakingFunds(uint256 amount) external;
}

/**
 * @title IAffiliateDistributor - Interface for affiliate reward distribution
 */
interface IAffiliateDistributor {
    function distributeDirect(address _referrer, uint256 _stakeAmount) external;
    function distributeTeamDividend(address _staker, uint256 _profit) external;
    function addTeamVolume(address _staker, uint256 _amount) external;
    function removeTeamVolume(address _staker, uint256 _amount) external;
    function addProfit(uint256 _profit) external;
    function tryCloseEpochs() external;
    function genesisAccount() external view returns (address);
}

/**
 * @title StakingManager - Core Staking Engine for the KAIRO DeFi Ecosystem
 * @dev Implements a 3-tier staking system with 0.1% compounding per interval,
 *      3X hard cap auto-close, 80% return on unstake, and affiliate integration.
 *      Fully decentralized: all operations are user-triggered, no backend roles needed.
 *
 * Features:
 * - 3-tier system with different compound intervals (8h / 6h / 4h)
 * - 0.1% profit per compound interval
 * - 3X hard cap: FIFO model — all income types (compound, direct, team, rank,
 *   weekly/monthly qualifier, CMS loyalty/leadership) fill oldest stake first.
 *   When a stake's attributed earnings reach 3X originalAmount, it auto-closes.
 * - 80% return on unstake with harvested rewards deduction
 * - Fund distribution: 90% LP, 5% to 5 DAO wallets (1% each), 5% to development fund wallet
 * - Affiliate direct dividends (5%) and team dividends on compound
 * - Permissionless compounding: anyone can compound for anyone (time-gated)
 * - On-chain team volume propagation and profit tracking
 * - Pausable + ReentrancyGuard + AccessControl
 */
contract StakingManager is ReentrancyGuard, Pausable, AccessControl {
    // ============ Roles ============
    bytes32 public constant COMPOUNDER_ROLE = keccak256("COMPOUNDER_ROLE");

    // ============ Tier System ============
    struct Tier {
        uint256 min;               // minimum stake in USDT (18 decimals)
        uint256 max;               // maximum stake in USDT
        uint256 compoundInterval;  // in seconds: 28800, 21600, or 14400
        uint256 dailyClosings;     // 3, 4, or 6
    }

    Tier[3] public tiers;

    // ============ Stake Structure ============
    struct Stake {
        uint256 amount;            // Current stake amount in USDT value (18 decimals)
        uint256 originalAmount;    // Original stake amount (for 3X cap calculation)
        uint256 startTime;
        uint256 lastCompoundTime;
        uint256 harvestedRewards;  // Tracks harvested amounts (for unstake deduction)
        uint256 totalEarned;       // FIFO cap tracker (all income types attributed via FIFO)
        uint256 compoundEarned;    // Compound profit on THIS stake (for harvest)
        bool active;
        uint8 tier;
    }

    mapping(address => Stake[]) public userStakes;
    mapping(address => uint256) public totalActiveStakeValue;

    // ============ External Contract References ============
    IKAIROToken public kairoToken;
    ILiquidityPool public liquidityPool;
    IERC20 public usdt;
    address public affiliateDistributor;
    address public cmsContract;
    address public developmentFundWallet;
    address[5] public daoWallets;

    // ============ Constants ============
    uint256 public constant MIN_STAKE = 10 * 10 ** 18;       // 10 USDT minimum
    uint256 public constant MAX_STAKE = 2000 * 10 ** 18;     // 2000 USDT maximum per stake
    uint256 public constant MIN_HARVEST = 10 * 10 ** 18;     // $10 minimum harvest
    uint256 public constant PROFIT_NUMERATOR = 1;             // 0.1% = 1/1000
    uint256 public constant PROFIT_DENOMINATOR = 1000;
    uint256 public constant RETURN_PERCENT = 80;              // 80% return on unstake / auto-close
    uint256 public constant CAP_MULTIPLIER = 3;               // 3X hard cap

    // ============ Events ============
    event StakeCreated(address indexed user, uint256 stakeId, uint256 amount, uint8 tier);
    event Compounded(address indexed user, uint256 stakeId, uint256 profit, uint256 newAmount);
    event Unstaked(address indexed user, uint256 stakeId, uint256 returnAmount);
    event CapReached(address indexed user, uint256 stakeId, uint256 totalEarned);
    event Harvested(address indexed user, uint256 stakeId, uint256 amount);
    event AffiliateDistributorSet(address indexed distributor);
    event DevelopmentFundWalletSet(address indexed wallet);
    event DaoWalletsSet(address[5] wallets);
    event CMSSet(address indexed cms);
    event EarningsApplied(address indexed user, uint256 amount);

    // ============ Constructor ============
    constructor(
        address _kairoToken,
        address _liquidityPool,
        address _usdt,
        address _developmentFundWallet,
        address[5] memory _daoWallets,
        address _admin
    ) {
        require(_kairoToken != address(0), "StakingManager: Invalid KAIRO token");
        require(_liquidityPool != address(0), "StakingManager: Invalid LiquidityPool");
        require(_usdt != address(0), "StakingManager: Invalid USDT");
        require(_developmentFundWallet != address(0), "StakingManager: Invalid development fund wallet");
        require(_admin != address(0), "StakingManager: Invalid admin");

        for (uint256 i = 0; i < 5; i++) {
            require(_daoWallets[i] != address(0), "StakingManager: Invalid DAO wallet");
        }

        kairoToken = IKAIROToken(_kairoToken);
        liquidityPool = ILiquidityPool(_liquidityPool);
        usdt = IERC20(_usdt);
        developmentFundWallet = _developmentFundWallet;
        daoWallets = _daoWallets;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        // Tier 0: 10-499 USDT, 15 minutes (900s) TESTING
        tiers[0] = Tier(10 * 10 ** 18, 499 * 10 ** 18, 900, 3);
        // Tier 1: 500-1999 USDT, 10 minutes (600s) TESTING
        tiers[1] = Tier(500 * 10 ** 18, 1999 * 10 ** 18, 600, 4);
        // Tier 2: 2000+ USDT, 5 minutes (300s) TESTING
        tiers[2] = Tier(2000 * 10 ** 18, type(uint256).max, 300, 6);
    }

    // ============ Core Functions ============

    /**
     * @dev Stake USDT into the staking system
     * @param _usdtAmount Amount of USDT to stake (18 decimals)
     * @param _referrer Referrer address for affiliate dividends
     */
    function stake(uint256 _usdtAmount, address _referrer) external nonReentrant whenNotPaused {
        require(_usdtAmount >= MIN_STAKE, "StakingManager: Below minimum stake");
        require(_usdtAmount <= MAX_STAKE, "StakingManager: Above maximum stake (2000 USDT)");
        require(_referrer != address(0), "StakingManager: Referrer required");
        require(_referrer != msg.sender, "StakingManager: No self-referral");

        // Genesis account (first registered, root of referral tree) cannot stake
        if (affiliateDistributor != address(0)) {
            require(
                msg.sender != IAffiliateDistributor(affiliateDistributor).genesisAccount(),
                "StakingManager: Genesis account cannot stake"
            );
        }

        // Auto-detect tier
        uint8 tierIndex = _detectTier(_usdtAmount);

        // Transfer USDT from user to this contract
        require(usdt.transferFrom(msg.sender, address(this), _usdtAmount), "StakingManager: USDT transfer failed");

        // --- Fund Distribution: 90% LP, 5% DAO wallets, 5% support wallet ---

        // Forward 90% of staking funds to LiquidityPool for liquidity backing
        uint256 liquidityPoolShare = (_usdtAmount * 90) / 100;
        require(usdt.approve(address(liquidityPool), liquidityPoolShare), "StakingManager: USDT approve failed");
        require(usdt.transfer(address(liquidityPool), liquidityPoolShare), "StakingManager: LiquidityPool transfer failed");
        liquidityPool.receiveStakingFunds(liquidityPoolShare);

        // Forward 5% split equally to 5 DAO wallets (1% each)
        uint256 daoSharePerWallet = (_usdtAmount * 1) / 100;
        for (uint256 i = 0; i < 5; i++) {
            require(usdt.transfer(daoWallets[i], daoSharePerWallet), "StakingManager: DAO wallet transfer failed");
        }

        // Forward 5% to development fund wallet
        uint256 developmentFundShare = (_usdtAmount * 5) / 100;
        require(usdt.transfer(developmentFundWallet, developmentFundShare), "StakingManager: Development fund transfer failed");

        // Create new stake
        uint256 stakeId = userStakes[msg.sender].length;
        userStakes[msg.sender].push(Stake({
            amount: _usdtAmount,
            originalAmount: _usdtAmount,
            startTime: block.timestamp,
            lastCompoundTime: block.timestamp,
            harvestedRewards: 0,
            totalEarned: 0,
            compoundEarned: 0,
            active: true,
            tier: tierIndex
        }));

        totalActiveStakeValue[msg.sender] += _usdtAmount;

        // Distribute 5% direct dividend to referrer via AffiliateDistributor
        if (affiliateDistributor != address(0)) {
            IAffiliateDistributor(affiliateDistributor).distributeDirect(_referrer, _usdtAmount);
        }

        emit StakeCreated(msg.sender, stakeId, _usdtAmount, tierIndex);

        // Propagate team volume to ancestors & trigger epoch closings
        if (affiliateDistributor != address(0)) {
            IAffiliateDistributor(affiliateDistributor).addTeamVolume(msg.sender, _usdtAmount);
            IAffiliateDistributor(affiliateDistributor).tryCloseEpochs();
        }
    }

    /**
     * @dev Compound accumulated profits for a specific stake
     * @param _stakeId Index of the stake to compound
     */
    function compound(uint256 _stakeId) external nonReentrant whenNotPaused {
        _compound(msg.sender, _stakeId);
    }

    /**
     * @dev Compound on behalf of any user (permissionless, time-gated on-chain)
     * @param _user Address of the stake owner
     * @param _stakeId Index of the stake to compound
     */
    function compoundFor(address _user, uint256 _stakeId) external nonReentrant whenNotPaused {
        require(_user != address(0), "StakingManager: Invalid user");
        _compound(_user, _stakeId);
    }

    /**
     * @dev Internal compound logic with FIFO cap integration
     * @param _user Stake owner
     * @param _stakeId Index of the stake
     */
    function _compound(address _user, uint256 _stakeId) internal {
        require(_stakeId < userStakes[_user].length, "StakingManager: Invalid stake ID");
        Stake storage stk = userStakes[_user][_stakeId];
        require(stk.active, "StakingManager: Stake not active");

        Tier memory tier = tiers[stk.tier];

        // Calculate intervals passed since last compound
        uint256 elapsed = block.timestamp - stk.lastCompoundTime;
        uint256 intervals = elapsed / tier.compoundInterval;

        require(intervals > 0, "StakingManager: No intervals passed");

        uint256 totalProfit = 0;
        uint256 currentAmount = stk.amount;

        for (uint256 i = 0; i < intervals; i++) {
            uint256 profit = (currentAmount * PROFIT_NUMERATOR) / PROFIT_DENOMINATOR;
            currentAmount += profit;
            totalProfit += profit;
        }

        // Cap compound profit against total remaining FIFO cap across all active stakes
        uint256 remainingCap = _getTotalRemainingCap(_user);
        if (totalProfit > remainingCap) {
            totalProfit = remainingCap;
            currentAmount = stk.amount + totalProfit;
        }

        // Update stake's amount and compound tracking
        stk.amount = currentAmount;
        stk.compoundEarned += totalProfit;
        stk.lastCompoundTime += intervals * tier.compoundInterval;

        // Update totalActiveStakeValue with the profit added
        totalActiveStakeValue[_user] += totalProfit;

        // Apply compound profit to FIFO cap (may auto-close oldest stakes)
        if (totalProfit > 0) {
            _applyEarningsToFIFO(_user, totalProfit);
        }

        // Distribute team dividends and track profits via AffiliateDistributor
        if (affiliateDistributor != address(0) && totalProfit > 0) {
            IAffiliateDistributor(affiliateDistributor).distributeTeamDividend(_user, totalProfit);
            IAffiliateDistributor(affiliateDistributor).addProfit(totalProfit);
        }

        // Trigger epoch closings
        if (affiliateDistributor != address(0)) {
            IAffiliateDistributor(affiliateDistributor).tryCloseEpochs();
        }

        emit Compounded(_user, _stakeId, totalProfit, stk.amount);
    }

    /**
     * @dev Auto-close a stake when 3X cap is reached
     * @param _user Stake owner
     * @param _stakeId Index of the stake
     */
    function _autoCloseStake(address _user, uint256 _stakeId) internal {
        Stake storage stk = userStakes[_user][_stakeId];

        uint256 returnAmount = (stk.amount * RETURN_PERCENT) / 100;

        // Mint KAIRO to user at live rate (USD value → KAIRO)
        if (returnAmount > 0) {
            kairoToken.mintTo(_user, returnAmount);
        }

        // Remove team volume from ancestors on auto-close
        if (affiliateDistributor != address(0)) {
            IAffiliateDistributor(affiliateDistributor).removeTeamVolume(_user, stk.originalAmount);
        }

        // Mark stake inactive
        stk.active = false;
        totalActiveStakeValue[_user] -= stk.amount;

        emit CapReached(_user, _stakeId, stk.totalEarned);
    }

    /**
     * @dev Unstake and receive 80% of current stake value as KAIRO.
     *      Harvested amounts already reduce stk.amount, so no double-deduction needed.
     * @param _stakeId Index of the stake to unstake
     */
    function unstake(uint256 _stakeId) external nonReentrant {
        require(_stakeId < userStakes[msg.sender].length, "StakingManager: Invalid stake ID");
        Stake storage stk = userStakes[msg.sender][_stakeId];
        require(stk.active, "StakingManager: Stake not active");

        // stk.amount already reflects deductions from harvesting
        uint256 returnAmount = (stk.amount * RETURN_PERCENT) / 100;

        // Mint KAIRO to user at live rate (USD value → KAIRO)
        if (returnAmount > 0) {
            kairoToken.mintTo(msg.sender, returnAmount);
        }

        // Remove team volume from ancestors & trigger epoch closings
        if (affiliateDistributor != address(0)) {
            IAffiliateDistributor(affiliateDistributor).removeTeamVolume(msg.sender, stk.originalAmount);
            IAffiliateDistributor(affiliateDistributor).tryCloseEpochs();
        }

        // Mark stake inactive
        totalActiveStakeValue[msg.sender] -= stk.amount;
        stk.active = false;

        // Unharvested earnings are forfeited
        emit Unstaked(msg.sender, _stakeId, returnAmount);
    }

    /**
     * @dev Harvest accumulated compound rewards from a stake
     * @param _stakeId Index of the stake
     * @param _amount USD amount to harvest (18 decimals)
     */
    function harvest(uint256 _stakeId, uint256 _amount) external nonReentrant whenNotPaused {
        require(_stakeId < userStakes[msg.sender].length, "StakingManager: Invalid stake ID");
        require(_amount >= MIN_HARVEST, "StakingManager: Below minimum harvest ($10)");

        // Trigger epoch closings
        if (affiliateDistributor != address(0)) {
            IAffiliateDistributor(affiliateDistributor).tryCloseEpochs();
        }

        Stake storage stk = userStakes[msg.sender][_stakeId];
        require(stk.active, "StakingManager: Stake not active");

        // Available to harvest = compoundEarned - harvestedRewards
        uint256 available = stk.compoundEarned - stk.harvestedRewards;
        require(_amount <= available, "StakingManager: Insufficient harvestable amount");

        // Track harvested amount and reduce compounding base
        stk.harvestedRewards += _amount;
        stk.amount -= _amount;
        totalActiveStakeValue[msg.sender] -= _amount;

        // Mint KAIRO to user at live rate
        kairoToken.mintTo(msg.sender, _amount);

        emit Harvested(msg.sender, _stakeId, _amount);
    }

    // ============ External Earnings (called by AffiliateDistributor & CMS) ============

    /**
     * @dev Report external earnings to the FIFO 3X cap system.
     *      Called by AffiliateDistributor and CMS when income is accrued.
     * @param _user User whose earnings are being reported
     * @param _usdAmount USD value of the earnings (18 decimals)
     */
    function addEarnings(address _user, uint256 _usdAmount) external {
        require(
            msg.sender == affiliateDistributor || msg.sender == cmsContract,
            "StakingManager: Unauthorized"
        );
        if (_usdAmount == 0) return;
        _applyEarningsToFIFO(_user, _usdAmount);
        emit EarningsApplied(_user, _usdAmount);
    }

    // ============ View Functions ============

    /**
     * @dev Get all stakes for a user
     * @param _user User address
     * @return Array of Stake structs
     */
    function getUserStakes(address _user) external view returns (Stake[] memory) {
        return userStakes[_user];
    }

    /**
     * @dev Get a specific stake for a user
     * @param _user User address
     * @param _stakeId Stake index
     * @return Stake struct
     */
    function getStake(address _user, uint256 _stakeId) external view returns (Stake memory) {
        require(_stakeId < userStakes[_user].length, "StakingManager: Invalid stake ID");
        return userStakes[_user][_stakeId];
    }

    /**
     * @dev Get total active stake value for a user
     * @param _user User address
     * @return Total active stake value in USDT (18 decimals)
     */
    function getTotalActiveStakeValue(address _user) external view returns (uint256) {
        return totalActiveStakeValue[_user];
    }

    /**
     * @dev Get 3X cap progress for a specific stake
     * @param _user User address
     * @param _stakeId Stake index
     * @return earned Total earned so far
     * @return cap Maximum earnable (3X original)
     */
    function getCapProgress(address _user, uint256 _stakeId) external view returns (uint256 earned, uint256 cap) {
        require(_stakeId < userStakes[_user].length, "StakingManager: Invalid stake ID");
        Stake memory stk = userStakes[_user][_stakeId];
        earned = stk.totalEarned;
        cap = CAP_MULTIPLIER * stk.originalAmount;
    }

    /**
     * @dev Get global FIFO cap progress across all active stakes
     * @param _user User address
     * @return totalEarned Sum of totalEarned across active stakes
     * @return totalCap Sum of 3X caps across active stakes
     * @return remaining Remaining earnable amount before all stakes cap
     */
    function getGlobalCapProgress(address _user) external view returns (
        uint256 totalEarned, uint256 totalCap, uint256 remaining
    ) {
        for (uint256 i = 0; i < userStakes[_user].length; i++) {
            if (!userStakes[_user][i].active) continue;
            totalEarned += userStakes[_user][i].totalEarned;
            totalCap += CAP_MULTIPLIER * userStakes[_user][i].originalAmount;
        }
        remaining = totalCap > totalEarned ? totalCap - totalEarned : 0;
    }

    /**
     * @dev Get remaining FIFO cap across all active stakes
     * @param _user User address
     * @return Remaining earnable amount before all stakes cap out
     */
    function getRemainingCap(address _user) external view returns (uint256) {
        return _getTotalRemainingCap(_user);
    }

    /**
     * @dev Get the number of stakes for a user
     * @param _user User address
     * @return Number of stakes
     */
    function getUserStakeCount(address _user) external view returns (uint256) {
        return userStakes[_user].length;
    }

    // ============ Admin Functions ============

    /**
     * @dev Set the AffiliateDistributor contract address
     * @param _affiliate AffiliateDistributor contract address
     */
    function setAffiliateDistributor(address _affiliate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_affiliate != address(0), "StakingManager: Invalid affiliate address");
        affiliateDistributor = _affiliate;
        emit AffiliateDistributorSet(_affiliate);
    }

    /**
     * @dev Set the CMS contract address (for addEarnings authorization)
     * @param _cms CMS contract address
     */
    function setCMS(address _cms) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_cms != address(0), "StakingManager: Invalid CMS address");
        cmsContract = _cms;
        emit CMSSet(_cms);
    }

    /**
     * @dev Set the development fund wallet address
     * @param _wallet Development fund wallet address
     */
    function setDevelopmentFundWallet(address _wallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_wallet != address(0), "StakingManager: Invalid wallet address");
        developmentFundWallet = _wallet;
        emit DevelopmentFundWalletSet(_wallet);
    }

    /**
     * @dev Set the 5 DAO wallet addresses
     * @param _daoWallets Array of 5 DAO wallet addresses
     */
    function setDaoWallets(address[5] calldata _daoWallets) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < 5; i++) {
            require(_daoWallets[i] != address(0), "StakingManager: Invalid DAO wallet");
        }
        daoWallets = _daoWallets;
        emit DaoWalletsSet(_daoWallets);
    }

    /**
     * @dev Get all 5 DAO wallet addresses
     * @return Array of 5 DAO wallet addresses
     */
    function getDaoWallets() external view returns (address[5] memory) {
        return daoWallets;
    }

    /**
     * @dev Pause the contract (emergency stop)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ============ Internal Functions ============

    /**
     * @dev Apply earnings to active stakes using FIFO order (oldest first).
     *      When a stake's totalEarned reaches 3X originalAmount, it auto-closes
     *      and remaining earnings roll to the next active stake.
     */
    function _applyEarningsToFIFO(address _user, uint256 _amount) internal {
        uint256 remaining = _amount;
        for (uint256 i = 0; i < userStakes[_user].length && remaining > 0; i++) {
            Stake storage stk = userStakes[_user][i];
            if (!stk.active) continue;

            uint256 cap = CAP_MULTIPLIER * stk.originalAmount;
            if (stk.totalEarned >= cap) continue;

            uint256 space = cap - stk.totalEarned;
            uint256 toApply = remaining > space ? space : remaining;

            stk.totalEarned += toApply;
            remaining -= toApply;

            if (stk.totalEarned >= cap) {
                _autoCloseStake(_user, i);
            }
        }
    }

    /**
     * @dev Calculate total remaining cap across all active stakes.
     *      Used to cap compound profit so it doesn't exceed what can be absorbed.
     */
    function _getTotalRemainingCap(address _user) internal view returns (uint256) {
        uint256 remaining = 0;
        for (uint256 i = 0; i < userStakes[_user].length; i++) {
            if (!userStakes[_user][i].active) continue;
            uint256 cap = CAP_MULTIPLIER * userStakes[_user][i].originalAmount;
            if (userStakes[_user][i].totalEarned < cap) {
                remaining += cap - userStakes[_user][i].totalEarned;
            }
        }
        return remaining;
    }

    /**
     * @dev Auto-detect tier based on USDT stake amount
     * @param _amount USDT amount (18 decimals)
     * @return tierIndex Tier index (0, 1, or 2)
     */
    function _detectTier(uint256 _amount) internal view returns (uint8) {
        for (uint8 i = 2; i > 0; i--) {
            if (_amount >= tiers[i].min) {
                return i;
            }
        }
        return 0;
    }
}

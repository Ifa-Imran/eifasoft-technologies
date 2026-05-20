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
    function genesisAccount() external view returns (address);
}

contract StakingManager is ReentrancyGuard, Pausable, AccessControl {
    bytes32 public constant INCOME_RECORDER_ROLE = keccak256("INCOME_RECORDER_ROLE");

    struct Tier {
        uint256 min;
        uint256 max;
        uint256 compoundInterval;  // TESTNET 180/120/60 (prod: 28800/21600/18000)
        uint256 dailyClosings;
    }

    Tier[3] public tiers;

    struct Stake {
        uint256 amount;
        uint256 originalAmount;
        uint256 startTime;
        uint256 lastCompoundTime;
        uint256 harvestedRewards;
        uint256 totalEarned;
        uint256 compoundEarned;
        bool active;
        uint8 tier;
        bool isMigrated;
    }

    mapping(address => Stake[]) public userStakes;
    mapping(address => uint256) public totalActiveStakeValue;

    address[] private allStakers;
    mapping(address => bool) private isStaker;

    IKAIROToken public kairoToken;
    ILiquidityPool public liquidityPool;
    IERC20 public usdt;
    address public affiliateDistributor;
    address public cmsContract;
    address public developmentFundWallet;
    address[6] public daoWallets;

    mapping(address => bool) public autoCompoundEnabled;

    mapping(address => uint256) public totalIncomeClaimedUsd;
    mapping(address => uint256) public totalIncomeDeductedUsd;

    bool public migrationFinalized;

    uint256 public constant MIN_STAKE = 10 * 10 ** 18;
    uint256 public constant MAX_STAKE = type(uint256).max;
    uint256 public constant MIN_HARVEST = 10 * 10 ** 18;
    uint256 public constant PROFIT_NUMERATOR = 15;
    uint256 public constant PROFIT_DENOMINATOR = 10000;
    uint256 public constant RETURN_PERCENT = 80;
    uint256 public constant CAP_MULTIPLIER = 3;

    event StakeCreated(address indexed user, uint256 stakeId, uint256 amount, uint8 tier);
    event Compounded(address indexed user, uint256 stakeId, uint256 profit, uint256 newAmount);
    event Unstaked(address indexed user, uint256 stakeId, uint256 returnAmount);
    event StakeCapped(address indexed user, uint256 stakeId, uint256 totalHarvested);
    event Harvested(address indexed user, uint256 stakeId, uint256 amount);
    event TierUpdated(address indexed user, uint8 newTier);
    event AffiliateDistributorSet(address indexed distributor);
    event DevelopmentFundWalletSet(address indexed wallet);
    event DaoWalletsSet(address[6] wallets);
    event CMSSet(address indexed cms);
    event CappedHarvestApplied(address indexed user, uint256 requested, uint256 applied);
    event AutoCompoundToggled(address indexed user, bool enabled);
    event IncomeClaimRecorded(address indexed user, uint256 usdAmount, uint256 totalClaimed);
    event StakeMigrated(address indexed user, uint256 stakeId, uint256 principal);
    event MigrationFinalized();

    constructor(
        address _kairoToken,
        address _liquidityPool,
        address _usdt,
        address _developmentFundWallet,
        address[6] memory _daoWallets,
        address _admin
    ) {
        require(_kairoToken != address(0), "StakingManager: Invalid KAIRO token");
        require(_liquidityPool != address(0), "StakingManager: Invalid LiquidityPool");
        require(_usdt != address(0), "StakingManager: Invalid USDT");
        require(_developmentFundWallet != address(0), "StakingManager: Invalid development fund wallet");
        require(_admin != address(0), "StakingManager: Invalid admin");

        for (uint256 i = 0; i < 6; i++) {
            require(_daoWallets[i] != address(0), "StakingManager: Invalid DAO wallet");
        }

        kairoToken = IKAIROToken(_kairoToken);
        liquidityPool = ILiquidityPool(_liquidityPool);
        usdt = IERC20(_usdt);
        developmentFundWallet = _developmentFundWallet;
        daoWallets = _daoWallets;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        // Tier 0: 10-499 USDT, 3 minutes (180s) TESTNET (prod 28800s)
        tiers[0] = Tier(10 * 10 ** 18, 499 * 10 ** 18, 180, 3);
        // Tier 1: 500-1999 USDT, 2 minutes (120s) TESTNET (prod 21600s)
        tiers[1] = Tier(500 * 10 ** 18, 1999 * 10 ** 18, 120, 4);
        // Tier 2: 2000+ USDT, 1 minute (60s) TESTNET (prod 18000s)
        tiers[2] = Tier(2000 * 10 ** 18, type(uint256).max, 60, 4);
    }

    function stake(uint256 _usdtAmount, address _referrer) external nonReentrant whenNotPaused {
        require(_usdtAmount >= MIN_STAKE, "StakingManager: Below minimum stake");
        require(_referrer != address(0), "StakingManager: Referrer required");
        require(_referrer != msg.sender, "StakingManager: No self-referral");

        if (affiliateDistributor != address(0)) {
            require(
                msg.sender != IAffiliateDistributor(affiliateDistributor).genesisAccount(),
                "StakingManager: Genesis account cannot stake"
            );
        }

        if (autoCompoundEnabled[msg.sender]) {
            _autoCompoundAll(msg.sender);
        }

        require(usdt.transferFrom(msg.sender, address(this), _usdtAmount), "StakingManager: USDT transfer failed");

        uint256 liquidityPoolShare = (_usdtAmount * 90) / 100;
        require(usdt.transfer(address(liquidityPool), liquidityPoolShare), "StakingManager: LiquidityPool transfer failed");
        liquidityPool.receiveStakingFunds(liquidityPoolShare);

        for (uint256 i = 0; i < 4; i++) {
            uint256 daoSharePerWallet = (_usdtAmount * 1) / 100;
            require(usdt.transfer(daoWallets[i], daoSharePerWallet), "StakingManager: DAO wallet transfer failed");
        }
        for (uint256 i = 4; i < 6; i++) {
            uint256 daoSharePerWallet = (_usdtAmount * 5) / 1000;
            require(usdt.transfer(daoWallets[i], daoSharePerWallet), "StakingManager: DAO wallet transfer failed");
        }

        uint256 developmentFundShare = (_usdtAmount * 5) / 100;
        require(usdt.transfer(developmentFundWallet, developmentFundShare), "StakingManager: Development fund transfer failed");

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
            tier: 0,
            isMigrated: false
        }));

        totalActiveStakeValue[msg.sender] += _usdtAmount;

        if (!isStaker[msg.sender]) {
            allStakers.push(msg.sender);
            isStaker[msg.sender] = true;
        }

        uint8 tierIndex = _detectTier(totalActiveStakeValue[msg.sender]);
        _updateAllStakeTiers(msg.sender);

        if (affiliateDistributor != address(0)) {
            IAffiliateDistributor(affiliateDistributor).distributeDirect(_referrer, _usdtAmount);
        }

        emit StakeCreated(msg.sender, stakeId, _usdtAmount, tierIndex);

        if (affiliateDistributor != address(0)) {
            IAffiliateDistributor(affiliateDistributor).addTeamVolume(msg.sender, _usdtAmount);
        }
    }

    function compound(uint256 _stakeId) external nonReentrant whenNotPaused {
        _compound(msg.sender, _stakeId);
    }

    function compoundFor(address _user, uint256 _stakeId) external nonReentrant whenNotPaused {
        _compound(_user, _stakeId);
    }

    function compoundAllFor(address _user) external nonReentrant whenNotPaused {
        _autoCompoundAll(_user);
    }

    function setAutoCompound(bool _enabled) external {
        autoCompoundEnabled[msg.sender] = _enabled;
        emit AutoCompoundToggled(msg.sender, _enabled);
    }

    function _compound(address _user, uint256 _stakeId) internal {
        require(_stakeId < userStakes[_user].length, "StakingManager: Invalid stake ID");
        Stake storage stk = userStakes[_user][_stakeId];
        require(stk.active, "StakingManager: Stake not active");

        Tier memory tier = tiers[stk.tier];

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

        stk.amount = currentAmount;
        stk.compoundEarned += totalProfit;
        stk.lastCompoundTime += intervals * tier.compoundInterval;

        totalActiveStakeValue[_user] += totalProfit;

        if (affiliateDistributor != address(0) && totalProfit > 0) {
            IAffiliateDistributor(affiliateDistributor).distributeTeamDividend(_user, totalProfit);
        }

        emit Compounded(_user, _stakeId, totalProfit, stk.amount);
    }

    function _autoCompoundAll(address _user) internal {
        for (uint256 i = 0; i < userStakes[_user].length; i++) {
            Stake storage stk = userStakes[_user][i];
            if (!stk.active) continue;

            Tier memory tier = tiers[stk.tier];
            uint256 elapsed = block.timestamp - stk.lastCompoundTime;
            uint256 intervals = elapsed / tier.compoundInterval;
            if (intervals == 0) continue;

            uint256 totalProfit = 0;
            uint256 currentAmount = stk.amount;
            for (uint256 j = 0; j < intervals; j++) {
                uint256 profit = (currentAmount * PROFIT_NUMERATOR) / PROFIT_DENOMINATOR;
                currentAmount += profit;
                totalProfit += profit;
            }

            stk.amount = currentAmount;
            stk.compoundEarned += totalProfit;
            stk.lastCompoundTime += intervals * tier.compoundInterval;
            totalActiveStakeValue[_user] += totalProfit;

            if (affiliateDistributor != address(0) && totalProfit > 0) {
                IAffiliateDistributor(affiliateDistributor).distributeTeamDividend(_user, totalProfit);
            }

            emit Compounded(_user, i, totalProfit, stk.amount);
        }
    }

    function _markStakeCapped(address _user, uint256 _stakeId) internal {
        Stake storage stk = userStakes[_user][_stakeId];
        stk.active = false;
        if (totalActiveStakeValue[_user] >= stk.amount) {
            totalActiveStakeValue[_user] -= stk.amount;
        } else {
            totalActiveStakeValue[_user] = 0;
        }
        emit StakeCapped(_user, _stakeId, stk.totalEarned);
        _updateAllStakeTiers(_user);
    }

    function unstake(uint256 _stakeId) external nonReentrant {
        if (autoCompoundEnabled[msg.sender]) {
            _autoCompoundAll(msg.sender);
        }

        require(_stakeId < userStakes[msg.sender].length, "StakingManager: Invalid stake ID");
        Stake storage stk = userStakes[msg.sender][_stakeId];
        require(stk.active, "StakingManager: Stake not active");
        require(!stk.isMigrated, "StakingManager: Migrated stakes are locked");

        uint256 gross = (stk.originalAmount * RETURN_PERCENT) / 100;

        uint256 outstandingClaimed = totalIncomeClaimedUsd[msg.sender] > totalIncomeDeductedUsd[msg.sender]
            ? totalIncomeClaimedUsd[msg.sender] - totalIncomeDeductedUsd[msg.sender]
            : 0;
        uint256 deduction = outstandingClaimed > gross ? gross : outstandingClaimed;
        uint256 returnAmount = gross - deduction;
        totalIncomeDeductedUsd[msg.sender] += deduction;

        if (returnAmount > 0) {
            kairoToken.mintTo(msg.sender, returnAmount);
        }

        if (affiliateDistributor != address(0)) {
            IAffiliateDistributor(affiliateDistributor).removeTeamVolume(msg.sender, stk.originalAmount);
        }

        if (totalActiveStakeValue[msg.sender] >= stk.amount) {
            totalActiveStakeValue[msg.sender] -= stk.amount;
        } else {
            totalActiveStakeValue[msg.sender] = 0;
        }
        stk.active = false;

        _updateAllStakeTiers(msg.sender);

        emit Unstaked(msg.sender, _stakeId, returnAmount);
    }

    function harvest(uint256 _stakeId, uint256 _amount) external nonReentrant whenNotPaused {
        if (autoCompoundEnabled[msg.sender]) {
            _autoCompoundAll(msg.sender);
        }

        require(_stakeId < userStakes[msg.sender].length, "StakingManager: Invalid stake ID");
        require(_amount >= MIN_HARVEST, "StakingManager: Below minimum harvest ($10)");

        Stake storage stk = userStakes[msg.sender][_stakeId];
        require(stk.active, "StakingManager: Stake not active");

        uint256 available = stk.compoundEarned - stk.harvestedRewards;
        require(_amount <= available, "StakingManager: Insufficient harvestable amount");

        _applyHarvestToFIFO(msg.sender, _amount);

        stk.harvestedRewards += _amount;

        if (stk.active) {
            stk.amount -= _amount;
            totalActiveStakeValue[msg.sender] -= _amount;
        } else {
            if (stk.amount >= _amount) {
                stk.amount -= _amount;
            } else {
                stk.amount = 0;
            }
        }

        totalIncomeClaimedUsd[msg.sender] += _amount;
        emit IncomeClaimRecorded(msg.sender, _amount, totalIncomeClaimedUsd[msg.sender]);

        kairoToken.mintTo(msg.sender, _amount);

        emit Harvested(msg.sender, _stakeId, _amount);
    }

    function applyCappedHarvest(address _user, uint256 _usdAmount) external returns (uint256 applied) {
        require(
            msg.sender == affiliateDistributor || msg.sender == cmsContract,
            "StakingManager: Unauthorized"
        );
        if (_usdAmount == 0) return 0;
        _applyHarvestToFIFO(_user, _usdAmount);
        applied = _usdAmount;
        emit CappedHarvestApplied(_user, _usdAmount, applied);
    }

    function recordIncomeClaim(address _user, uint256 _usdAmount) external onlyRole(INCOME_RECORDER_ROLE) {
        if (_usdAmount == 0) return;
        totalIncomeClaimedUsd[_user] += _usdAmount;
        emit IncomeClaimRecorded(_user, _usdAmount, totalIncomeClaimedUsd[_user]);
    }

    function hasActivePosition(address _user) external view returns (bool) {
        for (uint256 i = 0; i < userStakes[_user].length; i++) {
            if (userStakes[_user][i].active) return true;
        }
        return false;
    }

    function migrateStakes(address[] calldata users, uint256[] calldata principals)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(!migrationFinalized, "StakingManager: Migration finalized");
        require(users.length == principals.length, "StakingManager: Length mismatch");

        for (uint256 i = 0; i < users.length; i++) {
            address u = users[i];
            uint256 p = principals[i];
            if (u == address(0) || p == 0) continue;

            uint8 t = _detectTier(p);
            userStakes[u].push(Stake({
                amount: p,
                originalAmount: p,
                startTime: block.timestamp,
                lastCompoundTime: block.timestamp,
                harvestedRewards: 0,
                totalEarned: 0,
                compoundEarned: 0,
                active: true,
                tier: t,
                isMigrated: true
            }));

            totalActiveStakeValue[u] += p;
            if (!isStaker[u]) {
                allStakers.push(u);
                isStaker[u] = true;
            }
            _updateAllStakeTiers(u);

            emit StakeMigrated(u, userStakes[u].length - 1, p);
        }
    }

    function finalizeMigration() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!migrationFinalized, "StakingManager: Already finalized");
        migrationFinalized = true;
        emit MigrationFinalized();
    }

    function getUserStakes(address _user) external view returns (Stake[] memory) {
        return userStakes[_user];
    }

    function getStake(address _user, uint256 _stakeId) external view returns (Stake memory) {
        require(_stakeId < userStakes[_user].length, "StakingManager: Invalid stake ID");
        return userStakes[_user][_stakeId];
    }

    function getTotalActiveStakeValue(address _user) external view returns (uint256) {
        return totalActiveStakeValue[_user];
    }

    function getCapProgress(address _user, uint256 _stakeId) external view returns (uint256 harvested, uint256 cap) {
        require(_stakeId < userStakes[_user].length, "StakingManager: Invalid stake ID");
        Stake memory stk = userStakes[_user][_stakeId];
        harvested = stk.totalEarned;
        cap = CAP_MULTIPLIER * stk.originalAmount;
    }

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

    function getRemainingCap(address _user) external view returns (uint256) {
        return _getTotalRemainingCap(_user);
    }

    function getUserStakeCount(address _user) external view returns (uint256) {
        return userStakes[_user].length;
    }

    function previewUnstake(address _user, uint256 _stakeId) external view returns (uint256) {
        if (_stakeId >= userStakes[_user].length) return 0;
        Stake memory stk = userStakes[_user][_stakeId];
        if (!stk.active) return 0;
        if (stk.isMigrated) return 0;
        uint256 gross = (stk.originalAmount * RETURN_PERCENT) / 100;
        uint256 outstanding = totalIncomeClaimedUsd[_user] > totalIncomeDeductedUsd[_user]
            ? totalIncomeClaimedUsd[_user] - totalIncomeDeductedUsd[_user]
            : 0;
        uint256 deduction = outstanding > gross ? gross : outstanding;
        return gross - deduction;
    }

    function setAffiliateDistributor(address _affiliate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_affiliate != address(0), "StakingManager: Invalid affiliate address");
        affiliateDistributor = _affiliate;
        _grantRole(INCOME_RECORDER_ROLE, _affiliate);
        emit AffiliateDistributorSet(_affiliate);
    }

    function setCMS(address _cms) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_cms != address(0), "StakingManager: Invalid CMS address");
        cmsContract = _cms;
        _grantRole(INCOME_RECORDER_ROLE, _cms);
        emit CMSSet(_cms);
    }

    function setDevelopmentFundWallet(address _wallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_wallet != address(0), "StakingManager: Invalid wallet address");
        developmentFundWallet = _wallet;
        emit DevelopmentFundWalletSet(_wallet);
    }

    function setDaoWallets(address[6] calldata _daoWallets) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < 6; i++) {
            require(_daoWallets[i] != address(0), "StakingManager: Invalid DAO wallet");
        }
        daoWallets = _daoWallets;
        emit DaoWalletsSet(_daoWallets);
    }

    function getDaoWallets() external view returns (address[6] memory) {
        return daoWallets;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _applyHarvestToFIFO(address _user, uint256 _amount) internal returns (uint256 applied) {
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
                _markStakeCapped(_user, i);
            }
        }
        applied = _amount - remaining;
    }

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

    function _updateAllStakeTiers(address _user) internal {
        uint8 newTier = _detectTier(totalActiveStakeValue[_user]);
        for (uint256 i = 0; i < userStakes[_user].length; i++) {
            if (userStakes[_user][i].active) {
                userStakes[_user][i].tier = newTier;
            }
        }
        emit TierUpdated(_user, newTier);
    }

    function _detectTier(uint256 _amount) internal view returns (uint8) {
        for (uint8 i = 2; i > 0; i--) {
            if (_amount >= tiers[i].min) {
                return i;
            }
        }
        return 0;
    }

    function getAllStakers() external view returns (address[] memory) {
        return allStakers;
    }

    function getStakerCount() external view returns (uint256) {
        return allStakers.length;
    }
}

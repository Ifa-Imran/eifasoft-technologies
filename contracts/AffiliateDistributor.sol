// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title IKAIROToken - Interface for KAIRO token minting
 */
interface IKAIROToken {
    function mint(address to, uint256 amount) external;
    function mintTo(address recipient, uint256 usdAmount) external;
}

/**
 * @title ILiquidityPool - Interface for LiquidityPool price oracle
 */
interface ILiquidityPool {
    function getLivePrice() external view returns (uint256);
}

/**
 * @title IStakingManager - Interface for harvest-triggered 3X cap and active position checks
 */
interface IStakingManager {
    function applyCappedHarvest(address _user, uint256 _usdAmount) external returns (uint256 applied);
    function getTotalActiveStakeValue(address _user) external view returns (uint256);
    function getRemainingCap(address _user) external view returns (uint256);
    function hasActivePosition(address _user) external view returns (bool);
}

/**
 * @title AffiliateDistributor - Fully Decentralized Multi-level Income Distribution
 * @dev All operations are user-triggered. No backend wallet or admin role needed
 *      for ongoing operations. Admin roles are intended to be burned after setup.
 *
 * Income Types:
 *   0 = Direct Dividends (5% of referred stakes)
 *   1 = Team Dividends (multi-level compound profits)
 *   2 = Rank Dividends (periodic salary based on team volume)
 *
 * Trigger Model:
 *   All operations are user-triggered.
 *   Rank salary auto-accumulates every RANK_INTERVAL. Users just harvest.
 */
contract AffiliateDistributor is ReentrancyGuard, Pausable, AccessControl {
    // ============ Roles ============
    bytes32 public constant STAKING_ROLE = keccak256("STAKING_ROLE");

    // ============ External References ============
    IKAIROToken public kairoToken;
    ILiquidityPool public liquidityPool;
    address public stakingManager;
    address public systemWallet;

    // ============ Income Mappings (USD value, 18 decimals) ============
    mapping(address => uint256) public directDividends;
    mapping(address => uint256) public teamDividends;
    mapping(address => uint256) public rankDividends;

    // ============ Referral Tracking ============
    mapping(address => address) public referrerOf;
    mapping(address => address[]) public directReferrals;
    mapping(address => uint256) public teamVolume;
    mapping(address => uint256) public personalVolume;  // user's own total staked volume
    mapping(address => uint256) public directCount;

    // ============ Genesis Account ============
    /// @notice The first registered address (root of the referral tree). Cannot stake.
    address public genesisAccount;

    // ============ On-Chain Rank Tracking ============
    mapping(address => uint256) public userRankLevel;       // 0-10
    mapping(address => uint256) public lastRankClaimTime;

    // ============ Closing Intervals ============
    uint256 public constant RANK_INTERVAL = 1 hours;        // TESTING (prod: 7 days)

    // ============ Constants ============
    uint256 public constant MIN_HARVEST = 10e18; // $10 minimum harvest
    uint256 public constant MAX_TREE_DEPTH = 50;  // max hops to walk (gas safety)

    // Team dividend percentages (basis points: 1000 = 10%)
    // L1: 10%, L2-L10: 5% each, L11-L15: 2% each
    uint256[15] public TEAM_PERCENTAGES = [
        1000, 500, 500, 500, 500, 500, 500, 500, 500, 500,
        200, 200, 200, 200, 200
    ];

    // Rank salary thresholds (USD, 18 decimals)
    uint256[10] public RANK_THRESHOLDS = [
        10_000e18,
        30_000e18,
        100_000e18,
        300_000e18,
        1_000_000e18,
        3_000_000e18,
        10_000_000e18,
        30_000_000e18,
        100_000_000e18,
        250_000_000e18
    ];

    // Rank salary amounts (USD, 18 decimals)
    uint256[10] public RANK_SALARIES = [
        10e18,
        30e18,
        70e18,
        200e18,
        600e18,
        1_200e18,
        4_000e18,
        12_000e18,
        40_000e18,
        100_000e18
    ];

    // ============ Events ============
    event ReferrerSet(address indexed user, address indexed referrer);
    event DirectEarned(address indexed referrer, uint256 amount);
    event TeamEarned(address indexed upline, address indexed staker, uint256 level, uint256 amount);
    event RankSalaryClaimed(address indexed user, uint256 rankLevel, uint256 salary);
    event RankChanged(address indexed user, uint256 oldRank, uint256 newRank);
    event Harvested(address indexed user, uint8 incomeType, uint256 usdAmount, uint256 kairoAmount);
    event TeamVolumeAdded(address indexed staker, uint256 amount);
    event TeamVolumeRemoved(address indexed staker, uint256 amount);

    // ============ Constructor ============
    constructor(
        address _kairoToken,
        address _liquidityPool,
        address _admin,
        address _systemWallet
    ) {
        require(_kairoToken != address(0), "AD: Invalid KAIRO token");
        require(_liquidityPool != address(0), "AD: Invalid LiquidityPool");
        require(_admin != address(0), "AD: Invalid admin");
        require(_systemWallet != address(0), "AD: Invalid system wallet");

        kairoToken = IKAIROToken(_kairoToken);
        liquidityPool = ILiquidityPool(_liquidityPool);
        systemWallet = _systemWallet;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    // ============ Public Registration ============

    /**
     * @dev Public registration - users register themselves on-chain with a referrer.
     *      Genesis mode: first user registers without needing a referrer.
     */
    function register(address _referrer) external whenNotPaused {
        require(referrerOf[msg.sender] == address(0), "AD: Already registered");
        require(_referrer != msg.sender, "AD: No self-referral");

        // Genesis registration: the very first user registers without a referrer
        if (genesisAccount == address(0)) {
            require(msg.sender != address(0), "AD: Invalid user");
            genesisAccount = msg.sender;
            referrerOf[msg.sender] = msg.sender;
            emit ReferrerSet(msg.sender, address(0));
            return;
        }

        // All subsequent registrations require a valid referrer
        require(_referrer != address(0), "AD: Invalid referrer");
        require(referrerOf[_referrer] != address(0), "AD: Referrer not registered");

        // Prevent circular referral
        address current = _referrer;
        for (uint256 i = 0; i < 15; i++) {
            if (current == address(0) || current == _referrer && i > 0) break;
            require(current != msg.sender, "AD: Circular referral");
            current = referrerOf[current];
            if (current == genesisAccount) break;
        }

        referrerOf[msg.sender] = _referrer;
        directReferrals[_referrer].push(msg.sender);
        directCount[_referrer]++;

        emit ReferrerSet(msg.sender, _referrer);
    }

    // ============ Referral Functions (STAKING_ROLE - contract-to-contract) ============

    /**
     * @dev Set referrer for a user. Called internally by contracts with STAKING_ROLE.
     */
    function setReferrer(address _user, address _referrer) external onlyRole(STAKING_ROLE) {
        require(referrerOf[_user] == address(0), "AD: Referrer already set");
        require(_referrer != _user, "AD: No self-referral");

        // Genesis registration: the very first user registers without a referrer
        if (genesisAccount == address(0)) {
            // First registration ever — no referrer required
            require(_user != address(0), "AD: Invalid user");
            genesisAccount = _user;
            // Mark as registered by setting referrerOf to a sentinel (self-reference)
            referrerOf[_user] = _user;
            emit ReferrerSet(_user, address(0));
            return;
        }

        // All subsequent registrations require a valid referrer
        require(_referrer != address(0), "AD: Invalid referrer");
        // Referrer must be registered (have a non-zero referrerOf)
        require(referrerOf[_referrer] != address(0), "AD: Referrer not registered");

        // Prevent circular referral
        address current = _referrer;
        for (uint256 i = 0; i < 15; i++) {
            if (current == address(0) || current == _referrer && i > 0) break;
            require(current != _user, "AD: Circular referral");
            current = referrerOf[current];
            // Stop at genesis (self-referencing sentinel)
            if (current == genesisAccount) break;
        }

        referrerOf[_user] = _referrer;
        directReferrals[_referrer].push(_user);
        directCount[_referrer]++;

        emit ReferrerSet(_user, _referrer);
    }

    // ============ Distribution Functions (STAKING_ROLE - contract-to-contract) ============

    /**
     * @dev Distribute 5% direct dividend to referrer and track fresh business
     *      for weekly/monthly qualifier (called by StakingManager on stake).
     *      Income accrues freely — 3x cap is enforced at harvest time.
     */
    function distributeDirect(address _referrer, uint256 _stakeAmount) external onlyRole(STAKING_ROLE) {
        require(_referrer != address(0), "AD: Invalid referrer");

        // Referrer must have active stake to earn direct income
        if (IStakingManager(stakingManager).getTotalActiveStakeValue(_referrer) == 0) return;

        uint256 dividend = (_stakeAmount * 5) / 100;

        // Accrue freely — no cap check at accrual time
        directDividends[_referrer] += dividend;

        emit DirectEarned(_referrer, dividend);
    }

    /**
     * @dev Distribute team dividends with level compression.
     *      Walks up the referral tree, skipping inactive users.
     *      Only active uplines (getTotalActiveStakeValue > 0) consume
     *      a level slot. Inactive users are transparent pass-throughs.
     *      Max 50 hops to prevent gas exhaustion.
     */
    function distributeTeamDividend(address _staker, uint256 _profit) external onlyRole(STAKING_ROLE) {
        address current = _staker;
        uint256 activeLevels = 0;

        for (uint256 depth = 0; depth < MAX_TREE_DEPTH && activeLevels < 15; depth++) {
            address upline = referrerOf[current];
            if (upline == address(0) || upline == current) break; // stop at genesis sentinel

            // Compression: only active uplines count as levels
            if (IStakingManager(stakingManager).getTotalActiveStakeValue(upline) > 0) {
                // Check if this upline has unlocked enough levels
                if (activeLevels < _getUnlockedLevels(upline)) {
                    uint256 dividend = (_profit * TEAM_PERCENTAGES[activeLevels]) / 10000;
                    teamDividends[upline] += dividend;
                    emit TeamEarned(upline, _staker, activeLevels + 1, dividend);
                }
                activeLevels++;
            }
            // If inactive: skip — don't increment activeLevels

            current = upline;
        }
    }

    /**
     * @dev Calculate how many team dividend levels a user has unlocked.
     *      Phase 1 (1-5 directs): 1 direct = 1 level
     *      Phase 2 (6-10 directs): each additional direct = 2 levels
     *      Max: 15 levels at 10 direct sponsors
     */
    function _getUnlockedLevels(address _user) internal view returns (uint256) {
        uint256 directs = _getActiveDirectCount(_user);
        if (directs == 0) return 0;
        if (directs <= 5) return directs;            // 1-5 active directs → 1-5 levels
        uint256 extra = directs - 5;                 // 6th active direct → 1 extra, etc.
        uint256 levels = 5 + (extra * 2);            // each extra unlocks 2 levels
        return levels > 15 ? 15 : levels;            // cap at 15
    }

    /**
     * @dev Count the number of direct referrals that have a currently active stake.
     *      Only active directs count toward unlocking team dividend levels.
     *      A direct is "active" if they have at least one active stake position
     *      (includes capped stakes that are still active).
     * @param _user User whose active directs to count
     * @return count Number of active direct referrals
     */
    function _getActiveDirectCount(address _user) internal view returns (uint256 count) {
        address[] storage referrals = directReferrals[_user];
        for (uint256 i = 0; i < referrals.length; i++) {
            if (IStakingManager(stakingManager).hasActivePosition(referrals[i])) {
                count++;
            }
        }
    }

    /**
     * @dev Public view: get the number of active direct referrals for a user.
     *      Useful for frontend to display real-time level eligibility.
     * @param _user User address
     * @return Number of direct referrals with active stakes
     */
    function getActiveDirectCount(address _user) external view returns (uint256) {
        return _getActiveDirectCount(_user);
    }

    /**
     * @dev View function: get unlocked team dividend levels for a user
     */
    function getUnlockedLevels(address _user) external view returns (uint256) {
        return _getUnlockedLevels(_user);
    }

    // ============ Team Volume (STAKING_ROLE - called by StakingManager) ============

    /**
     * @dev Add stake volume to all ancestors' team volume (called on stake).
     * Propagates to ALL ancestors (unlimited levels) for accurate rank calculation.
     * Auto-syncs rank for each upline so salary timer starts immediately when
     * a user first qualifies for a rank — no manual checkRankChange() needed.
     */
    function addTeamVolume(address _staker, uint256 _amount) external onlyRole(STAKING_ROLE) {
        // Track staker's own volume (used for accurate leg calculation)
        personalVolume[_staker] += _amount;

        address current = _staker;
        while (true) {
            address upline = referrerOf[current];
            if (upline == address(0) || upline == current) break; // stop at genesis sentinel
            teamVolume[upline] += _amount;
            _accrueAndSyncRank(upline);
            current = upline;
        }
        emit TeamVolumeAdded(_staker, _amount);
    }

    /**
     * @dev Remove stake volume from all ancestors' team volume (called on unstake/auto-close).
     * Propagates to ALL ancestors (unlimited levels) to match addTeamVolume.
     * Auto-syncs rank for each upline so demotions are handled immediately.
     */
    function removeTeamVolume(address _staker, uint256 _amount) external onlyRole(STAKING_ROLE) {
        // Reduce staker's own volume
        if (personalVolume[_staker] >= _amount) {
            personalVolume[_staker] -= _amount;
        } else {
            personalVolume[_staker] = 0;
        }

        address current = _staker;
        while (true) {
            address upline = referrerOf[current];
            if (upline == address(0) || upline == current) break; // stop at genesis sentinel
            if (teamVolume[upline] >= _amount) {
                teamVolume[upline] -= _amount;
            } else {
                teamVolume[upline] = 0;
            }
            _accrueAndSyncRank(upline);
            current = upline;
        }
        emit TeamVolumeRemoved(_staker, _amount);
    }

    // ============ Auto-Accruing Rank Salary ============

    /**
     * @dev View: calculate pending (unclaimed) rank salary based on elapsed time.
     *      Salary auto-accumulates every RANK_INTERVAL without user action.
     *      Uses stored rank (not live rank) so salary accrues at the confirmed rate.
     */
    function _pendingRankSalary(address _user) internal view returns (uint256) {
        uint256 storedRank = userRankLevel[_user];
        if (storedRank == 0) return 0;

        uint256 lastClaimed = lastRankClaimTime[_user];
        if (lastClaimed == 0) return 0;

        uint256 elapsed = block.timestamp - lastClaimed;
        uint256 periods = elapsed / RANK_INTERVAL;
        if (periods == 0) return 0;

        uint256 salary = RANK_SALARIES[storedRank - 1];
        return periods * salary;
    }

    /**
     * @dev Public view: get pending rank salary for display in frontend
     */
    function pendingRankSalary(address _user) external view returns (uint256) {
        return _pendingRankSalary(_user);
    }

    /**
     * @dev Internal: accrue any pending rank salary to rankDividends,
     *      then check for rank changes. Advances timer by full periods
     *      to preserve partial period progress.
     */
    function _accrueAndSyncRank(address _user) internal {
        uint256 storedRank = userRankLevel[_user];

        // Accrue pending salary at stored rank rate
        if (storedRank > 0 && lastRankClaimTime[_user] > 0) {
            uint256 elapsed = block.timestamp - lastRankClaimTime[_user];
            uint256 periods = elapsed / RANK_INTERVAL;
            if (periods > 0) {
                uint256 salary = RANK_SALARIES[storedRank - 1];
                uint256 pending = periods * salary;
                rankDividends[_user] += pending;
                // Advance timer by full periods (preserves partial period)
                lastRankClaimTime[_user] += periods * RANK_INTERVAL;
                emit RankSalaryClaimed(_user, storedRank, pending);
            }
        }

        // Check for rank change (promotion or demotion)
        (uint256 newRank, ) = _determineRankLevel(_user);
        if (newRank != storedRank) {
            userRankLevel[_user] = newRank;
            // Reset timer on rank change — fresh countdown starts
            lastRankClaimTime[_user] = block.timestamp;
            emit RankChanged(_user, storedRank, newRank);
        }
    }

    /**
     * @dev Public function to sync rank and accrue any pending salary.
     *      Can be called by anyone. Accrues salary at old rank rate first,
     *      then updates rank if changed. No separate "claim" step needed.
     */
    function checkRankChange(address _user) external {
        _accrueAndSyncRank(_user);
    }

    // ============ Harvest Function ============

    /**
     * @dev Harvest accumulated income by minting KAIRO at live price.
     *      Capped income types (0=Direct, 1=Team) are tracked against the 3x
     *      harvest-triggered cap via StakingManager FIFO. Full amount is always
     *      paid out (no clamping). FIFO tracking may deactivate stakes at 3X.
     *      Rank Dividends (type 2) are exempt from cap tracking but require
     *      an active (non-capped) stake. All types require active position.
     * @param _incomeType 0=Direct, 1=Team, 2=Rank
     */
    function harvest(uint8 _incomeType) external nonReentrant whenNotPaused {
        // Always auto-accrue and sync rank on any harvest — keeps rank up-to-date
        _accrueAndSyncRank(msg.sender);

        uint256 balance;

        if (_incomeType == 0) {
            balance = directDividends[msg.sender];
            directDividends[msg.sender] = 0;
        } else if (_incomeType == 1) {
            balance = teamDividends[msg.sender];
            teamDividends[msg.sender] = 0;
        } else if (_incomeType == 2) {
            balance = rankDividends[msg.sender];
            rankDividends[msg.sender] = 0;
        } else {
            revert("AD: Invalid income type");
        }

        require(balance >= MIN_HARVEST, "AD: Below minimum harvest ($10)");

        // All income types require an active (non-capped) stake
        require(
            IStakingManager(stakingManager).hasActivePosition(msg.sender),
            "AD: No active stake"
        );

        // Capped income (Direct/Team): track in FIFO — full amount always paid
        // Rank Dividends: exempt from cap tracking (not counted toward 3X)
        if (_incomeType != 2) {
            IStakingManager(stakingManager).applyCappedHarvest(msg.sender, balance);
            // No refund logic — full balance is paid out
        }

        uint256 livePrice = liquidityPool.getLivePrice();
        require(livePrice > 0, "AD: Invalid price");

        uint256 kairoAmount = (balance * 1e18) / livePrice;
        require(kairoAmount > 0, "AD: Mint amount too small");

        kairoToken.mint(msg.sender, kairoAmount);

        emit Harvested(msg.sender, _incomeType, balance, kairoAmount);
    }

    // ============ Internal: Rank Calculation ============

    /**
     * @dev Calculate rank level and salary based on team volume.
     *      50% max-leg rule: for each rank target, a maximum of 50% of that
     *      specific rank's threshold can be credited from any single leg.
     *      Personal volume does NOT count — only descendant legs.
     *      Leg volume = direct referral's own stake + their downline's volume.
     */
    function _determineRankLevel(address _user) internal view returns (uint256 level, uint256 salary) {
        uint256 totalVol = teamVolume[_user];
        if (totalVol == 0) return (0, 0);

        // Collect all leg volumes (personalVolume + teamVolume for each direct referral)
        address[] storage referrals = directReferrals[_user];
        uint256 numLegs = referrals.length;
        if (numLegs == 0) return (0, 0);

        uint256[] memory legVols = new uint256[](numLegs);
        for (uint256 i = 0; i < numLegs; i++) {
            legVols[i] = personalVolume[referrals[i]] + teamVolume[referrals[i]];
        }

        // Check each rank from highest to lowest
        for (uint256 r = 10; r > 0; r--) {
            uint256 threshold = RANK_THRESHOLDS[r - 1];
            uint256 maxPerLeg = threshold / 2; // 50% of THIS rank's target

            uint256 qualifyingVol = 0;
            for (uint256 j = 0; j < numLegs; j++) {
                uint256 credited = legVols[j] > maxPerLeg ? maxPerLeg : legVols[j];
                qualifyingVol += credited;
            }

            if (qualifyingVol >= threshold) {
                return (r, RANK_SALARIES[r - 1]);
            }
        }

        return (0, 0);
    }

    // ============ View Functions ============

    /**
     * @dev Calculate rank salary for a user (view only, doesn't update state)
     */
    function calculateRankSalary(address _user) external view returns (uint256 salary) {
        (, salary) = _determineRankLevel(_user);
    }

    /**
     * @dev Get full rank info for a user.
     *      pendingSalary = auto-accumulated salary not yet accrued to rankDividends.
     *      totalHarvestable = rankDividends + pendingSalary (what user gets on harvest).
     */
    function getUserRankInfo(address _user) external view returns (
        uint256 storedRank,
        uint256 liveRank,
        uint256 salary,
        uint256 lastClaimed,
        uint256 nextClaimTime,
        uint256 pendingSalary,
        uint256 totalRankHarvestable
    ) {
        storedRank = userRankLevel[_user];
        (liveRank, salary) = _determineRankLevel(_user);
        lastClaimed = lastRankClaimTime[_user];
        nextClaimTime = lastClaimed + RANK_INTERVAL;
        pendingSalary = _pendingRankSalary(_user);
        totalRankHarvestable = rankDividends[_user] + pendingSalary;
    }

    /**
     * @dev Get all income balances for a user (includes pending auto-accrued rank salary)
     */
    function getAllIncome(address _user) external view returns (
        uint256 direct,
        uint256 team,
        uint256 rank
    ) {
        direct = directDividends[_user];
        team = teamDividends[_user];
        rank = rankDividends[_user] + _pendingRankSalary(_user);
    }

    /**
     * @dev Get total harvestable amount across all income types (includes pending rank salary)
     */
    function getTotalHarvestable(address _user) external view returns (uint256 total) {
        total = directDividends[_user]
            + teamDividends[_user]
            + rankDividends[_user]
            + _pendingRankSalary(_user);
    }

    function getReferrer(address _user) external view returns (address) {
        return referrerOf[_user];
    }

    function getDirectReferrals(address _user) external view returns (address[] memory) {
        return directReferrals[_user];
    }

    function getUpline(address _user, uint256 _levels) external view returns (address[] memory upline) {
        upline = new address[](_levels);
        address current = _user;
        for (uint256 i = 0; i < _levels; i++) {
            address ref = referrerOf[current];
            if (ref == address(0) || ref == current) {
                address[] memory trimmed = new address[](i);
                for (uint256 j = 0; j < i; j++) {
                    trimmed[j] = upline[j];
                }
                return trimmed;
            }
            upline[i] = ref;
            current = ref;
        }
    }

    function getTeamVolume(address _user) external view returns (uint256) {
        return teamVolume[_user];
    }

    // ============ Admin Functions (call BEFORE burning admin role) ============

    function setStakingManager(address _staking) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_staking != address(0), "AD: Invalid staking address");
        if (stakingManager != address(0)) {
            _revokeRole(STAKING_ROLE, stakingManager);
        }
        stakingManager = _staking;
        _grantRole(STAKING_ROLE, _staking);
    }

    function setSystemWallet(address _wallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_wallet != address(0), "AD: Invalid wallet address");
        systemWallet = _wallet;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}

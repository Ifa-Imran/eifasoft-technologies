// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IKAIROToken {
    function mint(address to, uint256 amount) external;
    function mintTo(address recipient, uint256 usdAmount) external;
}

interface ILiquidityPool {
    function getLivePrice() external view returns (uint256);
}

interface IStakingManager {
    function applyCappedHarvest(address _user, uint256 _usdAmount) external returns (uint256 applied);
    function getTotalActiveStakeValue(address _user) external view returns (uint256);
    function getRemainingCap(address _user) external view returns (uint256);
    function hasActivePosition(address _user) external view returns (bool);
    function recordIncomeClaim(address _user, uint256 _usdAmount) external;
}

/**
 * @title AffiliateDistributor - Multi-level Income Distribution (TESTNET BUILD)
 * @dev TESTNET-ONLY change: RANK_INTERVAL=15 minutes (production: 7 days).
 */
contract AffiliateDistributor is ReentrancyGuard, Pausable, AccessControl {
    bytes32 public constant STAKING_ROLE = keccak256("STAKING_ROLE");

    IKAIROToken public kairoToken;
    ILiquidityPool public liquidityPool;
    address public stakingManager;
    address public systemWallet;

    mapping(address => uint256) public directDividends;
    mapping(address => uint256) public teamDividends;
    mapping(address => uint256) public rankDividends;

    mapping(address => address) public referrerOf;
    mapping(address => address[]) public directReferrals;
    mapping(address => uint256) public teamVolume;
    mapping(address => uint256) public personalVolume;
    mapping(address => uint256) public directCount;

    address public genesisAccount;

    address[] private allRegistered;

    mapping(address => uint256) public userRankLevel;
    mapping(address => uint256) public lastRankClaimTime;

    // TESTNET: 15 minutes (prod: 7 days)
    uint256 public constant RANK_INTERVAL = 15 minutes;

    uint256 public constant MIN_HARVEST = 10e18;
    uint256 public constant MAX_TREE_DEPTH = 50;

    uint256[15] public TEAM_PERCENTAGES = [
        1000, 500, 500, 500, 500, 500, 500, 500, 500, 500,
        200, 200, 200, 200, 200
    ];

    uint256[10] public RANK_THRESHOLDS = [
        10_000e18, 30_000e18, 100_000e18, 300_000e18, 1_000_000e18,
        3_000_000e18, 10_000_000e18, 30_000_000e18, 100_000_000e18, 250_000_000e18
    ];

    uint256[10] public RANK_SALARIES = [
        10e18, 30e18, 70e18, 200e18, 600e18,
        1_200e18, 4_000e18, 12_000e18, 40_000e18, 100_000e18
    ];

    event ReferrerSet(address indexed user, address indexed referrer);
    event DirectEarned(address indexed referrer, uint256 amount);
    event TeamEarned(address indexed upline, address indexed staker, uint256 level, uint256 amount);
    event RankSalaryClaimed(address indexed user, uint256 rankLevel, uint256 salary);
    event RankChanged(address indexed user, uint256 oldRank, uint256 newRank);
    event Harvested(address indexed user, uint8 incomeType, uint256 usdAmount, uint256 kairoAmount);
    event TeamVolumeAdded(address indexed staker, uint256 amount);
    event TeamVolumeRemoved(address indexed staker, uint256 amount);

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

    function register(address _referrer) external whenNotPaused {
        require(referrerOf[msg.sender] == address(0), "AD: Already registered");
        require(_referrer != msg.sender, "AD: No self-referral");

        if (genesisAccount == address(0)) {
            require(msg.sender != address(0), "AD: Invalid user");
            genesisAccount = msg.sender;
            referrerOf[msg.sender] = msg.sender;
            allRegistered.push(msg.sender);
            emit ReferrerSet(msg.sender, address(0));
            return;
        }

        require(_referrer != address(0), "AD: Invalid referrer");
        require(referrerOf[_referrer] != address(0), "AD: Referrer not registered");

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
        allRegistered.push(msg.sender);

        emit ReferrerSet(msg.sender, _referrer);
    }

    function setReferrer(address _user, address _referrer) external onlyRole(STAKING_ROLE) {
        require(referrerOf[_user] == address(0), "AD: Referrer already set");
        require(_referrer != _user, "AD: No self-referral");

        if (genesisAccount == address(0)) {
            require(_user != address(0), "AD: Invalid user");
            genesisAccount = _user;
            referrerOf[_user] = _user;
            emit ReferrerSet(_user, address(0));
            return;
        }

        require(_referrer != address(0), "AD: Invalid referrer");
        require(referrerOf[_referrer] != address(0), "AD: Referrer not registered");

        address current = _referrer;
        for (uint256 i = 0; i < 15; i++) {
            if (current == address(0) || current == _referrer && i > 0) break;
            require(current != _user, "AD: Circular referral");
            current = referrerOf[current];
            if (current == genesisAccount) break;
        }

        referrerOf[_user] = _referrer;
        directReferrals[_referrer].push(_user);
        directCount[_referrer]++;

        emit ReferrerSet(_user, _referrer);
    }

    function distributeDirect(address _referrer, uint256 _stakeAmount) external onlyRole(STAKING_ROLE) {
        require(_referrer != address(0), "AD: Invalid referrer");
        if (IStakingManager(stakingManager).getTotalActiveStakeValue(_referrer) == 0) return;
        uint256 dividend = (_stakeAmount * 5) / 100;
        directDividends[_referrer] += dividend;
        emit DirectEarned(_referrer, dividend);
    }

    function distributeTeamDividend(address _staker, uint256 _profit) external onlyRole(STAKING_ROLE) {
        address current = _staker;
        uint256 activeLevels = 0;
        for (uint256 depth = 0; depth < MAX_TREE_DEPTH && activeLevels < 15; depth++) {
            address upline = referrerOf[current];
            if (upline == address(0) || upline == current) break;
            if (IStakingManager(stakingManager).getTotalActiveStakeValue(upline) > 0) {
                if (activeLevels < _getUnlockedLevels(upline)) {
                    uint256 dividend = (_profit * TEAM_PERCENTAGES[activeLevels]) / 10000;
                    teamDividends[upline] += dividend;
                    emit TeamEarned(upline, _staker, activeLevels + 1, dividend);
                }
                activeLevels++;
            }
            current = upline;
        }
    }

    function _getUnlockedLevels(address _user) internal view returns (uint256) {
        uint256 directs = _getActiveDirectCount(_user);
        if (directs == 0) return 0;
        if (directs <= 5) return directs;
        uint256 extra = directs - 5;
        uint256 levels = 5 + (extra * 2);
        return levels > 15 ? 15 : levels;
    }

    function _getActiveDirectCount(address _user) internal view returns (uint256 count) {
        address[] storage referrals = directReferrals[_user];
        for (uint256 i = 0; i < referrals.length; i++) {
            if (IStakingManager(stakingManager).hasActivePosition(referrals[i])) {
                count++;
            }
        }
    }

    function getActiveDirectCount(address _user) external view returns (uint256) {
        return _getActiveDirectCount(_user);
    }

    function getUnlockedLevels(address _user) external view returns (uint256) {
        return _getUnlockedLevels(_user);
    }

    function addTeamVolume(address _staker, uint256 _amount) external onlyRole(STAKING_ROLE) {
        personalVolume[_staker] += _amount;
        address current = _staker;
        while (true) {
            address upline = referrerOf[current];
            if (upline == address(0) || upline == current) break;
            teamVolume[upline] += _amount;
            _accrueAndSyncRank(upline);
            current = upline;
        }
        emit TeamVolumeAdded(_staker, _amount);
    }

    function removeTeamVolume(address _staker, uint256 _amount) external onlyRole(STAKING_ROLE) {
        if (personalVolume[_staker] >= _amount) {
            personalVolume[_staker] -= _amount;
        } else {
            personalVolume[_staker] = 0;
        }
        address current = _staker;
        while (true) {
            address upline = referrerOf[current];
            if (upline == address(0) || upline == current) break;
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

    function pendingRankSalary(address _user) external view returns (uint256) {
        return _pendingRankSalary(_user);
    }

    function _accrueAndSyncRank(address _user) internal {
        uint256 storedRank = userRankLevel[_user];
        if (storedRank > 0 && lastRankClaimTime[_user] > 0) {
            uint256 elapsed = block.timestamp - lastRankClaimTime[_user];
            uint256 periods = elapsed / RANK_INTERVAL;
            if (periods > 0) {
                uint256 salary = RANK_SALARIES[storedRank - 1];
                uint256 pending = periods * salary;
                rankDividends[_user] += pending;
                lastRankClaimTime[_user] += periods * RANK_INTERVAL;
                emit RankSalaryClaimed(_user, storedRank, pending);
            }
        }
        (uint256 newRank, ) = _determineRankLevel(_user);
        if (newRank != storedRank) {
            userRankLevel[_user] = newRank;
            lastRankClaimTime[_user] = block.timestamp;
            emit RankChanged(_user, storedRank, newRank);
        }
    }

    function checkRankChange(address _user) external {
        _accrueAndSyncRank(_user);
    }

    function harvest(uint8 _incomeType) external nonReentrant whenNotPaused {
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
        require(
            IStakingManager(stakingManager).hasActivePosition(msg.sender),
            "AD: No active stake"
        );
        if (_incomeType != 2) {
            IStakingManager(stakingManager).applyCappedHarvest(msg.sender, balance);
        }
        uint256 livePrice = liquidityPool.getLivePrice();
        require(livePrice > 0, "AD: Invalid price");
        uint256 kairoAmount = (balance * 1e18) / livePrice;
        require(kairoAmount > 0, "AD: Mint amount too small");
        IStakingManager(stakingManager).recordIncomeClaim(msg.sender, balance);
        kairoToken.mint(msg.sender, kairoAmount);
        emit Harvested(msg.sender, _incomeType, balance, kairoAmount);
    }

    function _determineRankLevel(address _user) internal view returns (uint256 level, uint256 salary) {
        uint256 totalVol = teamVolume[_user];
        if (totalVol == 0) return (0, 0);
        address[] storage referrals = directReferrals[_user];
        uint256 numLegs = referrals.length;
        if (numLegs == 0) return (0, 0);
        uint256[] memory legVols = new uint256[](numLegs);
        for (uint256 i = 0; i < numLegs; i++) {
            legVols[i] = personalVolume[referrals[i]] + teamVolume[referrals[i]];
        }
        for (uint256 r = 10; r > 0; r--) {
            uint256 threshold = RANK_THRESHOLDS[r - 1];
            uint256 maxPerLeg = threshold / 2;
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

    function calculateRankSalary(address _user) external view returns (uint256 salary) {
        (, salary) = _determineRankLevel(_user);
    }

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

    function getAllIncome(address _user) external view returns (
        uint256 direct,
        uint256 team,
        uint256 rank
    ) {
        direct = directDividends[_user];
        team = teamDividends[_user];
        rank = rankDividends[_user] + _pendingRankSalary(_user);
    }

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

    function getAllRegistered() external view returns (address[] memory) {
        return allRegistered;
    }

    function getRegisteredCount() external view returns (uint256) {
        return allRegistered.length;
    }
}

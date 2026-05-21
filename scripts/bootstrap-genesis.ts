/**
 * One-shot script: Bootstrap the genesis account on a fresh AffiliateDistributor.
 * Sets the original mainnet genesis (0x24a4...) as the on-chain genesis.
 *
 * Run: npx hardhat run scripts/bootstrap-genesis.ts --network opbnbMainnet
 */
import { ethers } from "hardhat";

const AD_ADDRESS = process.env.AFFILIATE_DISTRIBUTOR || "0x4c1359af6C5D8A1c3FFF7cB1cB24B9E04d95A4Ea";
const SNAPSHOT_GENESIS = "0x24a4d280f9986D1dcb2547cA0Bdd952F97BF81aa";

async function main() {
    const [signer] = await ethers.getSigners();
    const ad = await ethers.getContractAt("AffiliateDistributor", AD_ADDRESS);

    const current = await ad.genesisAccount();
    if (current !== ethers.ZeroAddress) {
        console.log("Genesis already set:", current);
        return;
    }

    console.log("Bootstrapping genesis on AD:", AD_ADDRESS);
    console.log("  Signer:", signer.address);
    console.log("  Target genesis:", SNAPSHOT_GENESIS);

    // Grant STAKING_ROLE to signer
    const STAKING_ROLE = await ad.STAKING_ROLE();
    const hasStaking = await ad.hasRole(STAKING_ROLE, signer.address);
    if (!hasStaking) {
        console.log("  Granting STAKING_ROLE...");
        const grantTx = await ad.grantRole(STAKING_ROLE, signer.address);
        await grantTx.wait();
        console.log("  Granted.");
    }

    // setReferrer with genesis bootstraps the genesisAccount
    console.log("  Calling setReferrer to bootstrap genesis...");
    const tx = await ad.setReferrer(SNAPSHOT_GENESIS, ethers.ZeroAddress);
    const receipt = await tx.wait();
    console.log("  Done. tx:", receipt?.hash);

    const newGenesis = await ad.genesisAccount();
    console.log("  On-chain genesis:", newGenesis);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

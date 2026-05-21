/**
 * Finalize migration on StakingManager — permanently locks migrateStakes().
 * Run: npx hardhat run scripts/finalize-migration.ts --network opbnbMainnet
 */
import { ethers } from "hardhat";

const SM_ADDRESS = process.env.STAKING_MANAGER_ADDRESS || "0x21c22de855e87B2124A50d76f31E79152C977090";

async function main() {
    const [signer] = await ethers.getSigners();
    const sm = await ethers.getContractAt("StakingManager", SM_ADDRESS);

    const already = await sm.migrationFinalized();
    if (already) {
        console.log("Migration already finalized.");
        return;
    }

    console.log("Finalizing migration on StakingManager:", SM_ADDRESS);
    console.log("  Signer:", signer.address);
    const tx = await sm.finalizeMigration();
    const receipt = await tx.wait();
    console.log("  Done. tx:", receipt?.hash);

    const confirmed = await sm.migrationFinalized();
    console.log("  migrationFinalized:", confirmed);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

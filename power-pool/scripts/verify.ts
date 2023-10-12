import * as hre from "hardhat";
import * as contracts from "../contracts.json";
import { Config } from "./config";

async function main() {
    try {
        await hre.run("verify:verify", {
            address: contracts.randomNumber,
            constructorArguments: [
                Config.coordinator,
                Config.subscription_id,
                Config.key_hash,
            ],
            hre,
        });
    } catch (err) {
        console.log("err >>", err);
    }

    try {
        await hre.run("verify:verify", {
            address: contracts.powerPool,
            constructorArguments: [
                Config.ticket_address,
                contracts.randomNumber,
                Config.admin_address,
                Config.operator_address,
                Config.interval_seconds,
                Config.buffer_seconds,
                Config.pool_size,
                Config.treasury_fee,
            ],
            hre,
        });
    } catch (err) {
        console.log("err >>", err);
    }
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

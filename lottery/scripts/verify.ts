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
            address: contracts.lottery,
            constructorArguments: [
                Config.token_address,
                contracts.randomNumber,
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

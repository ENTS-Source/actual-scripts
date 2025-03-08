import {Command, program} from "commander";
// @ts-ignore
import * as api from "@actual-app/api";
// @ts-ignore
import {utils} from "@actual-app/api";

function actualCommand(cmd: Command): Command {
    return cmd
        .option("-d, --data-dir <path>", "Path to data directory", "./data")
        .requiredOption("-u, --url <url>", "Actual instance URL")
        .requiredOption("-p, --password <password>", "Actual instance password")
        .requiredOption("-b, --budget <id>", "Actual budget ID");
}

async function actual(options: any) {
    await api.init({
        dataDir: options.dataDir,
        serverURL: options.url,
        password: options.password,
    });
    await api.downloadBudget(options.budget);
}

actualCommand(program.command("sync"))
    .description("Syncs Actual data")
    .action(async (options: any) => {
        await actual(options);
        console.log("Sync complete.");
        await api.shutdown();
    });

program.parse(process.argv);

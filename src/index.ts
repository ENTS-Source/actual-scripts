import {Command, program} from "commander";
// @ts-ignore
import * as api from "@actual-app/api";
// @ts-ignore
import {utils} from "@actual-app/api";
import {syncCommand} from "./command/sync";

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

async function actualRun(options: any, fn: (options: any) => Promise<void>) {
    await actual(options);
    await fn(options);
    await api.shutdown();
}

actualCommand(program.command("sync"))
    .description("Syncs Actual data")
    .action(async (options: any) => await actualRun(options, syncCommand));

program.parse(process.argv);

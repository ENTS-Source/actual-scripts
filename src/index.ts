import {Command, program} from "commander";
// @ts-ignore
import * as api from "@actual-app/api";
import {syncCommand} from "./command/sync";
import {importCommand, SUPPORTED_TYPES} from "./command/import";
import {accountsCommand} from "./command/accounts";

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

actualCommand(program.command("accounts"))
    .description("Lists Actual accounts")
    .action(async (options: any) => await actualRun(options, accountsCommand));

actualCommand(program.command("import"))
    .description("Imports data from a file")
    .requiredOption("-t, --type <type>", "Import type. One of " + JSON.stringify(SUPPORTED_TYPES))
    .requiredOption("-f, --file <path>", "Path to file")
    .requiredOption("-a, --account <id>", "Actual account ID")
    .option("-s, --since <unixmillis>", "Only import transactions since this date (only applicable to Plooto import type)")
    .action(async (options: any) => await actualRun(options, importCommand));

program.parse(process.argv);

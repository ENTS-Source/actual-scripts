// @ts-ignore
import * as api from "@actual-app/api";

export async function accountsCommand(options: any) {
    const accounts = await api.getAccounts();
    const nameHeader = accounts.reduce((str, account) => account.name.length > str.length ? account.name : str, "").replaceAll(/./gim, '-');
    console.log("");
    console.log("");
    console.log("=====================================|="+nameHeader.replace(/-/gim, "="));
    console.log("ID                                   | Name");
    console.log("-------------------------------------|-"+nameHeader);
    for (const account of accounts) {
        console.log(`${account.id} | ${account.name}`);
    }
    console.log("=====================================|="+nameHeader.replace(/-/gim, "="));
    console.log("");
    console.log("");
}
import {PaymentParser, PaymentRecord} from "./@types";
import {parse} from "csv-parse/sync";
import * as fs from "node:fs";
import moment from "moment";

export class StripeFeesRecord implements PaymentRecord {
    constructor(public readonly id: string, public readonly amount: number, public readonly fee: number, public readonly payee: string, public readonly date: Date) {
    }

    public static fromRow(headers: string[], row: string[]): StripeFeesRecord | null {
        const id = row[headers.indexOf("id")];
        const amount = Number(row[headers.indexOf("Net")]);
        const stripeType = row[headers.indexOf("Type")];
        const description = row[headers.indexOf("Description")];
        const dateString = row[headers.indexOf("Created (UTC)")];

        if (stripeType !== "stripe_fee") {
            return null;
        }

        const date = moment.utc(dateString, "YYYY-MM-DD HH:mm:ss").local().toDate();

        console.log(`StripeFees | ${date.toString()} | ${id} | ${amount} | ${description}`);
        return new StripeFeesRecord(id + " | " + description, amount, 0, "Stripe Fee", date);
    }
}

export class StripeFeesParser implements PaymentParser {
    public readonly name = "Stripe Fees";

    constructor(private readonly filePath: string) {
    }

    public async getPayments(): Promise<PaymentRecord[]> {
        const records = parse(fs.readFileSync(this.filePath));
        return records.slice(1).map((r: string[]) => StripeFeesRecord.fromRow(records[0], r)).filter((r: StripeFeesRecord | null) => !!r);
    }
}
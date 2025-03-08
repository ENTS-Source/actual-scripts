import {PaymentParser, PaymentRecord} from "./@types";
import {parse} from "csv-parse/sync";
import * as fs from "node:fs";
import moment from "moment";

export class StripeRecord implements PaymentRecord {
    constructor(public readonly id: string, public readonly amount: number, public readonly fee: number, public readonly payee: string, public readonly date: Date) {
    }

    public static fromRow(headers: string[], row: string[]): StripeRecord | null {
        const id = row[headers.indexOf("id")];
        const amount = Number(row[headers.indexOf("Amount")]);
        const fee = Number(row[headers.indexOf("Fee")]) * -1;
        const description = row[headers.indexOf("Description")];
        const status = row[headers.indexOf("Status")];
        const dateString = row[headers.indexOf("Created date (UTC)")];

        if (status !== "Paid") {
            return null;
        }

        const date = moment.utc(dateString, "YYYY-MM-DD HH:mm:ss").local().toDate();

        console.log(`Stripe | ${date.toString()} | ${id} | ${amount} | ${fee} | ${description}`);
        return new StripeRecord(id, amount, fee, description, date);
    }
}

export class StripeParser implements PaymentParser {
    public readonly name = "Stripe";

    constructor(private readonly filePath: string) {
    }

    public async getPayments(): Promise<PaymentRecord[]> {
        const records = parse(fs.readFileSync(this.filePath));
        return records.slice(1).map((r: string[]) => StripeRecord.fromRow(records[0], r)).filter((r: StripeRecord | null) => !!r);
    }
}
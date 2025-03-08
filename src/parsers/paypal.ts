import {PaymentParser, PaymentRecord} from "./@types";
import {parse} from "csv-parse/sync";
import * as fs from "node:fs";
import moment from "moment";

export class PaypalRecord implements PaymentRecord {
    constructor(public readonly id: string, public readonly amount: number, public readonly fee: number, public readonly payee: string, public readonly date: Date) {
    }

    public static fromRow(headers: string[], row: string[]): PaypalRecord | null {
        const id = row[headers.indexOf("Transaction ID")];
        const amount = Number(row[headers.indexOf("Gross")].replaceAll(",", ""));
        const fee = Number(row[headers.indexOf("Fee")].replaceAll(",", ""));
        const description = row[headers.indexOf("Type")];
        const dateString = row[headers.indexOf("Date")];

        if (description === "General Withdrawal") {
            return null;
        }

        const date = moment(dateString, "DD/MM/YYYY").toDate();

        console.log(`Paypal | ${date.toString()} | ${id} | ${amount} | ${fee} | ${description}`);
        return new PaypalRecord(id, amount, fee, description, date);
    }
}

export class PaypalParser implements PaymentParser {
    public readonly name = "PayPal";

    constructor(private readonly filePath: string) {
    }

    public async getPayments(): Promise<PaymentRecord[]> {
        const records = parse(fs.readFileSync(this.filePath), {
            bom: true,
        });
        return records.slice(1).map((r: string[]) => PaypalRecord.fromRow(records[0], r)).filter((r: PaypalRecord | null) => !!r);
    }
}
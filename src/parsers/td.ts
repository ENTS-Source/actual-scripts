import {ExactPaymentRecord, PaymentParser, PaymentRecord} from "./@types";
import {parse} from "csv-parse/sync";
import * as fs from "node:fs";
import moment from "moment";

export class TDRecord implements ExactPaymentRecord {
    public readonly exact = true;

    constructor(public readonly id: string, public readonly amount: number, public readonly fee: number, public readonly payee: string, public readonly date: Date) {
    }

    public static fromRow(row: string[]): TDRecord | null {
        const dateString = row[0];
        const description = row[1];
        const outflow = Number(row[2] || "0");
        const inflow = Number(row[3] || "0");
        const amount = inflow - outflow;

        const date = moment(dateString, "MM/DD/YYYY").toDate();

        console.log(`TD | ${date.toString()} | <no ID> | ${amount} | <no fee> | ${description}`);
        return new TDRecord("", amount, 0, description, date);
    }
}

export class TDParser implements PaymentParser {
    public readonly name = "TD Canada Trust";

    constructor(private readonly filePath: string) {
    }

    public async getPayments(): Promise<PaymentRecord[]> {
        const records = parse(fs.readFileSync(this.filePath));
        return records.map((r: string[]) => TDRecord.fromRow(r)).filter((r: TDRecord | null) => !!r);
    }
}
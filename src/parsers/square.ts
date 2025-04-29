import {PaymentParser, PaymentRecord} from "./@types";
import {parse} from "csv-parse/sync";
import * as fs from "node:fs";
import moment from "moment";

export class SquareRecord implements PaymentRecord {
    constructor(public readonly id: string, public readonly amount: number, public readonly fee: number, public readonly payee: string, public readonly date: Date) {
    }

    public static fromRow(headers: string[], row: string[]): SquareRecord | null {
        const id = row[headers.indexOf("Transaction ID")];
        const amount = Number(row[headers.indexOf("Collected")].replace("$", "").replaceAll(",", ""));
        const fee = Number(row[headers.indexOf("Fees")].replace("$", ""));
        const description = row[headers.indexOf("Type")];
        const dateString = row[headers.indexOf("Payment Date")];
        const date = moment(dateString, "YYYY-MM-DD").toDate();

        console.log(`Square | ${date.toString()} | ${id} | ${amount} | ${fee} | ${description}`);
        return new SquareRecord(id, amount, fee, description, date);
    }
}

export class SquareParser implements PaymentParser {
    public readonly name = "Square";

    constructor(private readonly filePath: string) {
    }

    public async getPayments(): Promise<PaymentRecord[]> {
        const records = parse(fs.readFileSync(this.filePath));
        return records.slice(1).map((r: string[]) => SquareRecord.fromRow(records[0], r)).filter((r: SquareRecord | null) => !!r);
    }
}
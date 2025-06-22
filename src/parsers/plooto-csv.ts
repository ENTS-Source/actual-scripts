import {PaymentParser, PaymentRecord, SubPaymentRecord} from "./@types";
import {parse} from "csv-parse/sync";
import * as fs from "node:fs";
import moment from "moment";

export class PlootoCsvRecord implements PaymentRecord {
    constructor(public readonly id: string, public readonly amount: number, public readonly fee: number, public readonly payee: string, public readonly date: Date, public readonly subrecords: SubPaymentRecord[] | undefined) {
    }

    public static fromRow(headers: string[], row: string[]): PlootoCsvRecord | null {
        const parseCurrency = (val: string): number => {
            // "1,445.55 CAD"
            const cleaned = val.replaceAll(',', '').split(' ')[0].trim();
            return Number(cleaned);
        };

        const payee = row[headers.indexOf("Contact Name")];
        const amount = parseCurrency(row[headers.indexOf("Amount")]) * -1;
        const description = row[headers.indexOf("Memo")];
        const debitDate = row[headers.indexOf("Debit Date")];
        const scheduledDate = row[headers.indexOf("Scheduled Debit Date")];
        const date = moment.utc(debitDate || scheduledDate, 'D MMM YYYY').local().toDate();
        const fee = 0;

        const descriptionSingleLine = description.replaceAll("\n", "");

        const subrecords: SubPaymentRecord[] = [];
        if (description.includes('\n')) {
            const parts = description.split("\n").map(s => s.trim());
            for (const line of parts) {
                // Example line: Cleaning supplies - hose (Item #1 - 13.64)
                const subDescription = line;
                const subAmount = Number(line.slice(0, line.length - 1).split(" - ").reverse()[0].replaceAll(",", ""));
                subrecords.push({
                    description: subDescription,
                    amount: subAmount * -1,
                });
            }
        }

        console.log(`PlootoCSV | ${date.toString()} | ${payee} | ${amount} | ${fee} | ${description}`);
        return new PlootoCsvRecord(descriptionSingleLine, amount, fee, payee, date, subrecords.length === 0 ? undefined : subrecords);
    }
}

export class PlootoCsvParser implements PaymentParser {
    public readonly name = "PlootoCSV";

    constructor(private readonly filePath: string, private readonly onlyAfterLocalTime: number) {
    }

    public async getPayments(): Promise<PaymentRecord[]> {
        const records = parse(fs.readFileSync(this.filePath));
        return records.slice(1).map((r: string[]) => PlootoCsvRecord.fromRow(records[0], r)).filter((r: PlootoCsvRecord | null) => !!r && r.date.getTime() > this.onlyAfterLocalTime);
    }
}
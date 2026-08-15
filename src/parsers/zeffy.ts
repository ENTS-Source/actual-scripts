import {PaymentParser, PaymentRecord, SubPaymentRecord} from "./@types";
import moment from "moment";
import * as xlsx from "xlsx";

export class ZeffyRecord implements PaymentRecord {
    constructor(public readonly id: string, public readonly amount: number, public readonly fee: number, public readonly payee: string, public readonly date: Date, public readonly subrecords: SubPaymentRecord[] | undefined) {
    }

    public static fromRow(headers: string[], row: (number|string|Date)[], onlyAfterLocalTime: number): ZeffyRecord | null {
        const firstName = row[headers.indexOf("First Name")] as string;
        const lastName = row[headers.indexOf("Last Name")] as string;
        const payee = `${firstName} ${lastName}`;
        const amount = row[headers.indexOf("Total Amount")] as number;
        const description = (row[headers.indexOf("Fund")] as string).replaceAll("\r", "").trim();
        const paymentMethod = row[headers.indexOf("Payment Method")] as string;
        const dateString = row[headers.findIndex(h => h.startsWith("Payment Date"))] as Date;
        const date = moment.utc(dateString).local().toDate();
        const fee = 0;

        if (paymentMethod != "Card") {
            return null;
        }

        if (date.getTime() < onlyAfterLocalTime) {
            return null;
        }

        console.log(`Zeffy | ${date.toString()} | ${payee} | ${amount} | ${fee} | ${description}`);
        return new ZeffyRecord(description, amount, fee, payee, date, undefined);
    }
}

export class ZeffyParser implements PaymentParser {
    public readonly name = "Zeffy";

    constructor(private readonly filePath: string, private readonly onlyAfterLocalTime: number) {
    }

    public async getPayments(): Promise<PaymentRecord[]> {
        const sheets = xlsx.readFile(this.filePath, {
            cellDates: true,
        });
        const sheet = sheets.Sheets["Export"];
        const rows = xlsx.utils.sheet_to_json(sheet, {
            header: 1,
        });

        return rows.slice(1).map(r => ZeffyRecord.fromRow(rows[0] as string[], r as (number|string|Date)[], this.onlyAfterLocalTime)).filter(r => !!r) as PaymentRecord[];
    }
}

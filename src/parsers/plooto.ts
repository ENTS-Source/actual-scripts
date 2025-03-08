import {PaymentParser, PaymentRecord, SubPaymentRecord} from "./@types";
import moment from "moment";
import * as xlsx from "xlsx";

export class PlootoRecord implements PaymentRecord {
    constructor(public readonly id: string, public readonly amount: number, public readonly fee: number, public readonly payee: string, public readonly date: Date, public readonly subrecords: SubPaymentRecord[] | undefined) {
    }

    public static fromRow(headers: string[], row: (number|string|Date)[], onlyAfterLocalTime: number): PlootoRecord | null {
        const payee = row[headers.indexOf("Contact Name")] as string;
        const amount = row[headers.indexOf("Payment Amount")] as number * -1;
        const description = (row[headers.indexOf("Memo")] as string).replaceAll("\r", "").trim();
        const dateString = row[headers.indexOf("Debit Date")] as Date;
        const date = moment.utc(dateString).local().toDate();
        const fee = 0;

        const descriptionSingleLine = description.replaceAll("\n", "");

        if (date.getTime() < onlyAfterLocalTime) {
            return null;
        }

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

        console.log(`Plooto | ${date.toString()} | ${payee} | ${amount} | ${fee} | ${descriptionSingleLine}`);
        return new PlootoRecord(descriptionSingleLine, amount, fee, payee, date, subrecords.length === 0 ? undefined : subrecords);
    }
}

export class PlootoParser implements PaymentParser {
    public readonly name = "Plooto";

    constructor(private readonly filePath: string, private readonly onlyAfterLocalTime: number) {
    }

    public async getPayments(): Promise<PaymentRecord[]> {
        const sheets = xlsx.readFile(this.filePath, {
            cellDates: true,
        });
        const sheet = sheets.Sheets["Transaction Details"];
        deleteRow(sheet, 0); // drop the file header row (business name)
        const rows = xlsx.utils.sheet_to_json(sheet, {
            header: 1,
        });

        return rows.slice(1).map(r => PlootoRecord.fromRow(rows[0] as string[], r as (number|string|Date)[], this.onlyAfterLocalTime)).filter(r => !!r) as PaymentRecord[];
    }
}

function encodeCell(row:number, column:number) {
    return xlsx.utils.encode_cell({r: row, c: column});
}

function deleteRow(sheet: xlsx.WorkSheet, row: number) {
    const variable = xlsx.utils.decode_range(sheet["!ref"]!)
    for (let R = row; R < variable.e.r; ++R) {
        for (let C = variable.s.c; C <= variable.e.c; ++C) {
            sheet[encodeCell(R, C)] = sheet[encodeCell(R + 1, C)];
        }
    }
    variable.e.r--
    sheet['!ref'] = xlsx.utils.encode_range(variable.s, variable.e);
}

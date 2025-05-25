import {Page} from "./page";
import * as ExcelJS from "exceljs";
import moment from "moment";

export class Report {
    private workbook = new ExcelJS.Workbook();
    private pages: Page[] = [];

    constructor(private fiscalYearStart: Date, private companyName: string, private outputDirectory: string) {
    }

    private get fiscalYearEnd(): Date {
        return moment(this.fiscalYearStart).add(1, 'years').add(-1, 'days').toDate();
    }

    private get asAt(): Date {
        return this.fiscalYearEnd > (new Date()) ? (new Date()) : this.fiscalYearEnd;
    }

    private get byline(): string {
        return `As at ${moment(this.asAt).format("MMMM DD, YYYY")} (Fiscal Year ${this.fiscalYearEnd.getFullYear()})`;
    }

    public addPage(name: string, dataColNames: string[]): Page {
        const p = new Page(name, this.companyName, this.byline, dataColNames);
        this.pages.push(p);
        return p;
    }

    public async render() {
        for (const page of this.pages) {
            const sheet = this.workbook.addWorksheet(page.title);
            page.render(sheet);
        }
        await this.workbook.xlsx.writeFile(`${this.outputDirectory}/report.xlsx`);
    }
}
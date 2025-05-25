import * as ExcelJS from "exceljs";

const FORMAT_CURRENCY = "_($* #,##0.00_);_($* (#,##0.00);_($* \"-\"??_);_(@_)";

export class Page {
    private sections: Section[] = [];
    private grandTotalLineName: string | undefined;
    private grandTotalAdd = true;

    constructor(public readonly title: string, private companyName: string, private byline: string, public readonly dataColNames: string[]) {
    }

    public addSection(title: string): Section {
        const s = new Section(title, this);
        this.sections.push(s);
        return s;
    }

    public setGrandTotalLine(name: string, useAddition = true): void {
        this.grandTotalLineName = name;
        this.grandTotalAdd = useAddition;
    }

    public render(sheet: ExcelJS.Worksheet): void {
        const excelDataCols: string[] = [];
        for (let i = 0; i < this.dataColNames.length; i++) {
            excelDataCols.push(String.fromCharCode(('C'.charCodeAt(0) + i)));
        }

        const lastCol = excelDataCols[excelDataCols.length - 1];

        sheet.mergeCells(`A1:${lastCol}1`);
        CellWrapper.of(sheet.getCell("A1"))
            .value(this.title)
            .font({bold: true, size: 14})
            .alignment({horizontal: "center"});

        sheet.mergeCells(`A2:${lastCol}2`);
        CellWrapper.of(sheet.getCell("A2"))
            .value(this.companyName)
            .alignment({horizontal: "center"});

        sheet.mergeCells(`A3:${lastCol}3`);
        CellWrapper.of(sheet.getCell("A3"))
            .value(this.byline)
            .alignment({horizontal: "center"});

        for (let i = 0; i < this.dataColNames.length; i++) {
            CellWrapper.of(sheet.getCell(`${excelDataCols[i]}5`))
                .value(this.dataColNames[i])
                .font({bold: true})
                .alignment({horizontal: "right"});
        }

        const sectionLines: number[] = [];
        let sectionStartRow = 6;
        for (const section of this.sections) {
            sectionStartRow += section.render(sheet, sectionStartRow, excelDataCols);
            sectionLines.push(sectionStartRow - 1);
            sectionStartRow++; // spacing
        }

        if (this.grandTotalLineName) {
            CellWrapper.of(sheet.getCell(`A${sectionStartRow}`))
                .value(this.grandTotalLineName)
                .font({bold: true});

            for (const col of excelDataCols) {
                CellWrapper.of(sheet.getCell(`${col}${sectionStartRow}`))
                    .money()
                    .formula(sectionLines.map(c => `${col}${c}`).join(this.grandTotalAdd ? "+" : "-"))
                    .font({bold: true});
            }

            for (const col of ['A', 'B', ...excelDataCols]) {
                CellWrapper.of(sheet.getCell(`${col}${sectionStartRow}`))
                    .border({top: {style: "thin"}, bottom: {style: "double"}});
            }
        }

        sheet.columns[0].width = 22.25;
        for (let i = 0; i < this.dataColNames.length; i++) {
            sheet.columns[i + 2].width = 14.625;
        }
    }
}

export class Section {
    private subsections: Section[] = [];
    private data: [string, number[]][] = [];

    constructor(private title: string, private page: Page, private nested: boolean = false) {
    }

    public addSubsection(title: string): Section {
        if (this.nested) {
            throw new Error("Cannot add subsections to nested sections");
        }

        const s = new Section(title, this.page, true);
        this.subsections.push(s);
        return s;
    }

    public addRow(name: string, values: number[]): void {
        if (this.subsections.length > 0) {
            throw new Error("Cannot add rows when there are subsections");
        }
        if (values.length !== this.page.dataColNames.length) {
            throw new Error("Number of values does not match number of columns");
        }
        this.data.push([name, values]);
    }

    public render(sheet: ExcelJS.Worksheet, fromRow: number, excelDataCols: string[]): number {
        for (const col of ['A', 'B', ...excelDataCols]) {
            CellWrapper.of(sheet.getCell(`${col}${fromRow}`))
                .border({top: {style: "thin"}, bottom: {style: "hair"}});
        }

        CellWrapper.of(sheet.getCell(`A${fromRow}`))
            .value(this.title)
            .font({bold: true});

        let relRow = 1; // we have a section title, so we're at fromRow+1
        if (this.data.length === 0) {
            this.data.push(["[No Data]", Array(this.page.dataColNames.length).fill(0)]);
            CellWrapper.of(sheet.getCell(`A${fromRow + relRow}`))
                .font({italic: true});
        }
        for (const [name, values] of this.data) {
            sheet.addRow([name, '', ...values]);
            for (const col of excelDataCols) {
                CellWrapper.of(sheet.getCell(`${col}${fromRow + relRow}`))
                    .money();
            }
            relRow++;
        }

        // TODO: Test
        for (const subsection of this.subsections) {
            subsection.render(sheet, fromRow + relRow, excelDataCols);
            relRow += subsection.data.length + 1;
        }

        CellWrapper.of(sheet.getCell(`A${fromRow + relRow}`))
            .value(`Total ${this.title}`)
            .font({bold: true});

        for (const col of excelDataCols) {
            CellWrapper.of(sheet.getCell(`${col}${fromRow + relRow}`))
                .money()
                .sum(`${col}${fromRow + 1}:${col}${fromRow + relRow - 1}`)
                .font({bold: true});
        }
        for (const col of ['A', 'B', ...excelDataCols]) {
            CellWrapper.of(sheet.getCell(`${col}${fromRow + relRow}`))
                .border({top: {style: "thin"}, bottom: {style: "double"}});
        }

        return relRow + 1;
    }
}

class CellWrapper {
    public static of(cell: ExcelJS.Cell): CellWrapper {
        return new CellWrapper(cell);
    }

    private constructor(private cell: ExcelJS.Cell) {
    }

    public value(value: number | string): CellWrapper {
        this.cell.value = value;
        return this;
    }

    public font(f: Partial<ExcelJS.Font>): CellWrapper {
        this.cell.font = f;
        return this;
    }

    public alignment(a: Partial<ExcelJS.Alignment>): CellWrapper {
        this.cell.alignment = a;
        return this;
    }

    public border(b: Partial<ExcelJS.Borders>): CellWrapper {
        this.cell.border = b;
        return this;
    }

    public money(): CellWrapper {
        this.cell.numFmt = FORMAT_CURRENCY;
        return this;
    }

    public sum(range: string): CellWrapper {
        return this.formula(`SUM(${range})`);
    }

    public formula(formula: string): CellWrapper {
        this.cell.value = {
            formula: formula,
        };
        return this;
    }
}

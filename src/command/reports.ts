import moment from "moment";
import {actualDate} from "../functions";
// @ts-ignore
import {q, runQuery, utils} from "@actual-app/api";
import * as ExcelJS from "exceljs";
import path from "node:path";
import {Report} from "../reporting/report";

export async function reportsCommand(options: any) {
    const fiscalYearStart = moment(options.year, "YYYY-MM-DD").toDate();
    const fiscalYearEnd = moment(fiscalYearStart).add(1, 'year').add(-1, 'day').toDate();
    const priorFiscalYearStart = moment(fiscalYearStart).add(-1, 'year').toDate();
    const priorFiscalYearEnd = moment(fiscalYearEnd).add(-1, 'year').toDate();

    options.company = options.company.replaceAll(/\^/gim, "");

    const report = new Report(fiscalYearStart, options.company, options.output);

    await makeBalanceSheet(fiscalYearEnd, priorFiscalYearEnd, report);
    await makeIncomeStatement(fiscalYearStart, fiscalYearEnd, priorFiscalYearStart, priorFiscalYearEnd, report);

    const quarterDate = (fiscalYearEnd.getTime() > (new Date()).getTime()) ? (new Date()) : fiscalYearEnd;
    await makeIncomeStatementQuarters(fiscalYearStart, quarterDate, options.output, options.company);

    await report.render();
}

async function makeBalanceSheet(fiscalYearEnd: Date, priorFiscalYearEnd: Date, report: Report) {
    const balancesCurrentYear = await getBalances(fiscalYearEnd);
    const balancesPriorYear = await getBalances(priorFiscalYearEnd);

    for (const account of balancesPriorYear) {
        if (!balancesCurrentYear.find(b => b["account.id"] === account["account.id"])) {
            balancesCurrentYear.push({
                "account.id": account["account.id"],
                "account.name": account["account.name"],
                balance: 0,
            });
        }
    }

    const assets = balancesCurrentYear.filter(b =>
        b["account.name"].startsWith("[A]")
        || (b.balance >= 0 && !b["account.name"].startsWith("[L]")));
    assets.forEach(b => b["account.name"] = (b["account.name"].startsWith("[A]") ? b["account.name"].slice(3) : b["account.name"]).trim());
    const liabilities = balancesCurrentYear.filter(b =>
        b["account.name"].startsWith("[L]")
        || (b.balance < 0 && !b["account.name"].startsWith("[A]")));
    liabilities.forEach(b => b["account.name"] = (b["account.name"].startsWith("[L]") ? b["account.name"].slice(3) : b["account.name"]).trim());

    // Remove any "for reporting" labels
    [...assets, ...liabilities].forEach(b =>  b["account.name"] = (b["account.name"].startsWith("[FOR REPORTING]") ? b["account.name"].slice(15) : b["account.name"]).trim())

    const page = report.addPage('Balance Sheet', [
        `Total FY ${fiscalYearEnd.getFullYear()}`,
        `Total FY ${priorFiscalYearEnd.getFullYear()}`,
    ]);
    page.setGrandTotalLine('Net Assets');

    const assetsSection = page.addSection('Assets');
    for (const account of assets) {
        const priorBalance = balancesPriorYear.find(b => b["account.id"] === account["account.id"])?.balance ?? 0;
        assetsSection.addRow(account["account.name"], [account.balance, priorBalance]);
    }

    const liabilitiesSection = page.addSection('Liabilities');
    for (const account of liabilities) {
        const priorBalance = (balancesPriorYear.find(b => b["account.id"] === account["account.id"])?.balance ?? 0) * -1;
        account.balance = account.balance * -1;
        liabilitiesSection.addRow(account["account.name"], [account.balance, priorBalance]);
    }
}

async function makeIncomeStatementQuarters(fiscalYearStart: Date, fromDate: Date, outputPath: string, companyName: string) {
    if (fromDate.getTime() < fiscalYearStart.getTime()) {
        throw new Error("From date cannot be before fiscal year start");
    }

    const currentQuarter = moment(fromDate).subtract(fiscalYearStart.getMonth(), 'months').quarter();
    const anchorQuarterDate = moment(fiscalYearStart).add((currentQuarter - 1) * 3, 'months').toDate();
    console.log(`Anchor quarter ${currentQuarter} ${actualDate(anchorQuarterDate)}`);

    const balancesByQuarter: CategoryBalance[][] = [];
    const quarterNames: string[] = [];
    async function appendRelativeQuarter(quarter: number) {
        const start = moment(anchorQuarterDate).subtract(quarter * 3, 'months').toDate();
        const end = moment(start).add(3, 'months').subtract(1, 'days').toDate();
        console.log(`Appending relative quarter ${quarter} ${actualDate(start)} - ${actualDate(end)}`);
        const balances = await getCategoryBalances(start, end);
        balancesByQuarter.push(balances);

        const inFiscalYear = start.getTime() >= fiscalYearStart.getTime() ? fiscalYearStart.getFullYear() : fiscalYearStart.getFullYear() - 1;
        const inQuarter = moment(start).subtract(fiscalYearStart.getMonth(), 'months').quarter();
        quarterNames.push(`FQ ${inFiscalYear + 1}-${inQuarter}`);
    }
    for (let i = 0; i < 4; i++) {
        await appendRelativeQuarter(i);
    }

    for (const balances1 of balancesByQuarter) {
        for (const balances2 of balancesByQuarter) {
            for (const category of balances2) {
                if (!balances1.find(b => b["category.name"] === category["category.name"])) {
                    balances1.push({
                        total: 0,
                        "category.name": category["category.name"],
                        "category.group.name": category["category.group.name"],
                        "category.is_income": category["category.is_income"],
                    });
                }
            }
        }
    }

    const revenues = balancesByQuarter[0].filter(b => b["category.is_income"]);
    const expenses = balancesByQuarter[0].filter(b => !b["category.is_income"]);
    const groups = Array.from(new Set(balancesByQuarter[0].map(b => b["category.group.name"])));

    const asAt = `As at ${moment(fromDate).format("MMMM DD, YYYY")}`;
    const currencyFormat = "_($* #,##0.00_);_($* (#,##0.00);_($* \"-\"??_);_(@_)";

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Income and Expense Statement", {
        headerFooter: {
            firstHeader: `&C&BIncome and Expense Statement\n${companyName}\n${asAt}`,
        },
    });

    sheet.mergeCells("A1:F1");
    sheet.getCell("A1").value = "Income and Expense Statement";
    sheet.getCell("A1").font = {bold: true, size: 14};
    sheet.getCell("A1").alignment = {horizontal: "center"};

    sheet.mergeCells("A2:F2");
    sheet.getCell("A2").value = companyName;
    sheet.getCell("A2").alignment = {horizontal: "center"};

    sheet.mergeCells("A3:F3");
    sheet.getCell("A3").value = asAt;
    sheet.getCell("A3").alignment = {horizontal: "center"};

    const quarterCols = ["C", "D", "E", "F"];
    for (let i = 0; i < 4; i++) {
        const cell = `${quarterCols[i]}5`;
        sheet.getCell(cell).value = `Total ${quarterNames[i]}`;
        sheet.getCell(cell).alignment = {horizontal: "right"};
        sheet.getCell(cell).font = {bold: true};
    }

    sheet.getCell("A6").value = "Revenues";
    sheet.getCell("A6").font = {bold: true};

    for (const col of ["A", "B", ...quarterCols]) {
        sheet.getCell(`${col}6`).border = {top: {style: "thin"}, bottom: {style: "hair"}};
    }

    let rows = 0;
    for (const account of revenues) {
        const quarterBalances = [
            balancesByQuarter[0].find(b => b["category.name"] === account["category.name"])?.total ?? 0,
            balancesByQuarter[1].find(b => b["category.name"] === account["category.name"])?.total ?? 0,
            balancesByQuarter[2].find(b => b["category.name"] === account["category.name"])?.total ?? 0,
            balancesByQuarter[3].find(b => b["category.name"] === account["category.name"])?.total ?? 0,
        ];
        sheet.addRow([account["category.name"], "", ...quarterBalances]);
        for (let i = 0; i < 4; i++) {
            sheet.getCell(`${quarterCols[i]}${6 + 1 + rows}`).numFmt = currencyFormat;
        }
        rows++;
    }
    if (revenues.length === 0) {
        sheet.addRow(["<No revenues found>", "", 0, 0, 0, 0]);
        sheet.getCell(`A${6 + 1 + rows}`).font = {italic: true};
        for (let i = 0; i < 4; i++) {
            sheet.getCell(`${quarterCols[i]}${6 + 1 + rows}`).numFmt = currencyFormat;
        }
        rows++;
    }

    sheet.getCell(`A${6 + 1 + rows}`).value = "Total Revenue";
    sheet.getCell(`A${6 + 1 + rows}`).font = {bold: true};

    for (let i = 0; i < 4; i++) {
        const cell = `${quarterCols[i]}${6 + 1 + rows}`;
        sheet.getCell(cell).value = {
            formula: `SUM(${quarterCols[i]}7:${quarterCols[i]}${6 + rows})`,
            // result: revenues.reduce((c, b) => b.total + c, 0)
        };
        sheet.getCell(cell).numFmt = currencyFormat;
        sheet.getCell(cell).font = {bold: true};
    }

    for (const col of ["A", "B", ...quarterCols]) {
        sheet.getCell(`${col}${6 + 1 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    }

    const incomeRow = 6 + 1 + rows;

    sheet.getCell(`A${6 + 3 + rows}`).value = "Expenses";
    sheet.getCell(`A${6 + 3 + rows}`).font = {bold: true};

    for (const col of ["A", "B", ...quarterCols]) {
        sheet.getCell(`${col}${6 + 3 + rows}`).border = {top: {style: "thin"}, bottom: {style: "hair"}};
    }

    // Blank line for visual separation
    sheet.addRow([]);
    rows++;

    const expenseSums: number[] = [];
    for (const group of groups) {
        if (!expenses.find(e => e["category.group.name"] === group)) {
            continue;
        }

        // Intro line
        sheet.addRow([group]);
        for (const col of ["A", "B", ...quarterCols]) {
            sheet.getCell(`${col}${6 + 4 + rows}`).font = {italic: true, bold: true};
            sheet.getCell(`${col}${6 + 4 + rows}`).border = {bottom: {style: "hair"}};
        }
        rows++;

        // Expense lines
        const groupRows = rows;
        for (const account of expenses.filter(e => e["category.group.name"] === group)) {
            const balances = balancesByQuarter.map(b => (b.find(b => b["category.name"] === account["category.name"])?.total ?? 0) * -1);
            sheet.addRow([account["category.name"], "", ...balances]);
            for (let i = 0; i < 4; i++) {
                sheet.getCell(`${quarterCols[i]}${6 + 4 + rows}`).numFmt = currencyFormat;
            }
            rows++;
        }

        // Total line
        expenseSums.push(6 + 4 + rows);
        sheet.getCell(`A${6 + 4 + rows}`).value = `Total ${group}`;
        sheet.getCell(`A${6 + 4 + rows}`).font = {italic: true, bold: true};
        sheet.getCell(`A${6 + 4 + rows}`).border = {bottom: {style: "hair"}};
        sheet.getCell(`B${6 + 4 + rows}`).border = {bottom: {style: "hair"}};
        for (const col of quarterCols) {
            const cell = `${col}${6+4+rows}`;
            sheet.getCell(cell).value = {
                formula: `SUM(${col}${6+4+groupRows}:${col}${6+4+rows-1})`,
            };
            sheet.getCell(cell).numFmt = currencyFormat;
            sheet.getCell(cell).font = {italic: true, bold: true};
            sheet.getCell(cell).border = {bottom: {style: "hair"}};
        }
        rows++;

        // Blank line
        sheet.addRow([]);
        rows++;
    }
    if (expenses.length === 0) {
        sheet.addRow(["<No expenses found>", "", 0, 0, 0, 0]);
        sheet.getCell(`A${6 + 4 + rows}`).font = {italic: true};
        for (let i = 0; i < 4; i++) {
            sheet.getCell(`${quarterCols[i]}${6 + 4 + rows}`).numFmt = currencyFormat;
        }
        rows++;
    }

    sheet.getCell(`A${6 + 4 + rows}`).value = "Total Expenses";
    sheet.getCell(`A${6 + 4 + rows}`).font = {bold: true};
    sheet.getCell(`A${6 + 4 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`B${6 + 4 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    for (const col of quarterCols) {
        const cell = `${col}${6+4+rows}`;
        sheet.getCell(cell).value = {
            formula: `SUM(${expenseSums.map(s => `${col}${s}`).join(", ")})`,
        };
        sheet.getCell(cell).numFmt = currencyFormat;
        sheet.getCell(cell).font = {bold: true};
        sheet.getCell(cell).border = {top: {style: "thin"}, bottom: {style: "double"}};
    }

    const expenseRow = 6 + 4 + rows;

    sheet.getCell(`A${6 + 6 + rows}`).value = "Revenue over Expenses";
    sheet.getCell(`A${6 + 6 + rows}`).font = {bold: true};
    sheet.getCell(`A${6 + 6 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`B${6 + 6 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    for (const col of quarterCols) {
        const cell = `${col}${6 + 6 + rows}`;
        sheet.getCell(cell).value = {
            formula: `${col}${incomeRow}-${col}${expenseRow}`,
        };
        sheet.getCell(cell).numFmt = currencyFormat;
        sheet.getCell(cell).font = {bold: true};
        sheet.getCell(cell).border = {top: {style: "thin"}, bottom: {style: "double"}};
    }

    sheet.columns[0].width = 22.25;
    for (let i = 0; i < 4; i++) {
        sheet.columns[i + 2].width = 14.625;
    }
    await workbook.xlsx.writeFile(path.join(outputPath, "./generated_income_expense_statement_quarters.xlsx"));
}

async function makeIncomeStatement(fiscalYearStart: Date, fiscalYearEnd: Date, priorFiscalYearStart:Date, priorFiscalYearEnd: Date, report: Report) {
    const balancesCurrentYear = await getCategoryBalances(fiscalYearStart, fiscalYearEnd);
    const balancesPriorYear = await getCategoryBalances(priorFiscalYearStart, priorFiscalYearEnd);

    for (const account of balancesPriorYear) {
        if (!balancesCurrentYear.find(b => b["category.name"] === account["category.name"])) {
            balancesCurrentYear.push({
                "category.group.name": account["category.group.name"],
                "category.name": account["category.name"],
                "category.is_income": account["category.is_income"],
                total: 0,
            });
        }
    }

    const groups = Array.from(new Set(balancesCurrentYear.map(b => b["category.group.name"])));
    const revenues = balancesCurrentYear.filter(b => b["category.is_income"]);
    const expenses = balancesCurrentYear.filter(b => !b["category.is_income"]);

    const page = report.addPage('Year - Income and Expense Stmt', [
        `Total FY ${fiscalYearEnd.getFullYear()}`,
        `Total FY ${priorFiscalYearEnd.getFullYear()}`,
    ]);
    page.setGrandTotalLine('Revenue over Expenses');

    const revenuesSection = page.addSection('Revenues');
    for (const account of revenues) {
        const priorBalance = balancesPriorYear.find(b => b["category.name"] === account["category.name"])?.total ?? 0;
        revenuesSection.addRow(account["category.name"], [account.total, priorBalance]);
    }

    const expensesSection = page.addSection('Expenses');
    for (const group of groups) {
        if (!expenses.find(e => e["category.group.name"] === group)) {
            continue;
        }

        const subsection = expensesSection.addSubsection(group);
        for (const account of expenses.filter(e => e["category.group.name"] === group)) {
            const priorBalance = (balancesPriorYear.find(b => b["category.name"] === account["category.name"])?.total ?? 0) * -1;
            subsection.addRow(account["category.name"], [account.total * -1, priorBalance]);
        }
    }
}

type Balance = {'account.id': string, 'account.name': string, balance: number};

async function getBalances(endDate: Date): Promise<Balance[]> {
    return ((await runQuery(q('transactions')
        .filter({date: {$lte: actualDate(endDate)}})
        .groupBy('account.id')
        .orderBy(['account.offbudget', 'account.sort_order', 'account.name'])
        .select(['account.id', 'account.name', {balance: {$sum: "$amount"}}])
    ) as { data: any }).data as { 'account.id': string, 'account.name': string, balance: number }[]).map(b => ({
        'account.id': b["account.id"],
        'account.name': b["account.name"],
        balance: utils.integerToAmount(b.balance) as number,
    }));
}

type CategoryBalance = {'category.group.name': string, 'category.name': string, 'category.is_income': boolean, total: number}

async function getCategoryBalances(startDate: Date, endDate: Date): Promise<CategoryBalance[]> {
    return ((await runQuery(q('transactions')
        .filter({$and: [{date: {$lte: actualDate(endDate)}}, {date: {$gte: actualDate(startDate)}}]})
        .groupBy('category.name')
        .orderBy(['category.group.sort_order', 'category.sort_order', 'category.name'])
        .select(['category.group.name', 'category.name', 'category.is_income', {total: {$sum: "$amount"}}])
    ) as { data: any }).data as {
        'category.group.name': string,
        'category.name': string,
        'category.is_income': boolean,
        total: number
    }[]).map(b => ({
        'category.group.name': b["category.group.name"],
        'category.name': b["category.name"],
        'category.is_income': b["category.is_income"],
        total: utils.integerToAmount(b.total) as number,
    })).filter(b => b["category.name"] !== null);
}
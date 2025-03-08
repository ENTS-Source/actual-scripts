import moment from "moment";
import {actualDate} from "../functions";
// @ts-ignore
import {q, runQuery, utils} from "@actual-app/api";
import * as ExcelJS from "exceljs";
import path from "node:path";

export async function reportsCommand(options: any) {
    const fiscalYearStart = moment(options.year, "YYYY-MM-DD").toDate();
    const fiscalYearEnd = moment(fiscalYearStart).add(1, 'year').add(-1, 'day').toDate();
    const priorFiscalYearStart = moment(fiscalYearStart).add(-1, 'year').toDate();
    const priorFiscalYearEnd = moment(fiscalYearEnd).add(-1, 'year').toDate();

    options.company = options.company.replaceAll(/\^/gim, "");

    await makeBalanceSheet(fiscalYearEnd, priorFiscalYearEnd, options.output, options.company);
    await makeIncomeStatement(fiscalYearStart, fiscalYearEnd, priorFiscalYearStart, priorFiscalYearEnd, options.output, options.company);
}

async function makeBalanceSheet(fiscalYearEnd: Date, priorFiscalYearEnd: Date, outputPath: string, companyName: string) {
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

    const asAtDate = fiscalYearEnd.getTime() > (new Date()).getTime() ? (new Date()) : fiscalYearEnd;
    const asAt = `As at ${moment(asAtDate).format("MMMM DD, YYYY")} (Fiscal Year ${fiscalYearEnd.getFullYear()})`;
    const assets = balancesCurrentYear.filter(b => b.balance >= 0);
    const liabilities = balancesCurrentYear.filter(b => b.balance < 0);

    const currencyFormat = "_($* #,##0.00_);_($* (#,##0.00);_($* \"-\"??_);_(@_)";

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Balance Sheet", {
        headerFooter: {
            firstHeader: `&C&BBalance Sheet\n${companyName}\n${asAt}`,
        },
    });

    sheet.mergeCells("A1:D1");
    sheet.getCell("A1").value = "Balance Sheet";
    sheet.getCell("A1").font = {bold: true, size: 14};
    sheet.getCell("A1").alignment = {horizontal: "center"};

    sheet.mergeCells("A2:D2");
    sheet.getCell("A2").value = companyName;
    sheet.getCell("A2").alignment = {horizontal: "center"};

    sheet.mergeCells("A3:D3");
    sheet.getCell("A3").value = asAt;
    sheet.getCell("A3").alignment = {horizontal: "center"};

    sheet.getCell("C5").value = `Total FY ${fiscalYearEnd.getFullYear()}`;
    sheet.getCell("C5").alignment = {horizontal: "right"};
    sheet.getCell("C5").font = {bold: true};

    sheet.getCell("D5").value = `Total FY ${priorFiscalYearEnd.getFullYear()}`;
    sheet.getCell("D5").alignment = {horizontal: "right"};
    sheet.getCell("D5").font = {bold: true};

    sheet.getCell("A6").value = "Assets";
    sheet.getCell("A6").font = {bold: true};

    sheet.getCell("A6").border = {top: {style: "thin"}, bottom: {style: "hair"}};
    sheet.getCell("B6").border = {top: {style: "thin"}, bottom: {style: "hair"}};
    sheet.getCell("C6").border = {top: {style: "thin"}, bottom: {style: "hair"}};
    sheet.getCell("D6").border = {top: {style: "thin"}, bottom: {style: "hair"}};

    let rows = 0;
    for (const account of assets) {
        const priorBalance = balancesPriorYear.find(b => b["account.id"] === account["account.id"])?.balance ?? 0;
        sheet.addRow([account["account.name"], "", account.balance, priorBalance]);
        sheet.getCell(`C${6 + 1 + rows}`).numFmt = currencyFormat;
        sheet.getCell(`D${6 + 1 + rows}`).numFmt = currencyFormat;
        rows++;
    }
    if (assets.length === 0) {
        sheet.addRow(["<No assets found>", "", 0, 0]);
        sheet.getCell(`A${6 + 1 + rows}`).font = {italic: true};
        sheet.getCell(`C${6 + 1 + rows}`).numFmt = currencyFormat;
        sheet.getCell(`D${6 + 1 + rows}`).numFmt = currencyFormat;
        rows++;
    }

    sheet.getCell(`A${6 + 1 + rows}`).value = "Total Assets";
    sheet.getCell(`A${6 + 1 + rows}`).font = {bold: true};

    sheet.getCell(`C${6 + 1 + rows}`).value = {
        formula: `SUM(C7:C${6 + rows})`,
        result: assets.reduce((c, b) => b.balance + c, 0)
    };
    sheet.getCell(`C${6 + 1 + rows}`).numFmt = currencyFormat;
    sheet.getCell(`C${6 + 1 + rows}`).font = {bold: true};

    sheet.getCell(`D${6 + 1 + rows}`).value = {
        formula: `SUM(D7:D${6 + rows})`,
        result: assets.reduce((c, b) => b.balance + c, 0)
    };
    sheet.getCell(`D${6 + 1 + rows}`).numFmt = currencyFormat;
    sheet.getCell(`D${6 + 1 + rows}`).font = {bold: true};

    sheet.getCell(`A${6 + 1 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`B${6 + 1 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`C${6 + 1 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`D${6 + 1 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};

    const assetsRow = 6 + 1 + rows;

    sheet.getCell(`A${6 + 3 + rows}`).value = "Liabilities";
    sheet.getCell(`A${6 + 3 + rows}`).font = {bold: true};

    sheet.getCell(`A${6 + 3 + rows}`).border = {top: {style: "thin"}, bottom: {style: "hair"}};
    sheet.getCell(`B${6 + 3 + rows}`).border = {top: {style: "thin"}, bottom: {style: "hair"}};
    sheet.getCell(`C${6 + 3 + rows}`).border = {top: {style: "thin"}, bottom: {style: "hair"}};
    sheet.getCell(`D${6 + 3 + rows}`).border = {top: {style: "thin"}, bottom: {style: "hair"}};

    const liabilitiesRows = rows;
    for (const account of liabilities) {
        const priorBalance = (balancesPriorYear.find(b => b["account.id"] === account["account.id"])?.balance ?? 0) * -1;
        account.balance = account.balance * -1;
        sheet.addRow([account["account.name"], "", account.balance, priorBalance]);
        sheet.getCell(`C${6 + 4 + rows}`).numFmt = currencyFormat;
        sheet.getCell(`D${6 + 4 + rows}`).numFmt = currencyFormat;
        rows++;
    }
    if (liabilities.length === 0) {
        sheet.addRow(["<No liabilities found>", "", 0]);
        sheet.getCell(`A${6 + 4 + rows}`).font = {italic: true};
        sheet.getCell(`C${6 + 4 + rows}`).numFmt = currencyFormat;
        sheet.getCell(`D${6 + 4 + rows}`).numFmt = currencyFormat;
        rows++;
    }

    sheet.getCell(`A${6 + 4 + rows}`).value = "Total Liabilities";
    sheet.getCell(`A${6 + 4 + rows}`).font = {bold: true};

    sheet.getCell(`C${6 + 4 + rows}`).value = {formula: `SUM(C${6 + 4 + liabilitiesRows}:C${6 + 3 + rows})`};
    sheet.getCell(`C${6 + 4 + rows}`).numFmt = currencyFormat;
    sheet.getCell(`C${6 + 4 + rows}`).font = {bold: true};

    sheet.getCell(`D${6 + 4 + rows}`).value = {formula: `SUM(D${6 + 4 + liabilitiesRows}:D${6 + 3 + rows})`};
    sheet.getCell(`D${6 + 4 + rows}`).numFmt = currencyFormat;
    sheet.getCell(`D${6 + 4 + rows}`).font = {bold: true};

    sheet.getCell(`A${6 + 4 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`B${6 + 4 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`C${6 + 4 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`D${6 + 4 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};

    const liabilitiesRow = 6 + 4 + rows;

    sheet.getCell(`A${6 + 6 + rows}`).value = "Net Assets";
    sheet.getCell(`A${6 + 6 + rows}`).font = {bold: true};

    sheet.getCell(`C${6 + 6 + rows}`).value = {formula: `C${assetsRow}-C${liabilitiesRow}`};
    sheet.getCell(`C${6 + 6 + rows}`).numFmt = currencyFormat;
    sheet.getCell(`C${6 + 6 + rows}`).font = {bold: true};

    sheet.getCell(`D${6 + 6 + rows}`).value = {formula: `D${assetsRow}-D${liabilitiesRow}`};
    sheet.getCell(`D${6 + 6 + rows}`).numFmt = currencyFormat;
    sheet.getCell(`D${6 + 6 + rows}`).font = {bold: true};

    sheet.getCell(`A${6 + 6 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`B${6 + 6 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`C${6 + 6 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`D${6 + 6 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};

    sheet.columns[0].width = 22.25;
    sheet.columns[2].width = 14.625;
    sheet.columns[3].width = 14.625;
    await workbook.xlsx.writeFile(path.join(outputPath, "./generated_balance_sheet.xlsx"));
}

async function makeIncomeStatement(fiscalYearStart: Date, fiscalYearEnd: Date, priorFiscalYearStart:Date, priorFiscalYearEnd: Date, outputPath: string, companyName: string) {
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

    const asAtDate = fiscalYearEnd.getTime() > (new Date()).getTime() ? (new Date()) : fiscalYearEnd;
    const asAt = `As at ${moment(asAtDate).format("MMMM DD, YYYY")} (Fiscal Year ${fiscalYearEnd.getFullYear()})`;
    const groups = Array.from(new Set(balancesCurrentYear.map(b => b["category.group.name"])));
    const revenues = balancesCurrentYear.filter(b => b["category.is_income"]);
    const expenses = balancesCurrentYear.filter(b => !b["category.is_income"]);

    const currencyFormat = "_($* #,##0.00_);_($* (#,##0.00);_($* \"-\"??_);_(@_)";

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Income and Expense Statement", {
        headerFooter: {
            firstHeader: `&C&BIncome and Expense Statement\n${companyName}\n${asAt}`,
        },
    });

    sheet.mergeCells("A1:D1");
    sheet.getCell("A1").value = "Income and Expense Statement";
    sheet.getCell("A1").font = {bold: true, size: 14};
    sheet.getCell("A1").alignment = {horizontal: "center"};

    sheet.mergeCells("A2:D2");
    sheet.getCell("A2").value = companyName;
    sheet.getCell("A2").alignment = {horizontal: "center"};

    sheet.mergeCells("A3:D3");
    sheet.getCell("A3").value = asAt;
    sheet.getCell("A3").alignment = {horizontal: "center"};

    sheet.getCell("C5").value = `Total FY ${fiscalYearEnd.getFullYear()}`;
    sheet.getCell("C5").alignment = {horizontal: "right"};
    sheet.getCell("C5").font = {bold: true};

    sheet.getCell("D5").value = `Total FY ${priorFiscalYearEnd.getFullYear()}`;
    sheet.getCell("D5").alignment = {horizontal: "right"};
    sheet.getCell("D5").font = {bold: true};

    sheet.getCell("A6").value = "Revenues";
    sheet.getCell("A6").font = {bold: true};

    sheet.getCell("A6").border = {top: {style: "thin"}, bottom: {style: "hair"}};
    sheet.getCell("B6").border = {top: {style: "thin"}, bottom: {style: "hair"}};
    sheet.getCell("C6").border = {top: {style: "thin"}, bottom: {style: "hair"}};
    sheet.getCell("D6").border = {top: {style: "thin"}, bottom: {style: "hair"}};

    let rows = 0;
    for (const account of revenues) {
        const priorBalance = balancesPriorYear.find(b => b["category.name"] === account["category.name"])?.total ?? 0;
        sheet.addRow([account["category.name"], "", account.total, priorBalance]);
        sheet.getCell(`C${6 + 1 + rows}`).numFmt = currencyFormat;
        sheet.getCell(`D${6 + 1 + rows}`).numFmt = currencyFormat;
        rows++;
    }
    if (revenues.length === 0) {
        sheet.addRow(["<No revenues found>", "", 0, 0]);
        sheet.getCell(`A${6 + 1 + rows}`).font = {italic: true};
        sheet.getCell(`C${6 + 1 + rows}`).numFmt = currencyFormat;
        sheet.getCell(`D${6 + 1 + rows}`).numFmt = currencyFormat;
        rows++;
    }

    sheet.getCell(`A${6 + 1 + rows}`).value = "Total Revenue";
    sheet.getCell(`A${6 + 1 + rows}`).font = {bold: true};

    sheet.getCell(`C${6 + 1 + rows}`).value = {
        formula: `SUM(C7:C${6 + rows})`,
        result: revenues.reduce((c, b) => b.total + c, 0)
    };
    sheet.getCell(`C${6 + 1 + rows}`).numFmt = currencyFormat;
    sheet.getCell(`C${6 + 1 + rows}`).font = {bold: true};

    sheet.getCell(`D${6 + 1 + rows}`).value = {
        formula: `SUM(D7:D${6 + rows})`,
        result: revenues.reduce((c, b) => b.total + c, 0)
    };
    sheet.getCell(`D${6 + 1 + rows}`).numFmt = currencyFormat;
    sheet.getCell(`D${6 + 1 + rows}`).font = {bold: true};

    sheet.getCell(`A${6 + 1 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`B${6 + 1 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`C${6 + 1 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`D${6 + 1 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};

    const incomeRow = 6 + 1 + rows;

    sheet.getCell(`A${6 + 3 + rows}`).value = "Expenses";
    sheet.getCell(`A${6 + 3 + rows}`).font = {bold: true};

    sheet.getCell(`A${6 + 3 + rows}`).border = {top: {style: "thin"}, bottom: {style: "hair"}};
    sheet.getCell(`B${6 + 3 + rows}`).border = {top: {style: "thin"}, bottom: {style: "hair"}};
    sheet.getCell(`C${6 + 3 + rows}`).border = {top: {style: "thin"}, bottom: {style: "hair"}};
    sheet.getCell(`D${6 + 3 + rows}`).border = {top: {style: "thin"}, bottom: {style: "hair"}};

    // Blank line for visual separation
    sheet.addRow([]);
    rows++;

    const expensesRows = rows;
    const expenseSums: number[] = [];
    for (const group of groups) {
        if (!expenses.find(e => e["category.group.name"] === group)) {
            continue;
        }

        // Intro line
        sheet.addRow([group]);
        sheet.getCell(`A${6 + 4 + rows}`).font = {italic: true, bold: true};
        sheet.getCell(`A${6 + 4 + rows}`).border = {bottom: {style: "hair"}};
        sheet.getCell(`B${6 + 4 + rows}`).border = {bottom: {style: "hair"}};
        sheet.getCell(`C${6 + 4 + rows}`).border = {bottom: {style: "hair"}};
        sheet.getCell(`D${6 + 4 + rows}`).border = {bottom: {style: "hair"}};
        rows++;

        // Expense lines
        const groupRows = rows;
        let currBalance = 0;
        let prevBalance = 0;
        for (const account of expenses.filter(b => b["category.group.name"] === group)) {
            const priorBalance = (balancesPriorYear.find(b => b["category.name"] === account["category.name"])?.total ?? 0) * -1;
            account.total = account.total * -1;
            sheet.addRow([account["category.name"], "", account.total, priorBalance]);
            sheet.getCell(`C${6 + 4 + rows}`).numFmt = currencyFormat;
            sheet.getCell(`D${6 + 4 + rows}`).numFmt = currencyFormat;
            rows++;

            currBalance += account.total;
            prevBalance += priorBalance;
        }

        // Total line
        expenseSums.push(6 + 4 + rows);
        sheet.getCell(`A${6 + 4 + rows}`).value = `Total ${group}`;
        sheet.getCell(`A${6 + 4 + rows}`).font = {italic: true, bold: true};
        sheet.getCell(`A${6 + 4 + rows}`).border = {bottom: {style: "hair"}};
        sheet.getCell(`B${6 + 4 + rows}`).border = {bottom: {style: "hair"}};
        sheet.getCell(`B${6 + 4 + rows}`).font = {italic: true, bold: true};
        sheet.getCell(`C${6 + 4 + rows}`).value = {
            formula: `SUM(C${6 + 4 + groupRows}:C${6 + 4 + rows - 1})`,
            result: currBalance
        };
        sheet.getCell(`C${6 + 4 + rows}`).border = {bottom: {style: "hair"}};
        sheet.getCell(`C${6 + 4 + rows}`).numFmt = currencyFormat;
        sheet.getCell(`C${6 + 4 + rows}`).font = {italic: true, bold: true};
        sheet.getCell(`D${6 + 4 + rows}`).value = {
            formula: `SUM(D${6 + 4 + groupRows}:D${6 + 4 + rows - 1})`,
            result: prevBalance
        };
        sheet.getCell(`D${6 + 4 + rows}`).border = {bottom: {style: "hair"}};
        sheet.getCell(`D${6 + 4 + rows}`).numFmt = currencyFormat;
        sheet.getCell(`D${6 + 4 + rows}`).font = {italic: true, bold: true};
        rows++;

        // Blank line
        sheet.addRow([]);
        rows++;
    }
    if (expenses.length === 0) {
        expenseSums.push(6 + 4 + rows);
        sheet.addRow(["<No expenses found>", "", 0, 0]);
        sheet.getCell(`A${6 + 4 + rows}`).font = {italic: true};
        sheet.getCell(`C${6 + 4 + rows}`).numFmt = currencyFormat;
        sheet.getCell(`D${6 + 4 + rows}`).numFmt = currencyFormat;
        rows++;
    }

    sheet.getCell(`A${6 + 4 + rows}`).value = "Total Expenses";
    sheet.getCell(`A${6 + 4 + rows}`).font = {bold: true};

    sheet.getCell(`C${6 + 4 + rows}`).value = {formula: `SUM(${expenseSums.map(s => `C${s}`).join(',')})`};
    sheet.getCell(`C${6 + 4 + rows}`).numFmt = currencyFormat;
    sheet.getCell(`C${6 + 4 + rows}`).font = {bold: true};

    sheet.getCell(`D${6 + 4 + rows}`).value = {formula: `SUM(${expenseSums.map(s => `D${s}`).join(',')})`};
    sheet.getCell(`D${6 + 4 + rows}`).numFmt = currencyFormat;
    sheet.getCell(`D${6 + 4 + rows}`).font = {bold: true};

    sheet.getCell(`A${6 + 4 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`B${6 + 4 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`C${6 + 4 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`D${6 + 4 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};

    const expenseRow = 6 + 4 + rows;

    sheet.getCell(`A${6 + 6 + rows}`).value = "Revenue over Expenses";
    sheet.getCell(`A${6 + 6 + rows}`).font = {bold: true};

    sheet.getCell(`C${6 + 6 + rows}`).value = {formula: `C${incomeRow}-C${expenseRow}`};
    sheet.getCell(`C${6 + 6 + rows}`).numFmt = currencyFormat;
    sheet.getCell(`C${6 + 6 + rows}`).font = {bold: true};

    sheet.getCell(`D${6 + 6 + rows}`).value = {formula: `D${incomeRow}-D${expenseRow}`};
    sheet.getCell(`D${6 + 6 + rows}`).numFmt = currencyFormat;
    sheet.getCell(`D${6 + 6 + rows}`).font = {bold: true};

    sheet.getCell(`A${6 + 6 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`B${6 + 6 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`C${6 + 6 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
    sheet.getCell(`D${6 + 6 + rows}`).border = {top: {style: "thin"}, bottom: {style: "double"}};

    sheet.columns[0].width = 22.25;
    sheet.columns[2].width = 14.625;
    sheet.columns[3].width = 14.625;
    await workbook.xlsx.writeFile(path.join(outputPath, "./generated_income_expense_statement.xlsx"));
}

async function getBalances(endDate: Date): Promise<{'account.id': string, 'account.name': string, balance: number}[]> {
    return ((await runQuery(q('transactions')
        .filter({date: {$lte: actualDate(endDate)}})
        .groupBy('account.id')
        .orderBy(['account.offbudget', 'account.sort_order'])
        .select(['account.id', 'account.name', {balance: {$sum: "$amount"}}])
    ) as { data: any }).data as { 'account.id': string, 'account.name': string, balance: number }[]).map(b => ({
        'account.id': b["account.id"],
        'account.name': b["account.name"],
        balance: utils.integerToAmount(b.balance) as number,
    }));
}

async function getCategoryBalances(startDate: Date, endDate: Date): Promise<{'category.group.name': string, 'category.name': string, 'category.is_income': boolean, total: number}[]> {
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
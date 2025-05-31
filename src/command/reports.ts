import moment from "moment";
import {actualDate} from "../functions";
// @ts-ignore
import {q, runQuery, utils} from "@actual-app/api";
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
    await makeIncomeStatementQuarters(fiscalYearStart, quarterDate, report);

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

async function makeIncomeStatementQuarters(fiscalYearStart: Date, fromDate: Date, report: Report) {
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


    const page = report.addPage('Income and Expense Statement', quarterNames.map(n => `Total ${n}`), 'Quarter - I&E Statement');

    const revenuesSection = page.addSection('Revenues');
    for (const account of revenues) {
        const quarterBalances = [
            balancesByQuarter[0].find(b => b["category.name"] === account["category.name"])?.total ?? 0,
            balancesByQuarter[1].find(b => b["category.name"] === account["category.name"])?.total ?? 0,
            balancesByQuarter[2].find(b => b["category.name"] === account["category.name"])?.total ?? 0,
            balancesByQuarter[3].find(b => b["category.name"] === account["category.name"])?.total ?? 0,
        ];
        revenuesSection.addRow(account["category.name"], quarterBalances);
    }

    const expensesSection = page.addSection('Expenses');
    for (const group of groups) {
        if (!expenses.find(e => e["category.group.name"] === group)) {
            continue;
        }

        const subsection = expensesSection.addSubsection(group);
        for (const account of expenses.filter(e => e["category.group.name"] === group)) {
            const balances = balancesByQuarter.map(b => (b.find(b => b["category.name"] === account["category.name"])?.total ?? 0) * -1);
            subsection.addRow(account["category.name"], balances);
        }
    }
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

    const page = report.addPage('Income and Expense Statement', [
        `Total FY ${fiscalYearEnd.getFullYear()}`,
        `Total FY ${priorFiscalYearEnd.getFullYear()}`,
    ], 'Year - I&E Statement');
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
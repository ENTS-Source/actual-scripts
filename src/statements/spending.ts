// @ts-ignore
import * as api from "@actual-app/api";
import moment from "moment";
import * as ExcelJS from "exceljs";
import {parse} from "csv-parse/sync";
import fs from "node:fs";


(async () => {
    // CHANGE ME
    const fiscalYear = 2025;
    const companyName = "Edmonton New Technology Society";

    const byShop = await getByShop("./txns_by_shop.csv");
    let order = ["Society", "Pottery", "Woodshop", "Metal shop"];
    order = order.concat(Array.from(byShop.keys()).filter(k => !order.includes(k)));
    const categorySpending = new Map<string, number>();
    for (const [_, records] of byShop) {
        for (const record of records) {
            if (!categorySpending.has(record.category)) {
                categorySpending.set(record.category, 0);
            }
            categorySpending.set(record.category, categorySpending.get(record.category)! + record.amount);
        }
    }
    const totalSpending = Array.from(categorySpending.values()).reduce((a,b) => a + b, 0);

    // Other details
    const fiscalYearStart = moment(`${fiscalYear - 1}-08-01`, "YYYY-MM-DD").toDate();
    const fiscalYearEnd = moment(fiscalYearStart).add(1, 'year').add(-1, 'day').toDate();

    const asAtDate = fiscalYearEnd.getTime() > (new Date()).getTime() ? (new Date()) : fiscalYearEnd;
    const asAt = `As at ${moment(asAtDate).format("MMMM DD, YYYY")} (Fiscal Year ${fiscalYearEnd.getFullYear()})`;

    const currencyFormat = "_($* #,##0.00_);_($* (#,##0.00);_($* \"-\"??_);_(@_)";
    const percentFormat = "0.00%";

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Shop Spending", {
        headerFooter: {
            firstHeader: `&C&BShop Spending\n${companyName}\n${asAt}`,
        },
    });

    sheet.mergeCells("A1:D1");
    sheet.getCell("A1").value = "Shop Spending";
    sheet.getCell("A1").font = {bold: true, size: 14};
    sheet.getCell("A1").alignment = {horizontal: "center"};

    sheet.mergeCells("A2:D2");
    sheet.getCell("A2").value = companyName;
    sheet.getCell("A2").alignment = {horizontal: "center"};

    sheet.mergeCells("A3:D3");
    sheet.getCell("A3").value = asAt;
    sheet.getCell("A3").alignment = {horizontal: "center"};

    sheet.getCell("C5").value = `Amount`;
    sheet.getCell("C5").alignment = {horizontal: "right"};
    sheet.getCell("C5").font = {bold: true};

    sheet.getCell("D5").value = `Of total`;
    sheet.getCell("D5").alignment = {horizontal: "right"};
    sheet.getCell("D5").font = {bold: true};

    // _-_---_-___--____---
    const offset = 6;
    let idx = 0;
    for (const shop of order) {
        sheet.getCell(`A${offset + idx}`).value = shop;
        sheet.getCell(`A${offset + idx}`).font = {bold: true};

        sheet.getCell(`A${offset + idx}`).border = {top: {style: "thin"}, bottom: {style: "hair"}};
        sheet.getCell(`B${offset + idx}`).border = {top: {style: "thin"}, bottom: {style: "hair"}};
        sheet.getCell(`C${offset + idx}`).border = {top: {style: "thin"}, bottom: {style: "hair"}};
        sheet.getCell(`D${offset + idx}`).border = {top: {style: "thin"}, bottom: {style: "hair"}};

        idx++;
        let startRow = idx + offset;
        let spend = 0;
        for (const category of categorySpending.keys()) {
            const amount = byShop.get(shop)!.filter(r => r.category === category).reduce((a,b) => a + b.amount, 0);
            spend += amount;
            sheet.addRow([category, "", amount, {formula: `C${offset+idx}/${categorySpending.get(category) ?? 0}`, result: amount/(categorySpending.get(category) ?? 0)}]);
            sheet.getCell(`C${offset + idx}`).numFmt = currencyFormat;
            sheet.getCell(`D${offset + idx}`).numFmt = percentFormat;
            idx++;
        }

        sheet.getCell(`A${offset + idx}`).value = "Total";
        sheet.getCell(`A${offset + idx}`).font = {bold: true};

        sheet.getCell(`C${offset + idx}`).value = {formula: `SUM(C${startRow}:C${offset + idx - 1})`, result: spend};
        sheet.getCell(`C${offset + idx}`).numFmt = currencyFormat;
        sheet.getCell(`C${offset + idx}`).font = {bold: true};

        sheet.getCell(`D${offset + idx}`).value = {formula: `C${offset + idx}/${totalSpending}`, result: spend/totalSpending};
        sheet.getCell(`D${offset + idx}`).numFmt = percentFormat;
        sheet.getCell(`D${offset + idx}`).font = {bold: true};

        sheet.getCell(`A${offset + idx}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
        sheet.getCell(`B${offset + idx}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
        sheet.getCell(`C${offset + idx}`).border = {top: {style: "thin"}, bottom: {style: "double"}};
        sheet.getCell(`D${offset + idx}`).border = {top: {style: "thin"}, bottom: {style: "double"}};

        idx++;
        idx++;
    }

    sheet.columns[0].width = 22.25;
    sheet.columns[2].width = 14.625;
    sheet.columns[3].width = 14.625;
    await workbook.xlsx.writeFile("./generated_shop_spend.xlsx");

    await api.shutdown();
})();

async function getByShop(filename: string) {
    const records = parse(fs.readFileSync(filename));
    const headers = records[0];

    const shopCol = headers.indexOf("Shop");
    const categoryCol = headers.indexOf("Category");
    const amountCol = headers.indexOf("Amount");

    const byShop = new Map<string, {category: string, amount: number}[]>();
    for (const record of records.slice(1)) {
        const shop = record[shopCol];
        if (shop.trim() === "") continue;
        const category = record[categoryCol];
        if (!byShop.has(shop)) {
            byShop.set(shop, []);
        }
        byShop.get(shop)!.push({category, amount: Math.abs(Number(record[amountCol]))});
    }
    return byShop;
}
// @ts-ignore
import * as api from "@actual-app/api";
// @ts-ignore
import {utils} from "@actual-app/api";
import {TDParser} from "../parsers/td";
import {StripeParser} from "../parsers/stripe";
import {PaypalParser} from "../parsers/paypal";
import {SquareParser} from "../parsers/square";
import {PlootoParser} from "../parsers/plooto";
import {ExactPaymentRecord, FeePaymentRecord, PaymentParser, PaymentRecord} from "../parsers/@types";
import {actualDate} from "../functions";

const TD_TYPE = "td";
const STRIPE_TYPE = "stripe";
const PAYPAL_TYPE = "paypal";
const SQUARE_TYPE = "square";
const PLOOTO_TYPE = "plooto";
export const SUPPORTED_TYPES = [TD_TYPE, STRIPE_TYPE, PAYPAL_TYPE, SQUARE_TYPE, PLOOTO_TYPE];

export async function importCommand(options: any) {
    const accounts = await api.getAccounts();
    const account = accounts.find(a => a.id === options.account);
    if (!account) {
        console.error(`Account ${options.account} not found`);
        return;
    }

    let parser: PaymentParser;
    switch (options.type) {
        case TD_TYPE:
            parser = new TDParser(options.file);
            break;
        case STRIPE_TYPE:
            parser = new StripeParser(options.file);
            break;
        case PAYPAL_TYPE:
            parser = new PaypalParser(options.file);
            break;
        case SQUARE_TYPE:
            parser = new SquareParser(options.file);
            break;
        case PLOOTO_TYPE:
            parser = new PlootoParser(options.file, Number(options.since));
            break;
        default:
            console.error(`Unknown import type ${options.type}`);
            return;
    }

    const payments = await parser.getPayments();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    for (const payment of payments) {
        if (minDate === null || payment.date.getTime() < minDate.getTime()) {
            minDate = payment.date;
        }
        if (maxDate === null || payment.date.getTime() > maxDate.getTime()) {
            maxDate = payment.date;
        }
    }

    console.log(account);
    console.log("Min: " + actualDate(minDate!) + " | " + minDate!.toString());
    console.log("Max: " + actualDate(maxDate!) + " | " + maxDate!.toString());


    const payees = await api.getPayees();
    const transactions = await api.getTransactions(account.id, minDate, maxDate);
    const findPayee = (payment: PaymentRecord): any => {
        let targetPayee: any = null;
        for (const payee of payees) {
            if (payee.name.toLowerCase() === payment.payee.toLowerCase()) {
                targetPayee = payee;
                break;
            }
        }
        return targetPayee;
    };
    const findTransaction = (payment: PaymentRecord): any => {
        const exactPayment = payment as ExactPaymentRecord;
        if (exactPayment.exact) {
            return null;
        }

        // Find the payee first
        const targetPayee = findPayee(payment);
        if (targetPayee === null) {
            // new transaction
            console.log(`Did not find payee for ${payment.payee}`);
            return null;
        }

        // Try to locate the transaction itself
        let targetTransaction: any = null;
        for (const transaction of transactions) {
            if (transaction.payee !== targetPayee.id) {
                continue;
            }
            if (transaction.amount !== utils.amountToInteger(payment.amount)) {
                continue;
            }
            if (transaction.date !== actualDate(payment.date)) {
                continue;
            }
            if (transaction.notes !== payment.id) {
                continue;
            }

            targetTransaction = transaction;
            break;
        }
        return targetTransaction;
    };

    const toImport: any[] = [];
    for (const payment of payments) {
        const transaction = findTransaction(payment);
        if (transaction === null) {
            console.log(`Did not find transaction for ${payment.id}`);
            if (payment.fee !== 0 && payment.subrecords !== undefined) {
                throw new Error("Cannot have a fee and subrecords");
            }
            const txn = {
                account: account.id,
                date: actualDate(payment.date),
                amount: utils.amountToInteger(payment.amount),
                payee_name: payment.payee,
                notes: payment.id,
            };
            if (payment.subrecords !== undefined) {
                (<any>txn).subtransactions = payment.subrecords.map(r => ({
                    amount: utils.amountToInteger(r.amount),
                    notes: r.description,
                }));
            }
            toImport.push(txn);
        }

        if (payment.fee !== 0) {
            const feeTransaction = findTransaction(new FeePaymentRecord(payment, "Fee"));
            if (feeTransaction === null) {
                console.log(`Did not find fee for ${payment.id}`);
                toImport.push({
                    account: account.id,
                    date: actualDate(payment.date),
                    amount: utils.amountToInteger(payment.fee),
                    payee_name: "Fee",
                    notes: payment.id,
                });
            }
        }
    }

    if (toImport.length > 0) {
        try {
            console.log("Importing: ", toImport.length);
            console.log(JSON.stringify(toImport, null, 2));
            console.log(await api.addTransactions(account.id, toImport, {runTransfers: true}));
        } catch (e) {
            console.error(e);
        }
    }
}
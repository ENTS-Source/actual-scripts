// @ts-ignore
import * as api from "@actual-app/api";
import {TDParser} from "../parsers/td";
import {StripeParser} from "../parsers/stripe";
import {PaypalParser} from "../parsers/paypal";
import {SquareParser} from "../parsers/square";
import {PlootoParser} from "../parsers/plooto";
import {PaymentParser} from "../parsers/@types";

const TD_TYPE = "td";
const STRIPE_TYPE = "stripe";
const PAYPAL_TYPE = "paypal";
const SQUARE_TYPE = "square";
const PLOOTO_TYPE = "plooto";
export const SUPPORTED_TYPES = [TD_TYPE, STRIPE_TYPE, PAYPAL_TYPE, SQUARE_TYPE, PLOOTO_TYPE];

export async function importCommand(options: any) {
    const accounts = await api.getAccounts();
    const account = accounts.find(a => a.name === options.account);
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
}
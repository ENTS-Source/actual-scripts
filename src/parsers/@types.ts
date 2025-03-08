export interface PaymentRecord {
    readonly id: string;
    readonly amount: number;
    readonly fee: number;
    readonly payee: string;
    readonly date: Date;
    readonly subrecords?: SubPaymentRecord[];
}

export interface SubPaymentRecord {
    readonly amount: number;
    readonly description: string;
}

export interface ExactPaymentRecord extends PaymentRecord {
    readonly exact: boolean;
}

export interface PaymentParser {
    readonly name: string;
    getPayments(): Promise<PaymentRecord[]>;
}

export class FeePaymentRecord implements PaymentRecord {
    public readonly id: string;
    public readonly amount: number;
    public readonly fee: number;
    public readonly payee: string;
    public readonly date: Date;

    constructor(record: PaymentRecord, payee: string) {
        this.id = record.id;
        this.amount = record.fee; // use fee instead
        this.fee = 0; // overridden
        this.payee = payee; // not copied
        this.date = record.date;
    }
}
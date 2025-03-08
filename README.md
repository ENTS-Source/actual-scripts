# actual-scripts
Import and reporting scripts for Actual Budget

## Installing

You will need a NodeJS LTS to run this.

```bash
git clone https://github.com/ENTS-Source/actual-scripts.git
cd actual-scripts
npm install
mkdir ./data
```

## Setup

Three pieces of information are needed to work with your data:

1. Your server URL. This is typically `http://localhost:5006` unless you've configured it to run elsewhere.
2. Your Actual Budget password. This is what you use to log in at the URL above.
3. Your Budget's ID. You can get this by going to Settings -> Show Advanced Settings -> Sync ID

To verify everything works, run `npm run sync -- -u http://localhost:5006 -p PASSWORD -b SYNC-ID`.

If you get "Could not get remote files", check your password. If your password has special characters, avoid or escape them.

## Usage

### Importing

Most importing can be done by acquiring a CSV from your bank and giving it to the import command.

You can get your account ID by running the following command. The URL, password, and Sync ID are the same as in the setup above.

```bash
npm run accounts -- -u http://localhost:5006 -p PASSWORD -b SYNC-ID
```

Then you can import with something like the following:

```bash
npm run import -- -u http://localhost:5006 -p PASSWORD -b SYNC-ID -a "26d22481-5aaf-48f2-9ce6-9f9a395bf33f" -t td -f ./td.csv
```

**Note the importer-specific instructions below.**

#### TD Imports

> ![WARNING]
> Records which are already imported need to be removed before running the import script.

1. Download a CSV from your TD Bank Account
2. Edit the CSV to exclude already-imported records.
3. Run `npm run import -- -u url -p password -b syncId -a "TD Canada Trust" -f ./td.csv -t td`

> ![WARNING]
> Column order matters for this importer.

Sample CSV:

```csv
02/28/2025,GC 5555-DEPOSIT     ,,140.00,55555.95
02/28/2025,MONTHLY PLAN FEE    ,4.95,,55551.00
02/28/2025,ACCT BAL REBATE     ,,4.95,55555.95
```

Headers are *not* included, but are:
```csv
Date,Description,Withdrawl,Deposit,Balance
```

#### Stripe Imports

TODO

#### PayPal Imports

TODO

#### Square Imports

TODO

#### Plooto Imports

> ![NOTE]
> Plooto records often need manual correction post-import. Use the `-s <unixmillis>` option to skip already-fixed records.

TODO

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

Your account name is as it appears in Actual Budget, case sensitive. The URL, password, and Sync ID are the same as in setup above.

Usage: `npm run import -- -u http://localhost:5006 -p PASSWORD -b SYNC-ID -a "TD Canada Trust" -f ./td.csv -t td`

#### TD Imports

> ![WARNING]
> Records which are already imported need to be removed before running the import script.

1. Download a CSV from your TD Bank Account
2. Edit the CSV to exclude already-imported records.
3. Run `npm run import -- -u url -p password -b syncId -a "TD Canada Trust" -f ./td.csv -t td`

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

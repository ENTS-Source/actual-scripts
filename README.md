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



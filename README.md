## Monthly Balance Wallet Plugin for bcoin

This is a plugin for a bcoin Wallet Node. It is intended for use with wallets
that _are not plugins themselves_, meaning they are run in a separate process
from a bcoin Full Node. It will record the balances from an array of wallets every
month, and can generate historical data with a rescan.

The original branch of this plugin (`master`) prints the output to a flat file.
This branch uses the
[Google Sheets API](https://developers.google.com/sheets/api/guides/concepts)
to record the data on Google Drive.

### Usage:

```
$ bcoin --no-wallet
$ bwallet \
   --plugins <path/to/monthly-balance.js> \
   ( --rescanheight=<height> )
```

### Configuration

#### Enable Google Sheets API

- Log in to Google and go to: https://console.developers.google.com/apis/dashboard

- Enable the Google Sheets API

- Under
[credentials](https://console.developers.google.com/apis/api/sheets.googleapis.com/credentials)
create a new "Service Account"

- Set the permissions (you don't need any)

- Click `CREATE KEY`, select the JSON option and download the file into `keys/credentials.json`
in this repo. A sample file `credentials-sample.json` is in that directory now.


#### Set up a sheet for the output

- Create a new Google Sheet

- Find the email address of the Serivce Account you created, and "share" the
sheet with that account, giving it access to edit.

- Name one tab `log`, and create a tab for each wallet (by name) you want a report for.


#### Configure monthly-balance

- Add the spreadsheet ID from the URL to a JSON file in `keys/config.json`, an example
`config-sample.json` is there for reference.

- Add an array of wallet names to the config file, these must match both the
tabs in the Google Sheet, and your actual wallet.

- Set the timezone relative to GMT, this will determine when months actually start.



### Method

If `rescanheight` is given at launch this plugin will directly run a rescan on
the provided wallets starting from the given height. This is currently necessary until
[a socket timeout error](https://github.com/bcoin-org/bcoin/issues/842)
is fixed. The plugin stubs the `'block rescan'` socket hook in WalletDB and
checks the timestamp of every block that gets passed to the wallet. After
scanning the _first block of each month_ (GMT by default, adjusted by the
`timezone` option) the wallet's balance is queried, reported in
the log and added to the output.

Once the rescan has finished (or if no rescan was triggered at all, i.e. no
`--rescanheight` parameter was set), the plugin will continue to monitor each
new block added to the chain (and WalletDB) by listening for `'block connect'`
events, and continue to report wallet balances after the first block of each new
month.

### Warnings

Due to the socket timeout error mentioned above, manually commanding a wallet
rescan while the plugin is running (with any configuration) could have undefined
consequences.

In addition, an inconsequential log message may appear declaring
`Job not found for <number>` when a rescan finishes. This is the result of the
full node's chain rescan method trying to return to a deleted socket job.

The operator must also take care in inspecting the output. Block timestamps are
only required to be accurate within two hours. Sometimes timestamps
in Bitcoin blocks go backwards, creating (for our purposes) a month that seems
to start over:

```
Block 267188 (Fri, 01 Nov 2013 00:02:47 GMT) TXs: 22 Balance: 1.0431836
Block 272375 (Sun, 01 Dec 2013 00:45:36 GMT) TXs: 28 Balance: 0.0585
Block 272376 (Sat, 30 Nov 2013 23:25:57 GMT) TXs: 28 Balance: 0.0585
Block 272381 (Sun, 01 Dec 2013 01:45:02 GMT) TXs: 28 Balance: 0.0585
Block 277996 (Wed, 01 Jan 2014 00:11:09 GMT) TXs: 34 Balance: 0.01
```

For the above case, the first December block (272375) is likely the correct
balance to use. Luckily this wallet's balance did not fluctuate while the miners
fought over when December began.

## Monthly Balance Wallet Plugin for bcoin

This is a plugin for a bcoin Wallet Node. It is intended for use with wallets
that _are not plugins themselves_, meaning they are run in a separate process
from a bcoin Full Node. It will record the balance of a specified wallet every
month, and can generate historical data with a rescan.

### Usage:

```
$ bcoin --no-wallet
$ bwallet \
   --plugins <path/to/monthly-balance.js> \
   --reportwallet=<walletID> \
   --reportpath=<path/to/outputfile.txt> \
   --rescanheight=<height> \
   --timezone=<# hours + GMT>
```

### Example Output:

(Generated with a watch-only wallet watching one address:
`1andreas3batLhQa2FawWjeyjCqyBzypd`)

```
 -- OPENED at Wed, 11 Sep 2019 18:35:32 GMT Wallet: andreas
Block 594382 (Wed, 11 Sep 2019 18:30:45 GMT) TXs: 0 Balance: 0
Block 235300 (Thu, 09 May 2013 11:36:34 GMT) TXs: 0 Balance: 0
Block 238952 (Sat, 01 Jun 2013 00:05:26 GMT) TXs: 2 Balance: 15.05
Block 244160 (Mon, 01 Jul 2013 00:02:11 GMT) TXs: 5 Balance: 0
Block 249525 (Thu, 01 Aug 2013 00:06:59 GMT) TXs: 7 Balance: 0
Block 255362 (Sun, 01 Sep 2013 00:00:58 GMT) TXs: 9 Balance: 0.10005311
Block 260989 (Tue, 01 Oct 2013 00:07:44 GMT) TXs: 17 Balance: 0.5656335
Block 267188 (Fri, 01 Nov 2013 00:02:47 GMT) TXs: 22 Balance: 1.0431836
Block 272375 (Sun, 01 Dec 2013 00:45:36 GMT) TXs: 28 Balance: 0.0585
Block 272376 (Sat, 30 Nov 2013 23:25:57 GMT) TXs: 28 Balance: 0.0585
Block 272381 (Sun, 01 Dec 2013 01:45:02 GMT) TXs: 28 Balance: 0.0585
Block 277996 (Wed, 01 Jan 2014 00:11:09 GMT) TXs: 34 Balance: 0.01
Block 283468 (Sat, 01 Feb 2014 00:05:46 GMT) TXs: 69 Balance: 0.30723543
...
```

### Method

If `rescanheight` is given at launch this plugin will directly run a rescan on
the wallet selected by `reportwallet` starting from the given height.
This is currently necessary until
[a socket timeout error](https://github.com/bcoin-org/bcoin/issues/842)
is fixed. The plugin stubs the `'block rescan'` socket hook in WalletDB and
checks the timestamp of every block that gets passed to the wallet. After
scanning the _first block of each month_ (GMT by default, adjusted by the
argument `--timezone=<number>`), the wallet's balance is queried, reported in
the log and added to the output file.

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

/*
 * Monthly wallet balance plugin for bcoin
 * USAGE:
 *   bcoin --no-wallet
 *   bwallet \
 *     --plugins <path/to/monthly-balance.js> \
 *     ( --rescanheight=<height> )
 */

'use strict';

const EventEmitter = require('events');
const assert = require('assert');
const fs = require('fs');
const Path = require('path');
const plugin = exports;
const {writeSheet} = require('./lib/sheets');

const CONF_PATH = Path.join(__dirname, 'keys', 'config.json');
const conf = JSON.parse(fs.readFileSync(CONF_PATH));
const SPREADSHEET_ID = conf.sheetID;
const WALLETS = conf.wallets;

class Plugin extends EventEmitter {
  constructor(node) {
    super();

    // This is a Wallet Node, not a full/SPV node
    this.node = node;
    this.wdb = this.node.wdb;
    this.client = this.node.client;

    this.wallets = [];
    this.rescanheight = this.node.config.uint('rescanheight');
    this.timezone = conf.timezone;

    this.logger = node.logger.context('monthly-balance');

    this.lastBlockToScan = null;
    this.unlock = null;
    this.month = -1;
  }

  /*
   * Called once on launch: sets up listeners and maybe starts a rescan
   */

  async open() {
    const now = this.adjTime(new Date(Date.now()));

    await writeSheet(
      SPREADSHEET_ID,
      'log',
      [`OPEN at ${this.tzString(now)} Wallets: ${WALLETS.toString()}`]
    );

    for (const id of WALLETS) {
      const wallet = await this.wdb.get(id);
      this.wallets.push(wallet);
    }

    // These events are sent to the wallet when blocks are added to the chain
    this.client.bind('block connect', async (entry, txs) => {
      if (!this.unlock)
        await this.block(entry);
    });

    // Steal this hook - sent to wallet when a historical block is (re)scanned
    this.client.socket.unhook('block rescan');
    this.client.hook('block rescan', async (entry, txs) => {
      // Run the original hook handler
      try {
        await this.wdb.rescanBlock(entry, txs);
      } catch (e) {
        this.wdb.emit('error', e);
        this.logger.error(e);
      }

      // Then check if this block is a month boundary
      await this.block(entry);
    });

    // Check for command and possibly initiate a rescan from the node
    if (this.rescanheight)
      return this.rescan(this.rescanheight);
    else
      return null;
  }

  /*
   * Copies the usual WalletDB.rescan() process but protected from timeout bug
   */

  async rescan(height) {
    assert((height >>> 0) === height, 'Must pass in an integer height.');

    // Get current tip height from node
    const chainTip = await this.client.getTip();
    this.lastBlockToScan = chainTip.height;

    // Lock WalletDB and begin rescan
    this.unlock = await this.wdb.txLock.lock();
    this.wdb.rescanning = true;

    this.logger.warning(`Rolling back WalletDB to height ${height}.`);
    await this.wdb.rollback(height);

    this.logger.warning('Initiating rescan.');
    const tip = await this.wdb.getTip();
    const start = tip.hash.reverse().toString('hex');

    try {
      // This socket call will timeout after 10 minutes
      await this.client.rescan(start);
    } catch(e) {
      this.logger.warning(`Expected timeout error caught: ${e}`);
    }
  }

  /*
   * Checks the timestamp of every block and reports balance every new month
   */

  async block(entry) {
    const date = this.adjTime(new Date(entry.time * 1000));
    const blockMonth = date.getUTCMonth();
    const dateStr = this.tzString(date);

    // Skip the initialization
    if (this.month === -1) {
      this.month = blockMonth;
      return;
    }

    this.logger.info(`Scanning block ${entry.height} (${dateStr})`);

    // If it's a new month, get the wallet balance and report
    if (blockMonth !== this.month) {
      this.month = blockMonth;

      for (const wallet of this.wallets) {
        const bal = await wallet.getBalance();

        try {
          const res = await writeSheet(
            SPREADSHEET_ID,
            wallet.id,
            [
              entry.height,
              dateStr,
              bal.tx,
              bal.unconfirmed / 1e8,
              bal.confirmed / 1e8
            ]
          );
          this.logger.info(res);
        } catch(e) {
          this.logger.error(e);
        }

        const report =
          `Wallet: ${wallet.id} `
          + `TXs: ${bal.tx} `
          + `Unconfirmed: ${bal.unconfirmed / 1e8} `
          + `Confirmed: ${bal.confirmed / 1e8}`;
        this.logger.info(report);
      }
    }

    // If we have scanned all the way to the chain tip, historical data is done.
    if (this.unlock && entry.height === this.lastBlockToScan) {
      this.logger.warning(`Target rescan block ${entry.height} reached.`);
      this.wdb.rescanning = false;
      this.unlock();
      this.unlock = null;
    }
  }

  adjTime(date) {
    date.setUTCHours(date.getUTCHours() + this.timezone);
    return date;
  }

  tzString(date) {
    const dateStr = date.toUTCString();
    if (this.timezone) {
      return `${dateStr}` +
       `${this.timezone > 0 ? '+' : ''}` +
       `${this.timezone}`;
    } else {
      return dateStr;
    }
  }
}

plugin.id = 'monthly-balance';

plugin.init = function init(node) {
  return new Plugin(node);
};

'use strict';

const fs = require('fs');
const Path = require('path');
const {google} = require('googleapis');
const sheets = google.sheets('v4');

const SHEETID_PATH = Path.join(__dirname, '..', 'keys', 'sheetID.txt');
const SPREADSHEET_ID = fs.readFileSync(SHEETID_PATH).toString('ascii');

const CRED_PATH = Path.join(__dirname, '..', 'keys', 'credentials.json');
const file = fs.readFileSync(CRED_PATH);
const json = JSON.parse(file);

const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

const client = new google.auth.JWT(
  json.client_email,
  null,
  json.private_key,
  scopes);

async function writeSheet(data) {
  // This gives us one hour of access
  await client.authorize();

  const req = {
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A1:E1',
    valueInputOption: 'RAW',
    resource: {
      'values': [data]
    },
    auth: client
  };

  sheets.spreadsheets.values.append(req, (err, res) => {
    if (err)
      throw err;

    return `Updated spreadsheet range: ${res.data.updates.updatedRange}`;
  });
}

async function writeLog(data) {
  // This gives us one hour of access
  await client.authorize();

  const req = {
    spreadsheetId: SPREADSHEET_ID,
    range: 'log!A1',
    valueInputOption: 'RAW',
    resource: {
      'values': [data]
    },
    auth: client
  };

  sheets.spreadsheets.values.append(req, (err, res) => {
    if (err)
      throw err;

    return `Updated spreadsheet range: ${res.data.updates.updatedRange}`;
  });
}

exports.writeSheet = writeSheet;
exports.writeLog = writeLog;

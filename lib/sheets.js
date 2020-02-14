'use strict';

const fs = require('fs');
const Path = require('path');
const {google} = require('googleapis');
const sheets = google.sheets('v4');

const CRED_PATH = Path.join(__dirname, '..', 'keys', 'credentials.json');
const cred = JSON.parse(fs.readFileSync(CRED_PATH));

const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

const client = new google.auth.JWT(
  cred.client_email,
  null,
  cred.private_key,
  scopes);

async function writeSheet(sheetID, sheet, data) {
  // This gives us one hour of access
  await client.authorize();

  const req = {
    spreadsheetId: sheetID,
    range: `${sheet}!A1:A1`,
    valueInputOption: 'RAW',
    resource: {
      'values': [data]
    },
    auth: client
  };

  const res = await sheets.spreadsheets.values.append(req);
  return `Updated spreadsheet range: ${res.data.updates.updatedRange}`;
}

exports.writeSheet = writeSheet;

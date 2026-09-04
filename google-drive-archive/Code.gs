const ARCHIVE_SHEET_ID = '1FdvFqppeexqkwWjOuCY7wE1SsQ22jRF13QeB8hD8tks';
const ARCHIVE_TAB = 'ARSIP HARIAN';
const EXPECTED_COLUMNS = 38;

function doGet() {
  return jsonResponse_({ ok: true, service: 'Arsip Jurnal 7 KAIH' });
}

function doPost(event) {
  try {
    const body = JSON.parse(event && event.postData && event.postData.contents || '{}');
    const expectedSecret = 'a88a0c5d6fb12f8adef94c7f525f3c6026d41a9cc13f3071';

    if (!expectedSecret || body.secret !== expectedSecret) {
      return jsonResponse_({ ok: false, error: 'Akses ditolak.' });
    }
    if (!Array.isArray(body.row) || body.row.length !== EXPECTED_COLUMNS) {
      return jsonResponse_({ ok: false, error: 'Format baris arsip tidak valid.' });
    }

    const row = body.row.map(safeCell_);
    const entryId = String(row[0] || '').trim();
    if (!entryId) return jsonResponse_({ ok: false, error: 'ID entri wajib diisi.' });

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sheet = SpreadsheetApp.openById(ARCHIVE_SHEET_ID).getSheetByName(ARCHIVE_TAB);
      if (!sheet) throw new Error('Tab arsip tidak ditemukan.');

      const existing = sheet.getRange('A:A').createTextFinder(entryId).matchEntireCell(true).findNext();
      const rowNumber = existing ? existing.getRow() : Math.max(sheet.getLastRow() + 1, 2);
      sheet.getRange(rowNumber, 1, 1, EXPECTED_COLUMNS).setValues([row]);
      SpreadsheetApp.flush();

      return jsonResponse_({ ok: true, entryId: entryId, rowNumber: rowNumber });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error && error.message || error) });
  }
}

function safeCell_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

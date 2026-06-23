const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument();
const scratchDir = __dirname;
const pdfPath = path.join(scratchDir, 'accounting_test.pdf');

doc.pipe(fs.createWriteStream(pdfPath));

doc.fontSize(16).text('Accounting Chapter: Asset Depreciation', 100, 100);
doc.moveDown();

doc.fontSize(12).text(
  'Depreciation is an accounting method of allocating the cost of a tangible or physical asset over its useful life or life expectancy. ' +
  'Depreciation represents how much of an assets value has been used up. ' +
  'Depreciation is recorded as a debit to depreciation expense and a credit to accumulated depreciation. ' +
  'Accumulated depreciation is a contra-asset account, meaning it is paired with the asset account and reduces its book value. ' +
  'Straight Line Depreciation is calculated as: (Cost of Asset - Salvage Value) / Useful Life. ' +
  'Salvage value is the estimated resale value of an asset at the end of its useful life. ' +
  'Useful life is the duration of time over which an asset is expected to be useful for business operations. ' +
  'Double Declining Balance is an accelerated depreciation method that depreciates the asset at twice the straight-line rate.',
  100, 130
);

doc.end();
console.log('PDF created successfully at:', pdfPath);

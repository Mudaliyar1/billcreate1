const { generateUpiQRCodeDataURL } = require('./utils/generateQRCode');
const { generateBillPDF } = require('./utils/pdfGenerator');
const fs = require('fs');
const path = require('path');

// Create a sample bill
const sampleBill = {
  billNumber: 'TEST-001',
  date: new Date(),
  customer: {
    name: 'Test Customer',
    phone: '1234567890',
    place: 'Test Place'
  },
  work: 'Test Work',
  pickedBy: 'Test User',
  items: [
    {
      name: 'Test Product',
      category: 'Test Category',
      price: 100,
      quantity: 2
    }
  ],
  totalAmount: 200,
  paidAmount: 200,
  remainingAmount: 0,
  paymentType: 'Cash'
};

// Path to save the PDF
const pdfPath = path.join(__dirname, 'public/bills/test-bill.pdf');

// Generate PDF
console.log('Generating test PDF...');
generateBillPDF(sampleBill, pdfPath)
  .then(() => {
    console.log('PDF generated successfully at:', pdfPath);
    console.log('Please check the PDF to verify the QR code position.');
  })
  .catch(error => {
    console.error('Error generating PDF:', error);
  });

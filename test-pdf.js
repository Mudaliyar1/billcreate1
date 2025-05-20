const { generateBillPDF } = require('./utils/pdfGenerator');
const fs = require('fs');
const path = require('path');

// Create a mock bill object
const mockBill = {
  billNumber: 'TEST001',
  customer: {
    name: 'Test Customer',
    phone: '9876543210',
    place: 'Test Location'
  },
  work: 'Test Work',
  pickedBy: 'Test Picker',
  items: [
    {
      name: 'Test Item 1',
      category: 'Board',
      price: 100,
      quantity: 2
    },
    {
      name: 'Test Item 2',
      category: 'Hardware',
      price: 50,
      quantity: 3
    }
  ],
  totalAmount: 350,
  paymentType: 'Cash',
  paidAmount: 350,
  remainingAmount: 0
};

// Ensure the directory exists
const pdfDir = path.join(__dirname, 'public/bills');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

// Generate the PDF
const pdfPath = path.join(pdfDir, 'test-bill.pdf');
generateBillPDF(mockBill, pdfPath)
  .then(() => {
    console.log(`PDF generated successfully at: ${pdfPath}`);
  })
  .catch((error) => {
    console.error('Error generating PDF:', error);
  });

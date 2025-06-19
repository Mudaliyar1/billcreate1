const { generateBillPDF } = require('./utils/pdfGenerator');
const fs = require('fs');
const path = require('path');

// Create a mock bill object with Hindi text
const mockBill = {
  billNumber: 'KT-2025-0123',
  billDate: new Date(),
  customer: {
    name: 'नागरावेला टेस्ट', // Hindi name
    phone: '9724066417',
    place: 'अहमदाबाद' // Hindi place name
  },
  work: 'डेकोरेशन काम', // Hindi work description
  pickedBy: 'Admin',
  items: [
    {
      name: 'सोफा सेट', // Hindi product name
      category: 'Furniture',
      price: 5000,
      quantity: 1
    },
    {
      name: 'कुर्सी', // Hindi product name
      category: 'Chair',
      price: 1500,
      quantity: 4
    }
  ],
  subTotal: 11000,
  gstEnabled: true,
  gstPercentage: 18,
  gstType: 'CGST+SGST',
  gstAmount: 1980,
  discountAmount: 0,
  totalAmount: 12980,
  paymentType: 'Cash',
  paidAmount: 12980,
  remainingAmount: 0,
  createdAt: new Date()
};

// Ensure the directory exists
const pdfDir = path.join(__dirname, 'public/bills');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

// Generate the PDF
const pdfPath = path.join(pdfDir, 'test-hindi-bill.pdf');

console.log('Testing PDF generation with Hindi text...');
console.log('Customer name:', mockBill.customer.name);
console.log('Place:', mockBill.customer.place);
console.log('Work:', mockBill.work);
console.log('Items:', mockBill.items.map(item => item.name));

generateBillPDF(mockBill, pdfPath)
  .then(() => {
    console.log(`✅ PDF generated successfully at: ${pdfPath}`);
    console.log('Please check the PDF to see if Hindi text is displayed correctly.');
  })
  .catch((error) => {
    console.error('❌ Error generating PDF:', error);
  });

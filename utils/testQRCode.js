const fs = require('fs');
const path = require('path');
const { generateUpiQRCode } = require('./generateQRCode');
const { generateBillPDF } = require('./pdfGenerator');

// Test QR code generation
async function testQRCode() {
  console.log('Testing QR code generation...');

  // Path to save the QR code
  const qrImagePath = path.join(__dirname, '../public/images/upi-qr.png');

  try {
    // Remove existing QR code if it exists
    if (fs.existsSync(qrImagePath)) {
      fs.unlinkSync(qrImagePath);
      console.log('Removed existing QR code');
    }

    // Generate new QR code
    await generateUpiQRCode('bindukumaryadav59-1@okhdfcbank', qrImagePath);

    // Verify the file was created
    if (fs.existsSync(qrImagePath)) {
      const stats = fs.statSync(qrImagePath);
      console.log('QR code created successfully, size:', stats.size, 'bytes');
    } else {
      console.error('QR code file was not created');
    }
  } catch (error) {
    console.error('Error testing QR code generation:', error);
  }
}

// Test PDF generation with QR code
async function testPDF() {
  console.log('Testing PDF generation with QR code...');
  console.log('This may take a few seconds...');

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
  const pdfPath = path.join(__dirname, '../public/bills/test-bill.pdf');

  try {
    // Generate PDF
    const result = await generateBillPDF(sampleBill, pdfPath);
    console.log('PDF generated successfully at:', result);
  } catch (error) {
    console.error('Error testing PDF generation:', error);
  }
}

// Run tests
async function runTests() {
  console.log('=== Starting QR Code and PDF Tests ===');
  try {
    console.log('\n1. Testing QR Code Generation:');
    await testQRCode();

    console.log('\n2. Testing PDF Generation with QR Code:');
    await testPDF();

    console.log('\n=== All tests completed successfully ===');
  } catch (error) {
    console.error('\n=== Test failed with error: ===', error);
  }
}

// Execute tests
console.log('Starting tests...');
runTests().then(() => {
  console.log('Tests finished.');
  console.log('\nTest PDF generated at: ' + path.join(__dirname, '../public/bills/test-bill.pdf'));
  console.log('Please check the PDF to verify the QR code position.');
}).catch(err => {
  console.error('Tests failed with error:', err);
});

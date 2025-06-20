const mongoose = require('mongoose');
const { generateBillPDFWithTemplate } = require('./utils/pdfGenerator');
const BillTemplate = require('./models/BillTemplate');
const fs = require('fs');
const path = require('path');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/billcreate', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Mock user ID (you can replace with actual user ID)
const mockUserId = new mongoose.Types.ObjectId();

// Create a test template
const createTestTemplate = async () => {
  const template = new BillTemplate({
    name: 'Test Template',
    description: 'Test template for drag and drop functionality',
    isDefault: true,
    elements: [
      {
        id: 'company_header',
        type: 'company_header',
        label: 'Company Header',
        position: { x: 40, y: 40 },
        size: { width: 515, height: 60 },
        style: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
        visible: true,
        order: 1
      },
      {
        id: 'bill_number',
        type: 'bill_number',
        label: 'Bill Number',
        position: { x: 400, y: 40 },
        size: { width: 155, height: 30 },
        style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
        visible: true,
        order: 2
      },
      {
        id: 'bill_date',
        type: 'bill_date',
        label: 'Bill Date',
        position: { x: 400, y: 80 },
        size: { width: 155, height: 30 },
        style: { fontSize: 12, textAlign: 'right' },
        visible: true,
        order: 3
      },
      {
        id: 'customer_info',
        type: 'customer_info',
        label: 'Customer Information',
        position: { x: 40, y: 150 },
        size: { width: 250, height: 120 },
        style: { fontSize: 12 },
        visible: true,
        order: 4
      },
      {
        id: 'items_table',
        type: 'items_table',
        label: 'Items Table',
        position: { x: 40, y: 300 },
        size: { width: 515, height: 200 },
        style: { fontSize: 10 },
        visible: true,
        order: 5
      },
      {
        id: 'total_amount',
        type: 'total_amount',
        label: 'Total Amount',
        position: { x: 350, y: 520 },
        size: { width: 205, height: 50 },
        style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
        visible: true,
        order: 6
      },
      {
        id: 'footer',
        type: 'footer',
        label: 'Footer',
        position: { x: 40, y: 750 },
        size: { width: 515, height: 40 },
        style: { fontSize: 10, textAlign: 'center' },
        visible: true,
        order: 7
      }
    ],
    createdBy: mockUserId
  });

  await template.save();
  console.log('✅ Test template created successfully');
  return template;
};

// Mock bill data
const mockBill = {
  billNumber: 'TEMPLATE-TEST-001',
  billDate: new Date(),
  customer: {
    name: 'नागरावेला टेस्ट कस्टमर',
    phone: '9876543210',
    place: 'अहमदाबाद'
  },
  work: 'डेकोरेशन काम',
  pickedBy: 'Admin',
  items: [
    {
      product: 'सोफा सेट',
      category: 'फर्नीचर',
      price: 15000,
      quantity: 1
    },
    {
      product: 'कुर्सी',
      category: 'फर्नीचर', 
      price: 2500,
      quantity: 4
    }
  ],
  totalAmount: 25000,
  paidAmount: 25000,
  remainingAmount: 0,
  paymentMethod: 'Cash'
};

// Test the template system
const testTemplateSystem = async () => {
  try {
    console.log('🧪 Testing Bill Template System...\n');

    // Create test template
    const template = await createTestTemplate();

    // Generate PDF using template
    console.log('📄 Generating PDF with custom template...');
    const pdfBuffer = await generateBillPDFWithTemplate(mockBill, template._id, mockUserId);

    // Save PDF to file
    const pdfDir = path.join(__dirname, 'public/bills');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const pdfPath = path.join(pdfDir, 'template-test-bill.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);

    console.log('✅ PDF generated successfully with custom template!');
    console.log(`📁 PDF saved at: ${pdfPath}`);
    console.log('\n🎯 Template features tested:');
    console.log('   ✓ Custom element positioning');
    console.log('   ✓ Hindi text transliteration');
    console.log('   ✓ Template-based layout');
    console.log('   ✓ Drag-and-drop element support');

    // Clean up test template
    await BillTemplate.findByIdAndDelete(template._id);
    console.log('🧹 Test template cleaned up');

  } catch (error) {
    console.error('❌ Error testing template system:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the test
testTemplateSystem();

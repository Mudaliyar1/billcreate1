const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { generateUpiQRCodeDataURL } = require('./generateQRCode');

// Register the Hindi font - try multiple font options including system fonts
const fontOptions = [
  path.join(__dirname, '../fonts/NotoSansDevanagari-Variable.ttf'),
  path.join(__dirname, '../fonts/Tinos-Regular.ttf'),
  // Try system fonts that might support Hindi
  'C:\\Windows\\Fonts\\mangal.ttf',
  'C:\\Windows\\Fonts\\aparaj.ttf',
  'C:\\Windows\\Fonts\\kokila.ttf',
  'C:\\Windows\\Fonts\\utsaah.ttf'
];

// Find the first available font and validate it's actually a font file
let hindiFont = null;
for (const fontPath of fontOptions) {
  if (fs.existsSync(fontPath)) {
    try {
      // Check if file is actually a font by reading first few bytes
      const buffer = fs.readFileSync(fontPath, { start: 0, end: 4 });
      const header = buffer.toString('hex');
      // TTF files start with specific headers (in hex)
      if (header === '00010000' || header === '4f54544f' || header === '74727565' || header === '74797031') {
        hindiFont = fontPath;
        console.log(`Valid Hindi font found: ${fontPath}`);
        break;
      } else {
        console.warn(`Invalid font file header: ${fontPath} - ${header}`);
      }
    } catch (error) {
      console.warn(`Error checking font file ${fontPath}:`, error.message);
    }
  }
}

if (!hindiFont) {
  console.warn('No valid Hindi font found. Hindi text will be transliterated to Roman characters.');
}

// Helper function to detect if text contains Hindi/Devanagari characters
const containsHindi = (text) => {
  if (!text) return false;
  // Devanagari Unicode range: U+0900–U+097F
  return /[\u0900-\u097F]/.test(text);
};

// Enhanced transliteration map for common Hindi characters to Roman
const hindiToRoman = {
  // Vowels
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ii', 'उ': 'u', 'ऊ': 'uu', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  'ऋ': 'ri', 'ॠ': 'rii', 'ऌ': 'li', 'ॡ': 'lii',

  // Consonants
  'क': 'ka', 'ख': 'kha', 'ग': 'ga', 'घ': 'gha', 'ङ': 'nga',
  'च': 'cha', 'छ': 'chha', 'ज': 'ja', 'झ': 'jha', 'ञ': 'nya',
  'ट': 'ta', 'ठ': 'tha', 'ड': 'da', 'ढ': 'dha', 'ण': 'na',
  'त': 'ta', 'थ': 'tha', 'द': 'da', 'ध': 'dha', 'न': 'na',
  'प': 'pa', 'फ': 'pha', 'ब': 'ba', 'भ': 'bha', 'म': 'ma',
  'य': 'ya', 'र': 'ra', 'ल': 'la', 'व': 'va',
  'श': 'sha', 'ष': 'sha', 'स': 'sa', 'ह': 'ha',
  'क्ष': 'ksha', 'त्र': 'tra', 'ज्ञ': 'gya',

  // Vowel signs (matras)
  'ा': 'aa', 'ि': 'i', 'ी': 'ii', 'ु': 'u', 'ू': 'uu', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ृ': 'ri', 'ॄ': 'rii', 'ॢ': 'li', 'ॣ': 'lii',

  // Special characters
  '्': '', 'ं': 'n', 'ः': 'h', '।': '.', 'ॐ': 'Om', '॰': '.', 'ऽ': "'",

  // Numbers
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
};

// Function to transliterate Hindi text to Roman characters with better readability
const transliterateHindi = (text) => {
  if (!text || !containsHindi(text)) return text;

  // First, handle common Hindi words with direct translations
  const commonWords = {
    'नागरावेला': 'Nagaravela',
    'अहमदाबाद': 'Ahmedabad',
    'डेकोरेशन': 'Decoration',
    'काम': 'Kaam',
    'सोफा': 'Sofa',
    'सेट': 'Set',
    'कुर्सी': 'Kursi',
    'टेस्ट': 'Test'
  };

  // Check for common words first
  for (const [hindi, english] of Object.entries(commonWords)) {
    if (text.includes(hindi)) {
      text = text.replace(new RegExp(hindi, 'g'), english);
    }
  }

  // If still contains Hindi characters, do character-by-character transliteration
  if (containsHindi(text)) {
    let result = '';
    for (let char of text) {
      if (hindiToRoman[char]) {
        result += hindiToRoman[char];
      } else if (/[\u0900-\u097F]/.test(char)) {
        // If it's a Hindi character not in our map, try to keep it readable
        result += char;
      } else {
        // Non-Hindi characters (English, numbers, symbols) pass through
        result += char;
      }
    }
    return result;
  }

  return text;
};

// Helper function to set appropriate font and prepare text for PDF
const setFontAndText = (doc, text, style = 'regular') => {
  let processedText = text;

  if (containsHindi(text)) {
    if (hindiFont) {
      // Try to use Hindi font for Devanagari text
      try {
        // Register the font if not already registered
        if (!doc._registeredFonts || !doc._registeredFonts['HindiFont']) {
          doc.registerFont('HindiFont', hindiFont);
          if (!doc._registeredFonts) doc._registeredFonts = {};
          doc._registeredFonts['HindiFont'] = true;
        }
        doc.font('HindiFont');
        console.log(`Successfully using Hindi font for: ${text.substring(0, 20)}...`);
        return { doc, text: processedText };
      } catch (error) {
        console.warn('Error loading Hindi font, using transliteration:', error.message);
        processedText = transliterateHindi(text);
      }
    } else {
      console.warn('Hindi text detected but no suitable font available, using transliteration');
      processedText = transliterateHindi(text);
    }
  }

  // Use default fonts for English text or transliterated text
  switch (style) {
    case 'bold':
      doc.font('Helvetica-Bold');
      break;
    case 'italic':
      doc.font('Helvetica-Oblique');
      break;
    default:
      doc.font('Helvetica');
  }

  return { doc, text: processedText };
};

// Backward compatibility function
const setFont = (doc, text, style = 'regular') => {
  const result = setFontAndText(doc, text, style);
  return result.doc;
};

// Define colors
const primaryColor = '#2A9D8F';
const secondaryColor = '#264653';

const darkText = '#2C3E50';


// Helper function to draw rectangles
const drawRect = (doc, x, y, width, height, color, radius = 0) => {
  doc.save()
     .roundedRect(x, y, width, height, radius)
     .fill(color)
     .restore();
};

// Helper function to draw borders
const drawBorder = (doc, x, y, width, height, color, radius = 0, lineWidth = 1) => {
  doc.save()
     .roundedRect(x, y, width, height, radius)
     .strokeColor(color)
     .lineWidth(lineWidth)
     .stroke()
     .restore();
};

const generateBillPDF = (bill, filePath) => {
  return new Promise(async (resolve, reject) => {
    try {
      // First generate the QR code data URL
      let qrCodeDataURL = null;
      try {
        const upiId = 'bindukumaryadav59-1@okhdfcbank';
        qrCodeDataURL = await generateUpiQRCodeDataURL(upiId);
        console.log('QR code data URL generated successfully');
      } catch (qrError) {
        console.error('Error generating QR code data URL:', qrError);
        // Continue without QR code
      }

      // Create a new PDF document with professional margins
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: `Khushi Decorators - Invoice ${bill.billNumber}`,
          Author: 'Khushi Decorators',
          Subject: 'Invoice',
          Keywords: 'invoice, bill, receipt'
        }
      });

      // Pipe the PDF into a file
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Define colors for simple, traditional invoice
      // Using black for text and borders by default

      // Header with company info
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text('KHUSHI DECORATORS', 40, 40, { align: 'center' })
         .fontSize(10)
         .font('Helvetica')
         .text('68/1159, Shivamod Nagar, Nr Nagurewl Hanuman Temple, Nr Union Industries Estate, Amraiwadi, Ahmedabad', 40, 110, {
           align: 'center',
           width: doc.page.width - 200  // Reduce width to avoid overlap with invoice details
         });

      // Invoice details
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('INVOICE', doc.page.width - 150, 40)
         .fontSize(12)
         .font('Helvetica')
         .text(`#${bill.billNumber}`, doc.page.width - 150, 60)
         .text(`Date: ${new Date(bill.billDate || bill.createdAt).toLocaleDateString('en-IN')}`, doc.page.width - 150, 80);

      // Customer and billing information section
      const billingY = 160;

      // Draw separator line
      doc.moveTo(40, billingY).lineTo(doc.page.width - 40, billingY).stroke();

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('BILL TO', 40, billingY + 20);

      // Customer name with Hindi support
      const customerNameResult = setFontAndText(doc, bill.customer.name);
      customerNameResult.doc.text(customerNameResult.text, 40, billingY + 40);

      // Phone (always English)
      doc.font('Helvetica')
         .text(`Phone: ${bill.customer.phone}`, 40, billingY + 60);

      // Place with Hindi support
      const placeResult = setFontAndText(doc, bill.customer.place);
      placeResult.doc.text(`Place: ${placeResult.text}`, 40, billingY + 80);

      // Work with Hindi support
      const workResult = setFontAndText(doc, bill.work);
      workResult.doc.text(`Work: ${workResult.text}`, 40, billingY + 100);

      // Work details
      doc.font('Helvetica-Bold')
         .text('WORK DETAILS', doc.page.width - 200, billingY + 20)
         .font('Helvetica')
         .text(`Picked By: ${bill.pickedBy}`, doc.page.width - 200, billingY + 40);

      // Items table section
      const tableY = 290;

      // Draw separator line
      doc.moveTo(40, tableY - 10).lineTo(doc.page.width - 40, tableY - 10).stroke();

      // Table header
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('ITEM', 40, tableY)
         .text('CATEGORY', 180, tableY)
         .text('PRICE', 320, tableY)
         .text('QTY', 400, tableY)
         .text('AMOUNT', 480, tableY);

      // Draw header separator
      doc.moveTo(40, tableY + 20).lineTo(doc.page.width - 40, tableY + 20).stroke();

      // Table content
      let currentY = tableY + 30;
      const rowHeight = 25;
      const pageHeight = doc.page.height - 80; // Leave margin for footer

      bill.items.forEach((item, index) => {
        // Check if we need a new page
        if (currentY + rowHeight > pageHeight) {
          doc.addPage();
          currentY = 80; // Reset Y position for new page
        }

        doc.fontSize(10);

        // Product name with Hindi support
        const itemNameResult = setFontAndText(doc, item.name);
        itemNameResult.doc.text(itemNameResult.text, 40, currentY);

        // Category (usually English)
        doc.font('Helvetica')
           .text(item.category, 180, currentY)
           .text(`Rs.${item.price.toFixed(2)}`, 320, currentY)
           .text(item.quantity.toString(), 400, currentY)
           .text(`Rs.${(item.price * item.quantity).toFixed(2)}`, 480, currentY);

        currentY += rowHeight;

        // Draw row separator
        if (index < bill.items.length - 1) {
          doc.moveTo(40, currentY - 5).lineTo(doc.page.width - 40, currentY - 5).stroke();
        }
      });

      // Total section
      const totalY = currentY + 20;
      doc.moveTo(40, totalY).lineTo(doc.page.width - 40, totalY).stroke();

      // Check if GST is enabled
      if (bill.gstEnabled) {
        // Show subtotal
        doc.fontSize(11)
           .font('Helvetica')
           .text('SUBTOTAL:', 380, totalY + 10)
           .text(`Rs.${bill.subTotal.toFixed(2)}`, 480, totalY + 10);

        // Show GST details
        const gstY = totalY + 30;
        doc.text(`GST (${bill.gstPercentage}%)`, 380, gstY)
           .text(`Rs.${bill.gstAmount.toFixed(2)}`, 480, gstY);

        // Show discount if present
        let discountY = gstY;
        if (bill.discountAmount && bill.discountAmount > 0) {
          discountY = gstY + 20;
          doc.fillColor('#28a745') // Green color for discount
             .text('Discount:', 380, discountY)
             .text(`-Rs.${bill.discountAmount.toFixed(2)}`, 480, discountY)
             .fillColor(darkText); // Reset to default color
        }

        // Show total with GST and discount
        const finalTotalY = discountY + 20;
        doc.moveTo(380, finalTotalY).lineTo(doc.page.width - 40, finalTotalY).stroke();

        // Calculate final total amount (subtotal + GST - discount)
        const finalTotalAmount = bill.subTotal + bill.gstAmount - (bill.discountAmount || 0);

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('TOTAL AMOUNT:', 380, finalTotalY + 10)
           .text(`Rs.${finalTotalAmount.toFixed(2)}`, 480, finalTotalY + 10);
      } else {
        // No GST, show subtotal and discount if present
        let currentTotalY = totalY + 10;

        // Show subtotal
        doc.fontSize(11)
           .font('Helvetica')
           .text('SUBTOTAL:', 380, currentTotalY)
           .text(`Rs.${bill.subTotal || bill.totalAmount + (bill.discountAmount || 0)}`, 480, currentTotalY);

        // Show discount if present
        if (bill.discountAmount && bill.discountAmount > 0) {
          currentTotalY += 20;
          doc.fillColor('#28a745') // Green color for discount
             .text('Discount:', 380, currentTotalY)
             .text(`-Rs.${bill.discountAmount.toFixed(2)}`, 480, currentTotalY)
             .fillColor(darkText); // Reset to default color
        }

        // Show final total
        currentTotalY += 20;
        doc.moveTo(380, currentTotalY).lineTo(doc.page.width - 40, currentTotalY).stroke();

        // Calculate final total amount (subtotal - discount, no GST)
        const subtotalAmount = bill.subTotal || (bill.totalAmount + (bill.discountAmount || 0));
        const finalTotalAmount = subtotalAmount - (bill.discountAmount || 0);

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('TOTAL AMOUNT:', 380, currentTotalY + 10)
           .text(`Rs.${finalTotalAmount.toFixed(2)}`, 480, currentTotalY + 10);
      }

      // Payment information section
      // Calculate payment section position based on whether GST and discount are present
      let paymentY;
      if (bill.gstEnabled) {
        paymentY = bill.discountAmount && bill.discountAmount > 0 ? totalY + 100 : totalY + 80;
      } else {
        paymentY = bill.discountAmount && bill.discountAmount > 0 ? totalY + 80 : totalY + 60;
      }
      doc.moveTo(40, paymentY).lineTo(doc.page.width - 40, paymentY).stroke();

      // Calculate the correct final total amount for payment calculations
      let correctFinalTotal;
      if (bill.gstEnabled) {
        correctFinalTotal = bill.subTotal + bill.gstAmount - (bill.discountAmount || 0);
      } else {
        const subtotalAmount = bill.subTotal || (bill.totalAmount + (bill.discountAmount || 0));
        correctFinalTotal = subtotalAmount - (bill.discountAmount || 0);
      }

      // Calculate correct remaining amount
      const correctRemainingAmount = Math.max(0, correctFinalTotal - bill.paidAmount);

      doc.fontSize(11)
         .text('PAYMENT DETAILS', 40, paymentY + 10)
         .font('Helvetica')
         .text(`Payment Method: ${bill.paymentType}`, 40, paymentY + 30);

      if (bill.paymentType === 'Credit') {
        // Credit payment details with improved layout
        doc.font('Helvetica-Bold')
           .text('Credit Type:', 55, paymentY + 55)
           .font('Helvetica')
           .text(bill.creditType, 150, paymentY + 55)
           .font('Helvetica-Bold')
           .text('Amount Paid:', doc.page.width - 280, paymentY + 35)
           .font('Helvetica')
           .text(`Rs.${bill.paidAmount.toFixed(2)}`, doc.page.width - 180, paymentY + 35)
           .font('Helvetica-Bold')
           .text('Balance Due:', doc.page.width - 280, paymentY + 55)
           .font('Helvetica')
           .text(`Rs.${correctRemainingAmount.toFixed(2)}`, doc.page.width - 180, paymentY + 55);


      } else if (bill.paymentType === 'Cash') {
        // Cash payment details with consistent layout
        doc.font('Helvetica-Bold')
           .text('Amount Paid:', doc.page.width - 280, paymentY + 35)
           .font('Helvetica')
           .text(`Rs.${bill.paidAmount.toFixed(2)}`, doc.page.width - 180, paymentY + 35);

        if (bill.paidAmount < correctFinalTotal) {
          doc.font('Helvetica-Bold')
             .text('Balance Due:', doc.page.width - 280, paymentY + 55)
             .font('Helvetica')
             .text(`Rs.${correctRemainingAmount.toFixed(2)}`, doc.page.width - 180, paymentY + 55);
        }
      }

      // Terms and conditions section - positioned below payment details to avoid QR code overlap
      const termsY = paymentY + 120; // Position below payment details and QR code
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('Terms & Conditions:', 200, termsY);

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(darkText)
         .text('• Sold products cannot be returned or exchanged.', 200, termsY + 20)
         .text('• All payments should be made as per agreed terms.', 200, termsY + 35)
         .text('• Material delivery charges may apply separately.', 200, termsY + 50)
         .text('• Any disputes are subject to Ahmedabad jurisdiction only.', 200, termsY + 65);

      // Footer section with modern design - ensure it's below terms
      const footerY = Math.max(termsY + 100, doc.page.height - 80);

      // Thank you message
      doc.fillColor(darkText)
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Thank you for your business!', 0, footerY - 30, { align: 'center' });

      // Separator line
      doc.strokeColor(primaryColor)
         .opacity(0.3)
         .moveTo(40, footerY - 10)
         .lineTo(doc.page.width - 40, footerY - 10)
         .stroke()
         .opacity(1);

      // Position QR code on the left side under PAYMENT DETAILS section
      // Calculate position based on payment section
      const qrCodeY = paymentY + 60; // Position below payment method text
      const qrCodeX = 40; // Left aligned

      try {
        // Add a title for the QR code section
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(darkText)
           .text('UPI Payment', qrCodeX, qrCodeY - 15);

        // Draw a placeholder box for the QR code
        drawRect(doc, qrCodeX, qrCodeY, 80, 80, '#FFFFFF', 4);
        drawBorder(doc, qrCodeX, qrCodeY, 80, 80, '#000000', 4, 1);

        // Add text inside the box
        doc.fontSize(8)
           .fillColor(darkText)
           .text('UPI QR Code', qrCodeX, qrCodeY + 30, { width: 80, align: 'center' });

        // Add the QR code if available
        if (qrCodeDataURL) {
          try {
            doc.image(qrCodeDataURL, qrCodeX, qrCodeY, { width: 80 });
            console.log('QR code added to PDF successfully');
          } catch (imgError) {
            console.error('Error adding QR code to PDF:', imgError);
            // The placeholder box and text will remain visible
          }
        }

        // Always add the UPI ID text even if image is not available
        doc.fontSize(8)
           .fillColor(darkText)
           .text('UPI ID: bindukumaryadav59-1@okhdfcbank', qrCodeX, qrCodeY + 85, { width: 120 });
      } catch (error) {
        console.error('Error in QR code section:', error);
        // Continue with PDF generation even if QR code fails
      }

      // Contact information with improved layout
      doc.fillColor(secondaryColor)
         .fontSize(10)
         .font('Helvetica')
         .text('Kushi Decorators', 160, footerY + 5)
         .text('|', 240, footerY + 5)
         .text('Phone: +91 9724066417', 260, footerY + 5)
         .text('|', 420, footerY + 5)
         .text('Email: info@kushitrader.com', 440, footerY + 5);



      // Finalize the PDF and ensure proper ending
      doc.end();

      stream.on('finish', () => {
        console.log(`Bill PDF generated successfully: ${filePath}`);
        resolve(filePath);
      });

      stream.on('error', (error) => {
        console.error('Error writing PDF file:', error);
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};

// Generate Return Bill PDF
const generateReturnBillPDF = (returnBill, filePath) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Create a new PDF document with professional margins
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: `Khushi Decorators - Return ${returnBill.returnNumber}`,
          Author: 'Khushi Decorators',
          Subject: 'Return Bill',
          Keywords: 'return, bill, receipt'
        }
      });

      // Pipe the PDF into a file
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header with company info
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text('KHUSHI DECORATORS', 40, 40, { align: 'center' })
         .fontSize(10)
         .font('Helvetica')
         .text('68/1159, Shivamod Nagar, Nr Nagurewl Hanuman Temple, Nr Union Industries Estate, Amraiwadi, Ahmedabad', 40, 110, {
           align: 'center',
           width: doc.page.width - 200  // Reduce width to avoid overlap with return bill details
         });

      // Return bill details
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('RETURN BILL', doc.page.width - 150, 40)
         .fontSize(12)
         .font('Helvetica')
         .text(`#${returnBill.returnNumber}`, doc.page.width - 150, 60)
         .text(`Date: ${new Date(returnBill.createdAt).toLocaleDateString('en-IN')} ${new Date(returnBill.createdAt).toLocaleTimeString('en-IN')}`, doc.page.width - 150, 80);

      // Customer and return information section
      const billingY = 160;

      // Draw separator line
      doc.moveTo(40, billingY).lineTo(doc.page.width - 40, billingY).stroke();

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('CUSTOMER', 40, billingY + 20);

      // Customer name with Hindi support
      const returnCustomerNameResult = setFontAndText(doc, returnBill.customer.name);
      returnCustomerNameResult.doc.text(returnCustomerNameResult.text, 40, billingY + 40);

      // Phone (always English)
      doc.font('Helvetica')
         .text(`Phone: ${returnBill.customer.phone}`, 40, billingY + 60);

      // Place with Hindi support
      const returnPlaceResult = setFontAndText(doc, returnBill.customer.place);
      returnPlaceResult.doc.text(`Place: ${returnPlaceResult.text}`, 40, billingY + 80);

      // Return reason with Hindi support
      const returnReasonResult = setFontAndText(doc, returnBill.reason);
      returnReasonResult.doc.text(`Return Reason: ${returnReasonResult.text}`, 40, billingY + 100);

      // Return details
      doc.font('Helvetica-Bold')
         .text('RETURN DETAILS', doc.page.width - 200, billingY + 20)
         .font('Helvetica')
         .text(`Picked By: ${returnBill.pickedBy}`, doc.page.width - 200, billingY + 40)
         .text(`Status: ${returnBill.status}`, doc.page.width - 200, billingY + 60);

      // Add resolution details if resolved
      if (returnBill.status === 'Resolved') {
        doc.text(`Resolution: ${returnBill.resolution || 'N/A'}`, doc.page.width - 200, billingY + 80);
        if (returnBill.resolvedAt) {
          doc.text(`Resolved On: ${new Date(returnBill.resolvedAt).toLocaleDateString('en-IN')}`, doc.page.width - 200, billingY + 100);
        }
      }

      // Items table section
      const tableY = 290;

      // Draw separator line
      doc.moveTo(40, tableY - 10).lineTo(doc.page.width - 40, tableY - 10).stroke();

      // Table header
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('ITEM', 40, tableY)
         .text('CATEGORY', 180, tableY)
         .text('QTY', 400, tableY);

      // Draw header separator
      doc.moveTo(40, tableY + 20).lineTo(doc.page.width - 40, tableY + 20).stroke();

      // Table content
      let currentY = tableY + 30;
      const rowHeight = 25;

      returnBill.items.forEach((item, index) => {
        doc.fontSize(10);

        // Product name with Hindi support
        const returnItemNameResult = setFontAndText(doc, item.name);
        returnItemNameResult.doc.text(returnItemNameResult.text, 40, currentY);

        // Category (usually English)
        doc.font('Helvetica')
           .text(item.category, 180, currentY)
           .text(item.quantity.toString(), 400, currentY);

        currentY += rowHeight;

        // Draw row separator
        if (index < returnBill.items.length - 1) {
          doc.moveTo(40, currentY - 5).lineTo(doc.page.width - 40, currentY - 5).stroke();
        }
      });

      // Footer section
      const footerY = doc.page.height - 80;

      // Separator line
      doc.strokeColor(primaryColor)
         .opacity(0.3)
         .moveTo(40, footerY - 10)
         .lineTo(doc.page.width - 40, footerY - 10)
         .stroke()
         .opacity(1);

      // Contact information with improved layout
      doc.fillColor(secondaryColor)
         .fontSize(10)
         .font('Helvetica')
         .text('Kushi Decorators', 160, footerY + 5)
         .text('|', 240, footerY + 5)
         .text('Phone: +91 9724066417', 260, footerY + 5)
         .text('|', 420, footerY + 5)
         .text('Email: info@kushitrader.com', 440, footerY + 5);

      // Finalize the PDF
      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};

// Generate Quotation PDF
const generateQuotationPDF = (quotation, filePath) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Create a new PDF document with professional margins
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: `Khushi Decorators - Quotation ${quotation.quotationNumber}`,
          Author: 'Khushi Decorators',
          Subject: 'Quotation',
          Keywords: 'quotation, estimate, quote'
        }
      });

      // Pipe the PDF into a file
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Define colors
      const primaryColor = '#2c3e50';
      const secondaryColor = '#7f8c8d';
      const accentColor = '#3498db';
      const darkText = '#2c3e50';

      // Header with company info
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('KHUSHI DECORATORS', 40, 40, { align: 'center' })
         .fontSize(10)
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text('68/1159, Shivamod Nagar, Nr Nagurewl Hanuman Temple, Nr Union Industries Estate, Amraiwadi, Ahmedabad', 40, 110, {
           align: 'center',
           width: doc.page.width - 200  // Reduce width to avoid overlap with quotation details
         });

      // Quotation details
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor(accentColor)
         .text('QUOTATION', doc.page.width - 150, 40)
         .fontSize(12)
         .font('Helvetica')
         .fillColor(darkText)
         .text(`#${quotation.quotationNumber}`, doc.page.width - 150, 65)
         .text(`Date: ${new Date(quotation.quotationDate || quotation.createdAt).toLocaleDateString('en-IN')}`, doc.page.width - 150, 85)
         .text(`Valid Until: ${new Date(quotation.validUntil).toLocaleDateString('en-IN')}`, doc.page.width - 150, 105);



      // Customer and billing information section
      const billingY = 160;

      // Draw separator line
      doc.strokeColor(primaryColor)
         .opacity(0.3)
         .moveTo(40, billingY)
         .lineTo(doc.page.width - 40, billingY)
         .stroke()
         .opacity(1);

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('QUOTE TO', 40, billingY + 20);

      // Customer details
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor(darkText)
         .text(`${quotation.customer.name}`, 40, billingY + 45)
         .text(`Phone: ${quotation.customer.phone}`, 40, billingY + 65)
         .text(`Place: ${quotation.customer.place}`, 40, billingY + 85);

      if (quotation.customer.email) {
        doc.text(`Email: ${quotation.customer.email}`, 40, billingY + 105);
      }

      // Items table header
      const tableY = billingY + 140;
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('PRODUCT', 40, tableY)
         .text('UNIT TYPE', 250, tableY)
         .text('QTY/MEASUREMENT', 350, tableY)
         .text('AMOUNT', 480, tableY);

      // Draw table header line
      doc.strokeColor(primaryColor)
         .opacity(0.5)
         .moveTo(40, tableY + 20)
         .lineTo(doc.page.width - 40, tableY + 20)
         .stroke()
         .opacity(1);

      // Items
      let currentY = tableY + 35;
      const rowHeight = 25;

      quotation.items.forEach((item, index) => {
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(darkText);

        // Product name with Hindi support
        const itemNameResult = setFontAndText(doc, item.name);
        itemNameResult.doc.text(itemNameResult.text, 40, currentY);

        // Unit type and quantity/measurement
        let unitText = '';
        let qtyText = '';

        switch (item.unitType) {
          case 'piece':
            unitText = 'Piece';
            qtyText = `${item.quantity} pcs`;
            break;
          case 'ft':
            unitText = 'Feet';
            qtyText = `${item.feet} ft`;
            break;
          case 'rft':
            unitText = 'Running Feet';
            qtyText = `${item.runningFeet} rft`;
            break;
        }

        doc.font('Helvetica')
           .text(unitText, 250, currentY)
           .text(qtyText, 350, currentY)
           .text(`Rs.${item.price.toFixed(2)}`, 480, currentY);

        currentY += rowHeight;

        // Draw row separator
        if (index < quotation.items.length - 1) {
          doc.strokeColor(secondaryColor)
             .opacity(0.3)
             .moveTo(40, currentY - 5)
             .lineTo(doc.page.width - 40, currentY - 5)
             .stroke()
             .opacity(1);
        }
      });

      // Total section
      const totalY = currentY + 20;
      doc.strokeColor(primaryColor)
         .opacity(0.5)
         .moveTo(40, totalY)
         .lineTo(doc.page.width - 40, totalY)
         .stroke()
         .opacity(1);

      // Calculate totals - ensure proper number formatting
      const subtotal = parseFloat(quotation.subTotal) || 0;
      const gstAmount = parseFloat(quotation.gstAmount) || 0;
      const discount = parseFloat(quotation.discountAmount) || 0;
      const total = parseFloat(quotation.totalAmount) || 0;

      let summaryY = totalY + 20;

      // Summary section with fixed positions for perfect alignment
      const labelX = 350;      // Fixed position for labels
      const amountX = 480;     // Fixed position for amounts (right-aligned)

      // Subtotal
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor(darkText)
         .text('Subtotal:', labelX, summaryY, { width: 100, align: 'left' })
         .text(`Rs.${subtotal.toFixed(2)}`, amountX, summaryY, { width: 60, align: 'right' });

      summaryY += 20;

      // GST if applicable
      if (quotation.gstEnabled && gstAmount > 0) {
        doc.fillColor(darkText)
           .text(`GST (${quotation.gstPercentage}% ${quotation.gstType}):`, labelX, summaryY, { width: 100, align: 'left' })
           .text(`Rs.${gstAmount.toFixed(2)}`, amountX, summaryY, { width: 60, align: 'right' });
        summaryY += 20;
      }

      // Discount if applicable
      if (discount > 0) {
        doc.fillColor('#e74c3c')
           .text('Discount:', labelX, summaryY, { width: 100, align: 'left' })
           .text(`-Rs.${discount.toFixed(2)}`, amountX, summaryY, { width: 60, align: 'right' });
        summaryY += 20;
      }

      // Add separator line
      summaryY += 5;
      doc.strokeColor('#cccccc')
         .lineWidth(1)
         .moveTo(labelX, summaryY)
         .lineTo(amountX + 60, summaryY)
         .stroke();

      summaryY += 15;

      // Total Amount
      doc.fontSize(13)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('Total Amount:', labelX, summaryY, { width: 100, align: 'left' })
         .text(`Rs.${total.toFixed(2)}`, amountX, summaryY, { width: 60, align: 'right' });

      // Terms and conditions
      const termsY = summaryY + 40;
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('Terms & Conditions:', 40, termsY);

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(darkText)
         .text('• This quotation is valid until the date mentioned above.', 40, termsY + 20)
         .text('• Prices are subject to change without prior notice.', 40, termsY + 35)
         .text('• All payments should be made as per agreed terms.', 40, termsY + 50)
         .text('• Material delivery charges may apply separately.', 40, termsY + 65);

      // Footer section - ensure it's below terms
      const footerY = Math.max(termsY + 100, doc.page.height - 80);

      // Separator line
      doc.strokeColor(primaryColor)
         .opacity(0.3)
         .moveTo(40, footerY - 10)
         .lineTo(doc.page.width - 40, footerY - 10)
         .stroke()
         .opacity(1);

      // Contact information
      doc.fillColor(secondaryColor)
         .fontSize(10)
         .font('Helvetica')
         .text('Kushi Decorators', 160, footerY + 5)
         .text('|', 240, footerY + 5)
         .text('Phone: +91 9724066417', 260, footerY + 5)
         .text('|', 420, footerY + 5)
         .text('Email: info@kushitrader.com', 440, footerY + 5);

      // Finalize the PDF
      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateBillPDF, generateReturnBillPDF, generateQuotationPDF };

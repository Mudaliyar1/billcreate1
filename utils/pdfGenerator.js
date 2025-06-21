const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { generateUpiQRCodeDataURL } = require('./generateQRCode');
const BillTemplate = require('../models/BillTemplate');

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
      // Check if file is actually a font by reading first few bytes (silently)
      const fd = fs.openSync(fontPath, 'r');
      const buffer = Buffer.alloc(4);
      fs.readSync(fd, buffer, 0, 4, 0);
      fs.closeSync(fd);
      const header = buffer.toString('hex');
      // TTF files start with specific headers (in hex)
      if (header === '00010000' || header === '4f54544f' || header === '74727565' || header === '74797031') {
        hindiFont = fontPath;
        // Only log in development mode
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Valid Hindi font found: ${fontPath}`);
        }
        break;
      } else {
        // Silently skip invalid fonts
      }
    } catch (error) {
      // Silently skip fonts that can't be read
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
        return { doc, text: processedText };
      } catch (error) {
        // Silently fall back to transliteration
        processedText = transliterateHindi(text);
      }
    } else {
      // Silently use transliteration when no font available
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

      // Terms and conditions section - positioned to the right of QR code
      const termsY = qrCodeY; // Align with QR code
      const termsX = 200; // Position to the right of QR code
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('Terms & Conditions:', termsX, termsY);

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(darkText)
         .text('• Sold products cannot be returned or exchanged.', termsX, termsY + 20)
         .text('• All payments should be made as per agreed terms.', termsX, termsY + 35)
         .text('• Material delivery charges may apply separately.', termsX, termsY + 50)
         .text('• Any disputes are subject to Ahmedabad jurisdiction only.', termsX, termsY + 65);

      // Calculate footer position more conservatively to avoid extra pages
      const contentEndY = Math.max(qrCodeY + 110, termsY + 85); // End of QR code or terms, whichever is lower
      const availableSpace = doc.page.height - contentEndY - 40; // Space remaining on page

      // Only add footer if there's enough space, otherwise it will naturally fit
      let footerY = contentEndY + 20;

      // Only add footer elements if there's enough space to avoid extra pages
      if (availableSpace >= 60) {
        // Thank you message
        doc.fillColor(darkText)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('Thank you for your business!', 0, footerY, { align: 'center' });

        // Separator line
        doc.strokeColor(primaryColor)
           .opacity(0.3)
           .moveTo(40, footerY + 20)
           .lineTo(doc.page.width - 40, footerY + 20)
           .stroke()
           .opacity(1);

        footerY += 40; // Adjust for contact info

        // Contact information with improved layout
        doc.fillColor(secondaryColor)
           .fontSize(10)
           .font('Helvetica')
           .text('Kushi Decorators', 160, footerY)
           .text('|', 240, footerY)
           .text('Phone: +91 9724066417', 260, footerY)
           .text('|', 420, footerY)
           .text('Email: info@kushitrader.com', 440, footerY);
      }



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

      // Footer section - calculate based on content end to avoid extra pages
      const contentEndY = currentY + 20;
      const availableSpace = doc.page.height - contentEndY - 40;
      let footerY = contentEndY + 20;

      // Only add footer elements if there's enough space to avoid extra pages
      if (availableSpace >= 40) {
        // Separator line
        doc.strokeColor(primaryColor)
           .opacity(0.3)
           .moveTo(40, footerY)
           .lineTo(doc.page.width - 40, footerY)
           .stroke()
           .opacity(1);

        // Contact information with improved layout
        doc.fillColor(secondaryColor)
           .fontSize(10)
           .font('Helvetica')
           .text('Kushi Decorators', 160, footerY + 20)
           .text('|', 240, footerY + 20)
           .text('Phone: +91 9724066417', 260, footerY + 20)
           .text('|', 420, footerY + 20)
           .text('Email: info@kushitrader.com', 440, footerY + 20);
      }

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

      // Customer details - more compact spacing
      let currentCustomerY = billingY + 35; // Reduced from 45
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor(darkText)
         .text(`${quotation.customer.name}`, 40, currentCustomerY);

      currentCustomerY += 15; // Reduced from 20
      doc.text(`Phone: ${quotation.customer.phone}`, 40, currentCustomerY);

      currentCustomerY += 15; // Reduced from 20
      doc.text(`Place: ${quotation.customer.place}`, 40, currentCustomerY);

      if (quotation.customer.email) {
        currentCustomerY += 15; // Reduced from 20
        doc.text(`Email: ${quotation.customer.email}`, 40, currentCustomerY);
      }

      console.log('PDF Generation - Customer GST No:', quotation.customer.gstNo);
      console.log('PDF Generation - Full customer object:', JSON.stringify(quotation.customer, null, 2));
      if (quotation.customer.gstNo && quotation.customer.gstNo.trim() !== '') {
        currentCustomerY += 15; // Reduced from 20
        doc.text(`GST No: ${quotation.customer.gstNo}`, 40, currentCustomerY);
        console.log('GST number added to PDF at Y position:', currentCustomerY);
      } else {
        console.log('No GST number found for customer or GST number is empty');
      }

      // Items table header (adjust position based on customer info)
      const tableY = currentCustomerY + 30; // Reduced from 40
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
      let currentY = tableY + 30; // Reduced from 35
      const rowHeight = 20; // Reduced from 25

      quotation.items.forEach((item, index) => {
        // Check if we need a new page - leave space for totals and footer (120px - much more conservative)
        if (currentY + rowHeight > doc.page.height - 120) {
          doc.addPage();
          currentY = 40;

          // Redraw table header on new page
          doc.fontSize(11)
             .font('Helvetica-Bold')
             .fillColor(primaryColor)
             .text('PRODUCT', 40, currentY)
             .text('UNIT TYPE', 250, currentY)
             .text('QTY/MEASUREMENT', 350, currentY)
             .text('AMOUNT', 480, currentY);

          // Draw table header line
          doc.strokeColor(primaryColor)
             .opacity(0.5)
             .moveTo(40, currentY + 20)
             .lineTo(doc.page.width - 40, currentY + 20)
             .stroke()
             .opacity(1);

          currentY += 35;
        }

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
      const totalY = currentY + 15; // Reduced from 20
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

      let summaryY = totalY + 15; // Reduced from 20

      // Summary section with fixed positions for perfect alignment
      const labelX = 350;      // Fixed position for labels
      const amountX = 480;     // Fixed position for amounts (right-aligned)

      // Subtotal
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor(darkText)
         .text('Subtotal:', labelX, summaryY, { width: 100, align: 'left' })
         .text(`Rs.${subtotal.toFixed(2)}`, amountX, summaryY, { width: 60, align: 'right' });

      summaryY += 15; // Reduced from 20

      // GST if applicable
      if (quotation.gstEnabled && gstAmount > 0) {
        doc.fillColor(darkText)
           .text(`GST (${quotation.gstPercentage}% ${quotation.gstType}):`, labelX, summaryY, { width: 100, align: 'left' })
           .text(`Rs.${gstAmount.toFixed(2)}`, amountX, summaryY, { width: 60, align: 'right' });
        summaryY += 15; // Reduced from 20
      }

      // Discount if applicable
      if (discount > 0) {
        doc.fillColor('#e74c3c')
           .text('Discount:', labelX, summaryY, { width: 100, align: 'left' })
           .text(`-Rs.${discount.toFixed(2)}`, amountX, summaryY, { width: 60, align: 'right' });
        summaryY += 15; // Reduced from 20
      }

      // Add separator line
      summaryY += 3; // Reduced from 5
      doc.strokeColor('#cccccc')
         .lineWidth(1)
         .moveTo(labelX, summaryY)
         .lineTo(amountX + 60, summaryY)
         .stroke();

      summaryY += 10; // Reduced from 15

      // Total Amount
      doc.fontSize(13)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('Total Amount:', labelX, summaryY, { width: 100, align: 'left' })
         .text(`Rs.${total.toFixed(2)}`, amountX, summaryY, { width: 60, align: 'right' });

      // Terms and conditions - more compact spacing
      const termsY = summaryY + 20; // Reduced from 30
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('Terms & Conditions:', 40, termsY);

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(darkText)
         .text('• This quotation is valid until the date mentioned above.', 40, termsY + 12) // Further reduced spacing
         .text('• Prices are subject to change without prior notice.', 40, termsY + 24)
         .text('• All payments should be made as per agreed terms.', 40, termsY + 36)
         .text('• Material delivery charges may apply separately.', 40, termsY + 48);

      // Calculate footer position more conservatively to avoid extra pages
      const contentEndY = termsY + 60; // End of terms section (further reduced)
      const availableSpace = doc.page.height - contentEndY - 40; // Space remaining on page

      // Only add footer if there's enough space
      let footerY = contentEndY + 10; // Further reduced spacing

      // Only add footer elements if there's enough space to avoid extra pages
      if (availableSpace >= 40) {
        // Separator line
        doc.strokeColor(primaryColor)
           .opacity(0.3)
           .moveTo(40, footerY)
           .lineTo(doc.page.width - 40, footerY)
           .stroke()
           .opacity(1);

        // Contact information
        doc.fillColor(secondaryColor)
           .fontSize(10)
           .font('Helvetica')
           .text('Kushi Decorators', 160, footerY + 20)
           .text('|', 240, footerY + 20)
           .text('Phone: +91 9724066417', 260, footerY + 20)
           .text('|', 420, footerY + 20)
           .text('Email: info@kushitrader.com', 440, footerY + 20);
      }

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

// Generate PDF using custom template
const generateBillPDFWithTemplate = async (bill, templateId = null, userId = null) => {
  try {
    // Get the template
    let template;
    if (templateId) {
      template = await BillTemplate.findOne({ _id: templateId, createdBy: userId });
    } else if (userId) {
      template = await BillTemplate.findOne({ createdBy: userId, isDefault: true });
    }

    if (!template) {
      // Fall back to original PDF generation - create a temporary file and return buffer
      const tempPath = path.join(__dirname, '../temp', `temp-${Date.now()}.pdf`);
      const tempDir = path.dirname(tempPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      await generateBillPDF(bill, tempPath);
      const buffer = fs.readFileSync(tempPath);
      fs.unlinkSync(tempPath); // Clean up temp file
      return buffer;
    }

    // Create PDF document with template settings
    const doc = new PDFDocument({
      size: [template.pageSettings.width, template.pageSettings.height],
      margin: template.pageSettings.margin.top,
      bufferPages: true,
      autoFirstPage: true
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    // Generate QR code if needed
    let qrCodeDataURL = null;
    if (template.elements.some(el => el.type === 'qr_code' && el.visible)) {
      qrCodeDataURL = await generateUpiQRCodeDataURL(bill);
    }

    // Render elements based on template
    const sortedElements = template.elements
      .filter(el => el.visible)
      .sort((a, b) => a.order - b.order);

    for (const element of sortedElements) {
      await renderTemplateElement(doc, element, bill, qrCodeDataURL);
    }

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on('error', reject);
    });

  } catch (error) {
    console.error('Error generating PDF with template:', error);
    // Fall back to original PDF generation - create a temporary file and return buffer
    const tempPath = path.join(__dirname, '../temp', `temp-${Date.now()}.pdf`);
    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    await generateBillPDF(bill, tempPath);
    const buffer = fs.readFileSync(tempPath);
    fs.unlinkSync(tempPath); // Clean up temp file
    return buffer;
  }
};

// Render individual template element
const renderTemplateElement = async (doc, element, bill, qrCodeDataURL) => {
  const { position, size, style } = element;

  // Set font and style
  const fontResult = setFontAndText(doc, '', style.fontWeight || 'normal');
  doc = fontResult.doc;

  doc.fontSize(style.fontSize || 12);
  doc.fillColor(style.color || '#000000');

  // Position the cursor
  const x = position.x;
  const y = position.y;

  switch (element.type) {
    case 'company_header':
      renderCompanyHeader(doc, x, y, size, style);
      break;

    case 'company_address':
      renderCompanyAddress(doc, x, y, size, style);
      break;

    case 'bill_number':
      renderBillNumber(doc, x, y, size, style, bill);
      break;

    case 'bill_date':
      renderBillDate(doc, x, y, size, style, bill);
      break;

    case 'customer_info':
      renderCustomerInfo(doc, x, y, size, style, bill);
      break;

    case 'work_details':
      renderWorkDetails(doc, x, y, size, style, bill);
      break;

    case 'items_table':
      renderItemsTable(doc, x, y, size, style, bill);
      break;

    case 'total_amount':
      renderTotalAmount(doc, x, y, size, style, bill);
      break;

    case 'payment_details':
      renderPaymentDetails(doc, x, y, size, style, bill);
      break;

    case 'qr_code':
      if (qrCodeDataURL) {
        await renderQRCode(doc, x, y, size, qrCodeDataURL);
      }
      break;

    case 'footer':
      renderFooter(doc, x, y, size, style);
      break;

    case 'custom_text':
      renderCustomText(doc, x, y, size, style, element.customText || '');
      break;
  }
};

// Individual element renderers
const renderCompanyHeader = (doc, x, y, size, style) => {
  const text = 'KHUSHI DECORATORS';
  doc.text(text, x, y, {
    width: size.width,
    height: size.height,
    align: style.textAlign || 'center'
  });
};

const renderCompanyAddress = (doc, x, y, size, style) => {
  const address = '68/1159, Shivamod Nagar, Nr Nagurewl Hanuman Temple, Nagarvel Hanuman Road, Ahmedabad-382350';
  doc.text(address, x, y, {
    width: size.width,
    height: size.height,
    align: style.textAlign || 'center'
  });
};

const renderBillNumber = (doc, x, y, size, style, bill) => {
  const text = `INVOICE #${bill.billNumber}`;
  doc.text(text, x, y, {
    width: size.width,
    height: size.height,
    align: style.textAlign || 'left'
  });
};

const renderBillDate = (doc, x, y, size, style, bill) => {
  const date = new Date(bill.billDate || bill.date || bill.createdAt).toLocaleDateString('en-GB');
  const text = `Date: ${date}`;
  doc.text(text, x, y, {
    width: size.width,
    height: size.height,
    align: style.textAlign || 'left'
  });
};

const renderCustomerInfo = (doc, x, y, size, style, bill) => {
  // Handle both bill.customer.name and bill.customerName formats
  const customerName = bill.customer?.name || bill.customerName || '';
  const customerPhone = bill.customer?.phone || bill.customerPhone || '';
  const customerPlace = bill.customer?.place || bill.place || '';

  const fontResult = setFontAndText(doc, customerName, style.fontWeight || 'normal');
  const transliteratedName = fontResult.text;

  let text = `Customer: ${transliteratedName}`;
  if (customerPhone) text += `\nPhone: ${customerPhone}`;
  if (customerPlace) {
    const placeResult = setFontAndText(doc, customerPlace, style.fontWeight || 'normal');
    text += `\nPlace: ${placeResult.text}`;
  }

  doc.text(text, x, y, {
    width: size.width,
    height: size.height,
    align: style.textAlign || 'left'
  });
};

const renderWorkDetails = (doc, x, y, size, style, bill) => {
  let text = '';
  if (bill.work) {
    const workResult = setFontAndText(doc, bill.work, style.fontWeight || 'normal');
    text += `Work: ${workResult.text}\n`;
  }
  if (bill.pickedBy) text += `Picked By: ${bill.pickedBy}`;

  doc.text(text, x, y, {
    width: size.width,
    height: size.height,
    align: style.textAlign || 'left'
  });
};

const renderTotalAmount = (doc, x, y, size, style, bill) => {
  const total = bill.totalAmount || 0;
  const text = `TOTAL AMOUNT: Rs.${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  doc.text(text, x, y, {
    width: size.width,
    height: size.height,
    align: style.textAlign || 'right'
  });
};

const renderPaymentDetails = (doc, x, y, size, style, bill) => {
  let text = `Payment Method: ${bill.paymentType || bill.paymentMethod || 'Cash'}`;
  if (bill.paidAmount || bill.amountPaid) {
    const paidAmount = bill.paidAmount || bill.amountPaid;
    text += `\nAmount Paid: Rs.${paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }

  doc.text(text, x, y, {
    width: size.width,
    height: size.height,
    align: style.textAlign || 'left'
  });
};

const renderFooter = (doc, x, y, size, style) => {
  const text = 'Thank you for your business!\nSold products cannot be returned.';
  doc.text(text, x, y, {
    width: size.width,
    height: size.height,
    align: style.textAlign || 'center'
  });
};

const renderCustomText = (doc, x, y, size, style, customText) => {
  if (customText) {
    const textResult = setFontAndText(doc, customText, style.fontWeight || 'normal');
    doc.text(textResult.text, x, y, {
      width: size.width,
      height: size.height,
      align: style.textAlign || 'left'
    });
  }
};

const renderItemsTable = (doc, x, y, size, style, bill) => {
  // This is a simplified table renderer - you can enhance it further
  const startY = y;
  let currentY = startY;

  // Table headers
  doc.fontSize(style.fontSize || 10);
  const headers = ['ITEM', 'CATEGORY', 'PRICE', 'QTY', 'AMOUNT'];
  const colWidths = [size.width * 0.3, size.width * 0.2, size.width * 0.15, size.width * 0.1, size.width * 0.25];

  let currentX = x;
  headers.forEach((header, index) => {
    doc.text(header, currentX, currentY, { width: colWidths[index], align: 'center' });
    currentX += colWidths[index];
  });

  currentY += 20;

  // Table rows
  if (bill.items && bill.items.length > 0) {
    bill.items.forEach(item => {
      currentX = x;
      const itemName = setFontAndText(doc, item.name || item.product || '', 'normal').text;
      const categoryName = setFontAndText(doc, item.category || '', 'normal').text;

      const rowData = [
        itemName,
        categoryName,
        `Rs.${(item.price || 0).toFixed(2)}`,
        (item.quantity || 0).toString(),
        `Rs.${((item.price || 0) * (item.quantity || 0)).toFixed(2)}`
      ];

      rowData.forEach((data, index) => {
        doc.text(data, currentX, currentY, { width: colWidths[index], align: index > 1 ? 'right' : 'left' });
        currentX += colWidths[index];
      });

      currentY += 15;
    });
  }
};

const renderQRCode = async (doc, x, y, size, qrCodeDataURL) => {
  try {
    if (qrCodeDataURL && qrCodeDataURL.startsWith('data:image')) {
      const base64Data = qrCodeDataURL.split(',')[1];
      const imageBuffer = Buffer.from(base64Data, 'base64');

      doc.image(imageBuffer, x, y, {
        width: size.width,
        height: size.height
      });
    }
  } catch (error) {
    console.error('Error rendering QR code:', error);
    // Fallback text
    doc.text('[QR CODE]', x, y, {
      width: size.width,
      height: size.height,
      align: 'center'
    });
  }
};

// Generate Quotation 2.0 PDF
async function generateQuotation2PDF(quotation) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: `Khushi Decorators - Quotation 2.0 ${quotation.quotationNumber}`,
          Author: 'Khushi Decorators',
          Subject: 'Quotation 2.0',
          Keywords: 'quotation, estimate, quote'
        }
      });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

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
           width: doc.page.width - 200
         });

      // Quotation details (right side)
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor(accentColor)
         .text('QUOTATION', doc.page.width - 150, 40)
         .fontSize(12)
         .font('Helvetica')
         .fillColor(darkText)
         .text(`#${quotation.quotationNumber}`, doc.page.width - 150, 65)
         .text(`Date: ${quotation.date.toLocaleDateString('en-IN')}`, doc.page.width - 150, 85)
         .text(`Valid Until: ${quotation.validUntil.toLocaleDateString('en-IN')}`, doc.page.width - 150, 105);

      // Customer and billing information section
      const billingY = 160;

      // Draw separator line
      doc.strokeColor(primaryColor)
         .opacity(0.3)
         .moveTo(40, billingY)
         .lineTo(doc.page.width - 40, billingY)
         .stroke()
         .opacity(1);

      // Customer Information
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('QUOTE TO', 40, billingY + 20);

      // Customer details
      let currentCustomerY = billingY + 45;
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor(darkText)
         .text(`${quotation.customer.name}`, 40, currentCustomerY);

      currentCustomerY += 20;
      doc.text(`Phone: ${quotation.customer.phone}`, 40, currentCustomerY);

      currentCustomerY += 20;
      doc.text(`Place: ${quotation.customer.place}`, 40, currentCustomerY);

      if (quotation.customer.email && quotation.customer.email.trim() !== '') {
        currentCustomerY += 20;
        doc.text(`Email: ${quotation.customer.email}`, 40, currentCustomerY);
      }

      if (quotation.customer.gstNo && quotation.customer.gstNo.trim() !== '') {
        currentCustomerY += 20;
        doc.text(`GST No: ${quotation.customer.gstNo}`, 40, currentCustomerY);
      }

      currentCustomerY += 20;
      doc.text(`Address: ${quotation.customer.address}`, 40, currentCustomerY);

      // Items table header (adjust position based on customer info)
      const tableY = currentCustomerY + 40;
      // Table styling with better column widths
      const tableHeaderY = tableY;
      const srNoX = 40;
      const itemNameX = 70;
      const descriptionX = 170;
      const qtyX = 350;
      const unitX = 390;
      const amountX = 430;
      const finalAmountX = 490;

      // Table header background
      doc.rect(40, tableHeaderY, doc.page.width - 80, 20)
         .fillColor('#f8f9fa')
         .fill();

      // Table header text
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#000000')  // Explicit black color for better visibility
         .text('Sr.', srNoX, tableHeaderY + 5)
         .text('Item Name', itemNameX, tableHeaderY + 5)
         .text('Description', descriptionX, tableHeaderY + 5)
         .text('Qty', qtyX, tableHeaderY + 5)
         .text('Unit', unitX, tableHeaderY + 5)
         .text('Amount', amountX, tableHeaderY + 5)
         .text('Final', finalAmountX, tableHeaderY + 5);

      // Table header line
      doc.strokeColor(primaryColor)
         .opacity(0.3)
         .moveTo(40, tableHeaderY + 20)
         .lineTo(doc.page.width - 40, tableHeaderY + 20)
         .stroke()
         .opacity(1);

      // Items
      let itemY = tableHeaderY + 30;
      doc.font('Helvetica')
         .fillColor(darkText);

      quotation.items.forEach((item, index) => {
        const amount = item.amount || 0;
        const discountAmount = (amount * item.discount) / 100;
        const afterDiscount = amount - discountAmount;
        const taxAmount = (afterDiscount * item.taxPercent) / 100;
        const finalAmount = afterDiscount + taxAmount;

        // Calculate row height based on description length
        const descriptionText = item.description || '-';
        const descriptionWidth = 170; // Width available for description column
        const descriptionLines = Math.ceil(descriptionText.length / 25); // More realistic characters per line
        const rowHeight = Math.max(30, descriptionLines * 15 + 15); // Better spacing for readability

        // Check if we need a new page - more conservative to avoid unnecessary page breaks
        if (itemY + rowHeight > doc.page.height - 100) { // Leave 100px margin for footer
          doc.addPage();
          itemY = 40;
        }

        // Draw row background (alternating colors)
        if (index % 2 === 1) {
          doc.rect(40, itemY - 5, doc.page.width - 80, rowHeight)
             .fillColor('#f9f9f9')
             .fill();
        }

        // Draw vertical borders for table columns
        doc.strokeColor('#e0e0e0')
           .opacity(0.5)
           .moveTo(srNoX - 5, itemY - 5)
           .lineTo(srNoX - 5, itemY + rowHeight - 5)
           .stroke()
           .moveTo(itemNameX - 5, itemY - 5)
           .lineTo(itemNameX - 5, itemY + rowHeight - 5)
           .stroke()
           .moveTo(descriptionX - 5, itemY - 5)
           .lineTo(descriptionX - 5, itemY + rowHeight - 5)
           .stroke()
           .moveTo(qtyX - 5, itemY - 5)
           .lineTo(qtyX - 5, itemY + rowHeight - 5)
           .stroke()
           .moveTo(unitX - 5, itemY - 5)
           .lineTo(unitX - 5, itemY + rowHeight - 5)
           .stroke()
           .moveTo(amountX - 5, itemY - 5)
           .lineTo(amountX - 5, itemY + rowHeight - 5)
           .stroke()
           .moveTo(finalAmountX - 5, itemY - 5)
           .lineTo(finalAmountX - 5, itemY + rowHeight - 5)
           .stroke()
           .opacity(1);

        // Draw horizontal border for row
        doc.strokeColor('#e0e0e0')
           .opacity(0.3)
           .moveTo(40, itemY + rowHeight - 5)
           .lineTo(doc.page.width - 40, itemY + rowHeight - 5)
           .stroke()
           .opacity(1);

        // Add text content with proper spacing and full description
        doc.fontSize(9)
           .fillColor(darkText)
           .text((index + 1).toString(), srNoX, itemY + 5)
           .text(item.itemName, itemNameX, itemY + 5, { width: 95, height: rowHeight - 10 })
           .text(descriptionText, descriptionX, itemY + 5, {
             width: 170,
             height: rowHeight - 10,
             lineGap: 2,
             wordSpacing: 0,
             characterSpacing: 0
           })
           .text(item.quantity.toString(), qtyX, itemY + 5)
           .text(item.unit, unitX, itemY + 5)
           .text(`Rs ${amount.toFixed(2)}`, amountX, itemY + 5)
           .text(`Rs ${finalAmount.toFixed(2)}`, finalAmountX, itemY + 5);

        itemY += rowHeight;
      });

      // Table footer line
      doc.strokeColor(primaryColor)
         .opacity(0.3)
         .moveTo(40, itemY)
         .lineTo(doc.page.width - 40, itemY)
         .stroke()
         .opacity(1);

      // Totals section
      itemY += 30;
      const totalsX = doc.page.width - 200;

      // Totals background
      doc.rect(totalsX - 10, itemY - 10, 180, 80)
         .fillColor('#f8f9fa')
         .fill();

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(darkText)
         .text(`Subtotal: Rs ${quotation.subtotal.toFixed(2)}`, totalsX, itemY);
      itemY += 15;
      doc.text(`Total Discount: Rs ${quotation.totalDiscount.toFixed(2)}`, totalsX, itemY);
      itemY += 15;
      doc.text(`Total Tax: Rs ${quotation.totalTax.toFixed(2)}`, totalsX, itemY);
      itemY += 15;

      // Total amount with emphasis
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text(`Total Amount: Rs ${quotation.totalAmount.toFixed(2)}`, totalsX, itemY);

      // Notes section - more compact spacing
      if (quotation.notes && quotation.notes.trim() !== '') {
        itemY += 30; // Reduced from 50
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(primaryColor)
           .text('Notes:', 40, itemY);
        itemY += 15; // Reduced from 20
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(darkText)
           .text(quotation.notes, 40, itemY, { width: 400 });
        itemY += 25; // Add space after notes
      }

      // Terms and Conditions - more compact spacing
      itemY += 30; // Reduced from 50
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('Terms & Conditions:', 40, itemY);
      itemY += 15; // Reduced from 20
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(darkText)
         .text('Thank you for your business! Sold products cannot be returned.', 40, itemY, { width: 400 });

      // Signature Section - more compact spacing
      itemY += 40; // Reduced from 60

      // Check if we need a new page for signatures - only if absolutely necessary
      const signatureSpaceNeeded = 140; // Space needed for signature boxes + labels
      if (itemY + signatureSpaceNeeded > doc.page.height - 40) { // Reduced margin
        doc.addPage();
        itemY = 40;
      }

      // Signature boxes
      const signatureY = itemY;
      const leftSignatureX = 40;
      const rightSignatureX = doc.page.width - 250;
      const signatureWidth = 200;
      const signatureHeight = 80;

      // Company signature box
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('Company Signature:', leftSignatureX, signatureY);

      doc.rect(leftSignatureX, signatureY + 20, signatureWidth, signatureHeight)
         .strokeColor('#cccccc')
         .stroke();

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(darkText)
         .text('Authorized Signatory', leftSignatureX, signatureY + signatureHeight + 30)
         .text('Khushi Decorators', leftSignatureX, signatureY + signatureHeight + 45);

      // Client signature box
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('Client Signature:', rightSignatureX, signatureY);

      doc.rect(rightSignatureX, signatureY + 20, signatureWidth, signatureHeight)
         .strokeColor('#cccccc')
         .stroke();

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(darkText)
         .text('Client Signature', rightSignatureX, signatureY + signatureHeight + 30)
         .text('Date: _______________', rightSignatureX, signatureY + signatureHeight + 45);

      // Footer - position dynamically based on content
      const footerY = signatureY + signatureHeight + 65; // Position after signature content
      const availableSpace = doc.page.height - footerY - 20; // Space remaining

      // Only add footer if there's space, otherwise it will fit naturally
      if (availableSpace >= 20) {
        doc.fontSize(8)
           .fillColor(secondaryColor)
           .text('This is a computer generated quotation.', 40, footerY, { align: 'center' });
      }

      doc.end();
    } catch (error) {
      console.error('PDF generation error:', error);
      reject(error);
    }
  });
}

module.exports = {
  generateBillPDF,
  generateReturnBillPDF,
  generateQuotationPDF,
  generateQuotation2PDF,
  generateBillPDFWithTemplate
};

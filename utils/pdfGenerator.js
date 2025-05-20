const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { generateUpiQRCodeDataURL } = require('./generateQRCode');

// Define colors
const primaryColor = '#2A9D8F';
const secondaryColor = '#264653';
const accentColor = '#E76F51';
const darkText = '#2C3E50';
const lightGray = '#E9ECEF';

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
         .fontSize(12)
         .font('Helvetica')
         .text('68/1159, Shivamod Nagar, Nr Nagurewl Hanuman Temple, Nr Union Industries Estate, Amraiwadi, Ahmedabad', 40, 110, { align: 'center' });

      // Invoice details
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('INVOICE', doc.page.width - 150, 40)
         .fontSize(12)
         .font('Helvetica')
         .text(`#${bill.billNumber}`, doc.page.width - 150, 60)
         .text(`Date: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}`, doc.page.width - 150, 80);

      // Customer and billing information section
      const billingY = 160;

      // Draw separator line
      doc.moveTo(40, billingY).lineTo(doc.page.width - 40, billingY).stroke();

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('BILL TO', 40, billingY + 20)
         .font('Helvetica')
         .text(bill.customer.name, 40, billingY + 40)
         .text(`Phone: ${bill.customer.phone}`, 40, billingY + 60)
         .text(`Place: ${bill.customer.place}`, 40, billingY + 80)
         .text(`Work: ${bill.work}`, 40, billingY + 100);

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

      bill.items.forEach((item, index) => {
        doc.fontSize(10)
           .font('Helvetica')
           .text(item.name, 40, currentY)
           .text(item.category, 180, currentY)
           .text(`₹${item.price.toFixed(2)}`, 320, currentY)
           .text(item.quantity.toString(), 400, currentY)
           .text(`₹${(item.price * item.quantity).toFixed(2)}`, 480, currentY);

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
           .text(`₹${bill.subTotal.toFixed(2)}`, 480, totalY + 10);

        // Show GST details
        const gstY = totalY + 30;
        doc.text(`GST (${bill.gstType} @ ${bill.gstPercentage}%)`, 380, gstY)
           .text(`₹${bill.gstAmount.toFixed(2)}`, 480, gstY);

        // Show total with GST
        const finalTotalY = gstY + 20;
        doc.moveTo(380, finalTotalY).lineTo(doc.page.width - 40, finalTotalY).stroke();

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('TOTAL AMOUNT:', 380, finalTotalY + 10)
           .text(`₹${bill.totalAmount.toFixed(2)}`, 480, finalTotalY + 10);
      } else {
        // No GST, just show total
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('TOTAL AMOUNT:', 380, totalY + 10)
           .text(`₹${bill.totalAmount.toFixed(2)}`, 480, totalY + 10);
      }

      // Payment information section
      const paymentY = bill.gstEnabled ? totalY + 80 : totalY + 40;
      doc.moveTo(40, paymentY).lineTo(doc.page.width - 40, paymentY).stroke();

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
           .text(`₹${bill.paidAmount.toFixed(2)}`, doc.page.width - 180, paymentY + 35)
           .font('Helvetica-Bold')
           .text('Balance Due:', doc.page.width - 280, paymentY + 55)
           .font('Helvetica')
           .text(`₹${bill.remainingAmount.toFixed(2)}`, doc.page.width - 180, paymentY + 55);

        // Status indicator with modern styling
        const statusColor = bill.creditType === 'Full Credit' ? accentColor :
                           bill.creditType === 'Half Credit' ? '#FF9F1C' : '#2A9D8F';
        drawRect(doc, doc.page.width - 100, paymentY + 35, 40, 40, statusColor, 6);
      } else if (bill.paymentType === 'Cash') {
        // Cash payment details with consistent layout
        doc.font('Helvetica-Bold')
           .text('Amount Paid:', doc.page.width - 280, paymentY + 35)
           .font('Helvetica')
           .text(`₹${bill.paidAmount.toFixed(2)}`, doc.page.width - 180, paymentY + 35);

        if (bill.paidAmount < bill.totalAmount) {
          doc.font('Helvetica-Bold')
             .text('Balance Due:', doc.page.width - 280, paymentY + 55)
             .font('Helvetica')
             .text(`₹${bill.remainingAmount.toFixed(2)}`, doc.page.width - 180, paymentY + 55);

          // Status indicator for partial payment
          drawRect(doc, doc.page.width - 100, paymentY + 35, 40, 40, '#FF9F1C', 6);
        } else {
          // Status indicator for full payment
          drawRect(doc, doc.page.width - 100, paymentY + 35, 40, 40, '#2A9D8F', 6);
        }
      }

      // Footer section with modern design
      const footerY = doc.page.height - 80;

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
         .text('Kushi Decorator', 160, footerY + 5)
         .text('|', 240, footerY + 5)
         .text('Phone: +91 9724066417', 260, footerY + 5)
         .text('|', 420, footerY + 5)
         .text('Email: info@kushitrader.com', 440, footerY + 5);

      // Digital copy section
      drawRect(doc, doc.page.width - 100, footerY - 50, 60, 60, lightGray, 6);
      drawBorder(doc, doc.page.width - 100, footerY - 50, 60, 60, primaryColor, 6, 1);
      doc.fillColor(darkText)
         .fontSize(8)
         .text('Scan for', doc.page.width - 100, footerY - 60, { width: 60, align: 'center' })
         .text('digital copy', doc.page.width - 100, footerY - 50, { width: 60, align: 'center' });

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

// Generate Return Bill PDF
const generateReturnBillPDF = (returnBill, filePath) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Create a new PDF document with professional margins
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
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
         .fontSize(12)
         .font('Helvetica')
         .text('68/1159, Shivamod Nagar, Nr Nagurewl Hanuman Temple, Nr Union Industries Estate, Amraiwadi, Ahmedabad', 40, 110, { align: 'center' });

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
         .text('CUSTOMER', 40, billingY + 20)
         .font('Helvetica')
         .text(returnBill.customer.name, 40, billingY + 40)
         .text(`Phone: ${returnBill.customer.phone}`, 40, billingY + 60)
         .text(`Place: ${returnBill.customer.place}`, 40, billingY + 80)
         .text(`Return Reason: ${returnBill.reason}`, 40, billingY + 100);

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
        doc.fontSize(10)
           .font('Helvetica')
           .text(item.name, 40, currentY)
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
         .text('Kushi Decorator', 160, footerY + 5)
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

module.exports = { generateBillPDF, generateReturnBillPDF };

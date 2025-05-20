const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

/**
 * Generate a QR code for UPI payments as a data URL
 * @param {string} upiId - The UPI ID to encode in the QR code
 * @returns {Promise<string>} - Data URL of the generated QR code
 */
function generateUpiQRCodeDataURL(upiId) {
  return new Promise((resolve, reject) => {
    // Create UPI payment string
    // Format: upi://pay?pa=UPI_ID&pn=NAME&mc=0000&tid=0000&tr=Invoice&am=0&cu=INR
    const upiString = `upi://pay?pa=${upiId}&pn=KhushiDecorators&mc=5499&tid=KD${Date.now()}&tr=Invoice&cu=INR`;

    // Generate QR code as data URL
    QRCode.toDataURL(upiString, {
      color: {
        dark: '#000000',  // Black dots
        light: '#FFFFFF'  // White background
      },
      width: 300,
      margin: 1,
      errorCorrectionLevel: 'H' // High error correction for better scanning
    }, function(err, dataURL) {
      if (err) {
        console.error('Error generating QR code data URL:', err);
        reject(err);
      } else {
        console.log('QR code data URL generated successfully');
        resolve(dataURL);
      }
    });
  });
}

/**
 * Generate a QR code for UPI payments and save to file
 * @param {string} upiId - The UPI ID to encode in the QR code
 * @param {string} outputPath - Path to save the QR code image
 * @returns {Promise<string>} - Path to the generated QR code
 */
function generateUpiQRCode(upiId, outputPath) {
  return new Promise((resolve, reject) => {
    // First generate the data URL
    generateUpiQRCodeDataURL(upiId)
      .then(dataURL => {
        try {
          // Convert data URL to buffer
          const data = dataURL.split(',')[1];
          const buffer = Buffer.from(data, 'base64');

          // Ensure the directory exists
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // Write buffer to file
          fs.writeFileSync(outputPath, buffer);
          console.log('QR code saved to file successfully at:', outputPath);
          resolve(outputPath);
        } catch (error) {
          console.error('Error saving QR code to file:', error);
          reject(error);
        }
      })
      .catch(reject);
  });
}

// Export the functions for use in other files
module.exports = {
  generateUpiQRCode,
  generateUpiQRCodeDataURL
};

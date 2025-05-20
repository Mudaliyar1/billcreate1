const SibApiV3Sdk = require('sib-api-v3-sdk');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

/**
 * Validate an email address format
 * @param {string} email - The email address to validate
 * @returns {boolean} - True if the email format is valid
 */
const isValidEmailFormat = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Check if an email domain has valid MX records
 * @param {string} email - The email address to check
 * @returns {Promise<boolean>} - Promise that resolves to true if the domain has valid MX records
 */
const hasValidMXRecords = async (email) => {
  try {
    const domain = email.split('@')[1];
    return new Promise((resolve) => {
      dns.resolveMx(domain, (err, addresses) => {
        if (err || !addresses || addresses.length === 0) {
          console.log(`No MX records found for domain: ${domain}`);
          resolve(false);
        } else {
          console.log(`Valid MX records found for domain: ${domain}`);
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error('Error checking MX records:', error);
    return false;
  }
};

// Configure Brevo API client
const configureClient = () => {
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  const apiKey = defaultClient.authentications['api-key'];
  apiKey.apiKey = process.env.BREVO_API_KEY;
  return defaultClient;
};

/**
 * Send a bill to a customer via email
 * @param {Object} bill - The bill object
 * @param {string} pdfPath - Path to the bill PDF file
 * @returns {Promise} - Promise that resolves when email is sent
 */
const sendBillEmail = async (bill, pdfPath) => {
  try {
    // Check if customer email exists
    if (!bill.customer || !bill.customer.email) {
      console.log('No customer email provided, skipping email sending');
      return { success: false, message: 'No customer email provided' };
    }

    // Validate email format
    if (!isValidEmailFormat(bill.customer.email)) {
      console.log(`Invalid email format: ${bill.customer.email}`);
      return { success: false, message: 'Invalid email format' };
    }

    // Check MX records (optional, can be disabled if causing delays)
    const hasMXRecords = await hasValidMXRecords(bill.customer.email);
    if (!hasMXRecords) {
      console.log(`Warning: No valid MX records for domain in email: ${bill.customer.email}`);
      // We'll still try to send the email, but log the warning
    }

    // Configure API client
    configureClient();

    // Create API instance
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    // Read the PDF file
    const pdfContent = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfContent.toString('base64');

    // Create sender - using a verified Brevo sender address
    // Note: For Brevo to work properly, this email should be verified in your Brevo account
    // If emails are not being delivered, try using noreply@brevo.com as a fallback
    const sender = {
      name: 'Khushi Decorators',
      email: 'noreply@brevo.com' // Using Brevo's default sender which is already verified
    };

    // Create recipient
    const recipients = [
      {
        email: bill.customer.email,
        name: bill.customer.name
      }
    ];

    // Create email content with improved formatting and structure
    const emailContent = {
      sender,
      to: recipients,
      subject: `Your Bill from Khushi Decorators - ${bill.billNumber}`,
      htmlContent: `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f8f9fa; padding: 15px; text-align: center; }
              .content { padding: 20px 0; }
              .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              table, th, td { border: 1px solid #ddd; }
              th, td { padding: 12px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Khushi Decorators</h2>
              </div>
              <div class="content">
                <p>Dear ${bill.customer.name},</p>
                <p>Thank you for your purchase from Khushi Decorators. Please find attached your bill (${bill.billNumber}).</p>

                <h3>Bill Details:</h3>
                <table>
                  <tr>
                    <th>Bill Number</th>
                    <td>${bill.billNumber}</td>
                  </tr>
                  <tr>
                    <th>Date</th>
                    <td>${new Date(bill.createdAt).toLocaleDateString()}</td>
                  </tr>
                  <tr>
                    <th>Total Amount</th>
                    <td>₹${bill.totalAmount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <th>Paid Amount</th>
                    <td>₹${bill.paidAmount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <th>Remaining Amount</th>
                    <td>₹${bill.remainingAmount.toFixed(2)}</td>
                  </tr>
                </table>

                <p>If you have any questions regarding your bill, please contact us at +91 9724066417.</p>
                <p>Thank you for your business!</p>
                <p>Regards,<br>Khushi Decorators</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
                <p>© ${new Date().getFullYear()} Khushi Decorators. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      // Add replyTo to ensure replies go to a valid address
      replyTo: {
        email: 'info@kushitrader.com',
        name: 'Khushi Decorators Support'
      },
      attachment: [
        {
          content: pdfBase64,
          name: `${bill.billNumber}.pdf`
        }
      ]
    };

    // Log the email being sent for debugging
    console.log(`Attempting to send email to: ${bill.customer.email}`);
    console.log(`Email subject: ${emailContent.subject}`);
    console.log(`Attachment name: ${emailContent.attachment[0].name}`);

    // Send the email
    const data = await apiInstance.sendTransacEmail(emailContent);

    // Log detailed success information
    console.log('Email sent successfully with message ID:', data.messageId);
    console.log(`Email sent to: ${bill.customer.email} for bill: ${bill.billNumber}`);

    return {
      success: true,
      message: 'Email sent successfully',
      data,
      recipient: bill.customer.email,
      messageId: data.messageId
    };
  } catch (error) {
    // Enhanced error logging
    console.error('Error sending email:');
    console.error(`Recipient: ${bill.customer.email}`);
    console.error(`Bill number: ${bill.billNumber}`);
    console.error(`Error message: ${error.message}`);

    if (error.response) {
      console.error('API response error:', error.response.text);
      console.error('Status code:', error.response.statusCode);
    }

    // Check for common email issues
    let errorMessage = `Error sending email: ${error.message}`;

    if (error.message.includes('not authorized')) {
      errorMessage = 'Email sending failed: API key not authorized. Please check your Brevo API key.';
    } else if (error.message.includes('invalid parameter')) {
      errorMessage = 'Email sending failed: Invalid parameters. Please check the email address format.';
    } else if (error.message.includes('quota exceeded')) {
      errorMessage = 'Email sending failed: Sending quota exceeded. Please try again later.';
    }

    return {
      success: false,
      message: errorMessage,
      error,
      recipient: bill.customer.email
    };
  }
};

module.exports = {
  sendBillEmail,
  isValidEmailFormat,
  hasValidMXRecords
};

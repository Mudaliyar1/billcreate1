const express = require('express');
const router = express.Router();
const { sendBillEmail, isValidEmailFormat, hasValidMXRecords } = require('../utils/emailService');
const Bill = require('../models/Bill');
const path = require('path');
const fs = require('fs');
const { isAuthenticated, ensureAdmin } = require('../middleware/auth');

// Test email route - only accessible by admins
router.get('/test-email/:billId', isAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const billId = req.params.billId;

    // Find the bill
    const bill = await Bill.findById(billId);
    if (!bill) {
      req.flash('error', 'Bill not found');
      return res.redirect('/bills');
    }

    // Check if bill has customer email
    if (!bill.customer || !bill.customer.email) {
      req.flash('error', 'This bill has no customer email');
      return res.redirect(`/bills/${billId}`);
    }

    // Validate email format
    if (!isValidEmailFormat(bill.customer.email)) {
      req.flash('error', `Invalid email format: ${bill.customer.email}`);
      return res.redirect(`/bills/${billId}`);
    }

    // Check MX records
    const hasMXRecords = await hasValidMXRecords(bill.customer.email);
    if (!hasMXRecords) {
      req.flash('warning', `Warning: No valid MX records for domain in email: ${bill.customer.email}`);
      // We'll still try to send the email
    }

    // Get PDF path
    const pdfDir = path.join(__dirname, '..', 'public', 'bills');
    const pdfPath = path.join(pdfDir, `bill-${bill._id}.pdf`);

    // Check if PDF exists
    if (!fs.existsSync(pdfPath)) {
      req.flash('error', 'Bill PDF not found');
      return res.redirect(`/bills/${billId}`);
    }

    // Send email
    const emailResult = await sendBillEmail(bill, pdfPath);

    if (emailResult.success) {
      req.flash('success', `Test email sent successfully to ${bill.customer.email}`);
    } else {
      req.flash('error', `Failed to send test email: ${emailResult.message}`);
    }

    res.redirect(`/bills/${billId}`);
  } catch (error) {
    console.error('Test email error:', error);
    req.flash('error', `Error sending test email: ${error.message}`);
    res.redirect('/bills');
  }
});

// Email validation test route
router.get('/validate-email', isAuthenticated, ensureAdmin, (req, res) => {
  res.render('admin/validate-email', {
    title: 'Email Validation Test',
    user: req.user
  });
});

// Email validation test POST route
router.post('/validate-email', isAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email format
    const isValid = isValidEmailFormat(email);

    // Check MX records
    let hasMX = false;
    if (isValid) {
      hasMX = await hasValidMXRecords(email);
    }

    res.render('admin/validate-email', {
      title: 'Email Validation Test',
      user: req.user,
      email,
      isValid,
      hasMX,
      tested: true
    });
  } catch (error) {
    console.error('Email validation error:', error);
    req.flash('error', `Error validating email: ${error.message}`);
    res.redirect('/test/validate-email');
  }
});

module.exports = router;

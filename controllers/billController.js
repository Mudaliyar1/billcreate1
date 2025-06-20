const Bill = require('../models/Bill');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const ReturnBill = require('../models/ReturnBill');
const Admin = require('../models/Admin');
const { generateBillPDF, generateBillPDFWithTemplate } = require('../utils/pdfGenerator');
const { sendBillEmail, isValidEmailFormat } = require('../utils/emailService');
const fs = require('fs');
const path = require('path');

// Utility function to handle floating-point comparisons with tolerance
function isAmountValid(paidAmount, totalAmount, tolerance = 1.0) {
  return paidAmount <= (totalAmount + tolerance);
}

// Utility function to round amounts to 2 decimal places to avoid precision issues
function roundAmount(amount) {
  return Math.round(amount * 100) / 100;
}

// Get bill creation form
exports.getCreateBill = async (req, res) => {
  try {
    // Get product categories
    const categories = ['Board', 'Chanel', 'Hardware', 'Bori'];

    res.render('bills/create', {
      title: 'Create Bill - Kushi Decorators',
      categories,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get create bill error:', error);
    req.flash('error', 'Failed to load bill creation page');
    res.redirect('/dashboard');
  }
};

// Create new bill
exports.postCreateBill = async (req, res) => {
  try {
    // Debug the request body
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    // Extract form data, handling array fields with square brackets in names
    const customerName = req.body.customerName;
    const customerPhone = req.body.customerPhone;
    const customerPlace = req.body.customerPlace;
    const customerEmail = req.body.customerEmail;
    const work = req.body.work;
    const pickedBy = req.body.pickedBy;
    const unknownCustomer = req.body.unknownCustomer === 'on';
    const paymentType = req.body.paymentType;
    const creditType = req.body.creditType;
    const paidAmount = req.body.paidAmount;
    const customPaidAmount = req.body.customPaidAmount;
    const discountAmount = req.body.discountAmount;
    const billDate = req.body.billDate;

    // GST related fields
    const gstEnabled = req.body.gstEnabled === 'on';
    let gstType = req.body.gstType;
    let gstPercentage = parseFloat(req.body.gstPercentage) || 0;
    const gstAmount = parseFloat(req.body.gstAmount) || 0;
    const subTotal = parseFloat(req.body.subTotal) || 0;

    // Use default GST type if not provided but GST is enabled
    if (gstEnabled && (!gstType || gstType === '')) {
      gstType = req.body.defaultGstType || 'CGST+SGST 12%';
      console.log('Using default GST type:', gstType);
    }

    // Use default GST percentage if not provided but GST is enabled
    if (gstEnabled && (!gstPercentage || gstPercentage === 0)) {
      gstPercentage = 12;
      console.log('Using default GST percentage:', gstPercentage);
    }

    // Handle array fields that might have square brackets in their names
    // We need to collect ALL productIds and quantities, not just one format
    let allProductIds = [];
    let allQuantities = [];

    // Collect from both formats
    if (req.body.productIds) {
      if (Array.isArray(req.body.productIds)) {
        allProductIds.push(...req.body.productIds);
      } else {
        allProductIds.push(req.body.productIds);
      }
    }

    if (req.body['productIds[]']) {
      if (Array.isArray(req.body['productIds[]'])) {
        allProductIds.push(...req.body['productIds[]']);
      } else {
        allProductIds.push(req.body['productIds[]']);
      }
    }

    if (req.body.quantities) {
      if (Array.isArray(req.body.quantities)) {
        allQuantities.push(...req.body.quantities);
      } else {
        allQuantities.push(req.body.quantities);
      }
    }

    if (req.body['quantities[]']) {
      if (Array.isArray(req.body['quantities[]'])) {
        allQuantities.push(...req.body['quantities[]']);
      } else {
        allQuantities.push(req.body['quantities[]']);
      }
    }

    // Filter out empty values
    const productIds = allProductIds.filter(Boolean);
    const quantities = allQuantities.filter(Boolean);

    console.log('=== DETAILED FORM DATA DEBUG ===');
    console.log('Complete request body:', JSON.stringify(req.body, null, 2));
    console.log('Raw form data for products:', {
      'productIds[]': req.body['productIds[]'],
      'productIds': req.body.productIds,
      'quantities[]': req.body['quantities[]'],
      'quantities': req.body.quantities,
      'allProductIds': allProductIds,
      'allQuantities': allQuantities,
      'finalProductIds': productIds,
      'finalQuantities': quantities
    });

    // Validate input with detailed error messages
    const missingFields = [];

    // Only validate customer fields if not in unknown customer mode
    if (!unknownCustomer) {
      if (!customerName) missingFields.push('Customer Name');
      if (!customerPhone) missingFields.push('Phone Number');
      if (!customerPlace) missingFields.push('Place');
      if (!work) missingFields.push('Work');
      if (!pickedBy) missingFields.push('Picked By');
    }

    if (!paymentType) missingFields.push('Payment Type');

    // Check if productIds and quantities exist in any form (array or single value)
    // Log the values for debugging
    console.log('Product IDs:', productIds);
    console.log('Quantities:', quantities);

    // Check if they exist and are not empty
    const hasProductIds = productIds !== undefined && productIds !== null && productIds !== '';
    const hasQuantities = quantities !== undefined && quantities !== null && quantities !== '';

    if (!hasProductIds) missingFields.push('Products');
    if (!hasQuantities) missingFields.push('Quantities');

    if (missingFields.length > 0) {
      req.flash('error', `Missing required fields: ${missingFields.join(', ')}`);
      return res.redirect('/bills/create');
    }

    // Validate bill date
    if (billDate) {
      const selectedDate = new Date(billDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Set to end of today

      if (selectedDate > today) {
        req.flash('error', 'Bill date cannot be in the future');
        return res.redirect('/bills/create');
      }
    }

    // Convert productIds and quantities to arrays if they're not already
    // Handle both array and single value cases
    let productIdArray = [];
    let quantityArray = [];

    if (Array.isArray(productIds)) {
      productIdArray = productIds;
    } else if (productIds) {
      productIdArray = [productIds];
    }

    if (Array.isArray(quantities)) {
      quantityArray = quantities;
    } else if (quantities) {
      quantityArray = [quantities];
    }

    console.log('Product ID Array:', productIdArray);
    console.log('Quantity Array:', quantityArray);

    // Validate products and quantities with more detailed error messages
    if (productIdArray.length === 0) {
      req.flash('error', 'Please add at least one product');
      return res.redirect('/bills/create');
    }

    if (quantityArray.length === 0) {
      req.flash('error', 'Please specify quantities for products');
      return res.redirect('/bills/create');
    }

    if (productIdArray.length !== quantityArray.length) {
      req.flash('error', 'Product and quantity counts do not match. Please try again.');
      return res.redirect('/bills/create');
    }

    // Filter out any empty product IDs (this can happen with disabled selects)
    const validProductIds = productIdArray.filter(id => id && id.trim() !== '');
    const validQuantities = [];

    // Match quantities to valid product IDs
    for (let i = 0; i < productIdArray.length; i++) {
      if (productIdArray[i] && productIdArray[i].trim() !== '') {
        validQuantities.push(quantityArray[i]);
      }
    }

    // Check if we have any valid products
    if (validProductIds.length === 0) {
      req.flash('error', 'Please select at least one product');
      return res.redirect('/bills/create');
    }

    // Get products from database using valid product IDs
    console.log('Searching for products with IDs:', validProductIds);
    const products = await Product.find({ _id: { $in: validProductIds } });

    console.log('Found products:', products.map(p => ({
      id: p._id.toString(),
      name: p.name,
      price: p.price,
      category: p.category,
      quantity: p.quantity
    })));

    if (products.length !== validProductIds.length) {
      console.log(`Product count mismatch: Expected ${validProductIds.length}, Found ${products.length}`);
      const foundIds = products.map(p => p._id.toString());
      const missingIds = validProductIds.filter(id => !foundIds.includes(id));
      console.log('Missing product IDs:', missingIds);
      req.flash('error', 'Some products were not found');
      return res.redirect('/bills/create');
    }

    // Create items array
    const items = [];
    let totalAmount = 0;
    const productUpdates = [];

    console.log('=== PROCESSING PRODUCTS FOR BILL CALCULATION ===');
    console.log('Valid Product IDs:', validProductIds);
    console.log('Valid Quantities:', validQuantities);
    console.log('Products found in database:', products.length);
    console.log('Database products:', products.map(p => ({ id: p._id.toString(), name: p.name, price: p.price })));

    for (let i = 0; i < validProductIds.length; i++) {
      const product = products.find(p => p._id.toString() === validProductIds[i]);
      const quantity = parseInt(validQuantities[i]);

      console.log(`Processing item ${i + 1}:`, {
        productId: validProductIds[i],
        quantity,
        product: product ? { name: product.name, price: product.price } : 'NOT FOUND'
      });

      if (product && quantity > 0) {
        // Check if there's enough quantity in stock
        if (product.quantity < quantity) {
          req.flash('error', `Not enough stock for ${product.name}. Available: ${product.quantity}, Requested: ${quantity}`);
          return res.redirect('/bills/create');
        }

        const itemAmount = roundAmount(product.price * quantity);
        totalAmount = roundAmount(totalAmount + itemAmount);

        console.log(`Item calculation:`, {
          name: product.name,
          price: product.price,
          quantity,
          itemAmount,
          runningTotal: totalAmount
        });

        items.push({
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: quantity,
          category: product.category
        });

        // Add to product updates array to update inventory later
        productUpdates.push({
          productId: product._id,
          quantity: quantity,
          price: product.price
        });
      }
    }



    console.log('=== FINAL ITEMS ARRAY ===');
    console.log('Total items processed:', items.length);
    console.log('Items array:', JSON.stringify(items, null, 2));
    console.log('Total amount calculated:', totalAmount);

    // Ensure we have at least one valid item
    if (items.length === 0) {
      req.flash('error', 'No valid products were found. Please try again.');
      return res.redirect('/bills/create');
    }

    // Create or update customer (skip for unknown customers)
    let customer;

    if (!unknownCustomer) {
      // Normal customer creation/update logic for known customers
      customer = await Customer.findOne({ phone: customerPhone });

      if (!customer) {
        customer = await Customer.create({
          name: customerName,
          phone: customerPhone,
          place: customerPlace,
          email: customerEmail
        });
      } else {
        // Update customer details if they've changed
        if (customer.name !== customerName || customer.place !== customerPlace || customer.email !== customerEmail) {
          customer.name = customerName;
          customer.place = customerPlace;
          customer.email = customerEmail;
          await customer.save();
        }
      }
    }
    // For unknown customers, we don't create/update customer records

    // Calculate GST amount if enabled
    let calculatedGstAmount = 0;
    let finalTotalAmount = totalAmount;

    if (gstEnabled) {
      // Use the GST amount from the form or calculate it
      if (gstType && gstPercentage > 0) {
        calculatedGstAmount = gstAmount || roundAmount(totalAmount * gstPercentage / 100);
      } else {
        // Default to 12% if no GST type or percentage is provided
        calculatedGstAmount = roundAmount(totalAmount * 0.12);
      }

      // Round the GST amount
      calculatedGstAmount = roundAmount(calculatedGstAmount);

      // Add GST amount to total
      finalTotalAmount = roundAmount(totalAmount + calculatedGstAmount);
    }

    // Check if frontend and backend calculations match
    const frontendSubtotal = parseFloat(req.body.subTotal || 0);
    const backendSubtotal = totalAmount;
    const calculationMismatch = Math.abs(frontendSubtotal - backendSubtotal) > 1.0;

    console.log('Final amount calculation:', {
      subTotal: totalAmount,
      gstEnabled,
      gstAmount: calculatedGstAmount,
      finalTotalAmount,
      requestPaidAmount: paidAmount,
      requestSubTotal: req.body.subTotal,
      frontendVsBackend: {
        subtotalMatch: !calculationMismatch,
        frontendSubtotal,
        backendSubtotal,
        difference: frontendSubtotal - backendSubtotal,
        mismatch: calculationMismatch
      }
    });

    // If there's a significant mismatch, use frontend calculation but log it
    if (calculationMismatch && frontendSubtotal > 0) {
      console.log('WARNING: Frontend and backend calculations differ significantly!');
      console.log(`Using frontend calculation: ₹${frontendSubtotal} instead of backend: ₹${backendSubtotal}`);

      // Use frontend subtotal for final calculation
      totalAmount = frontendSubtotal;

      // Recalculate final total with GST if enabled
      if (gstEnabled) {
        calculatedGstAmount = roundAmount(totalAmount * gstPercentage / 100);
        finalTotalAmount = roundAmount(totalAmount + calculatedGstAmount);
      } else {
        finalTotalAmount = totalAmount;
      }

      // Apply discount to final total
      const parsedDiscountAmount = parseFloat(discountAmount) || 0;
      if (parsedDiscountAmount > 0) {
        // Validate discount doesn't exceed total
        if (parsedDiscountAmount > finalTotalAmount) {
          req.flash('error', `Discount amount (₹${parsedDiscountAmount}) cannot exceed the total amount (₹${finalTotalAmount.toFixed(2)})`);
          return res.redirect('/bills/create');
        }

        finalTotalAmount = Math.max(0, finalTotalAmount - parsedDiscountAmount);

        console.log('Applied discount:', {
          discountAmount: parsedDiscountAmount,
          finalTotalAfterDiscount: finalTotalAmount
        });
      }

      console.log('Adjusted final calculation:', {
        adjustedSubTotal: totalAmount,
        adjustedGstAmount: calculatedGstAmount,
        adjustedDiscountAmount: parsedDiscountAmount,
        adjustedFinalTotal: finalTotalAmount
      });
    }

    // Prepare bill data
    const billData = {
      isUnknown: unknownCustomer, // Set this first for conditional validation
      customer: {
        name: unknownCustomer ? 'Unknown' : customerName,
        phone: unknownCustomer ? 'Unknown' : customerPhone,
        place: unknownCustomer ? 'Unknown' : customerPlace,
        email: unknownCustomer ? '' : (customerEmail || '')
      },
      work: unknownCustomer ? 'Unknown' : work,
      pickedBy: unknownCustomer ? 'Unknown' : pickedBy,
      items,
      subTotal: totalAmount,
      gstEnabled,
      discountAmount: parseFloat(discountAmount) || 0,
      totalAmount: finalTotalAmount,
      paymentType,
      billDate: billDate ? new Date(billDate) : new Date()
    };

    // Add GST fields if enabled
    if (gstEnabled) {
      // If GST is enabled but no type or percentage is provided, use default values
      if (!gstType || !gstPercentage) {
        console.log('GST enabled but missing type or percentage, using default values');
        billData.gstType = 'CGST+SGST 12%'; // Default type
        billData.gstPercentage = 12; // Default percentage
        billData.gstAmount = (totalAmount * 12) / 100; // Calculate GST amount with default percentage
      } else {
        billData.gstType = gstType;
        billData.gstPercentage = gstPercentage;
        billData.gstAmount = calculatedGstAmount;
      }
    }

    // Handle payment (only Cash is supported)
    if (paidAmount) {
      // Parse the paid amount
      const parsedAmount = parseFloat(paidAmount);

      console.log('Payment validation details:', {
        rawPaidAmount: paidAmount,
        parsedAmount,
        finalTotalAmount,
        difference: parsedAmount - finalTotalAmount,
        isValid: isAmountValid(parsedAmount, finalTotalAmount),
        tolerance: 1.0,
        willPass: parsedAmount <= (finalTotalAmount + 1.0)
      });

      // Validate the paid amount
      if (isNaN(parsedAmount)) {
        console.log('Invalid paid amount - not a number:', paidAmount);
        req.flash('error', 'Invalid paid amount. Please enter a valid number.');
        return res.redirect('/bills/create');
      }

      // Ensure paid amount doesn't exceed total (with very generous tolerance for floating-point precision)
      const tolerance = Math.max(10.0, finalTotalAmount * 0.01); // 1% of total or ₹10, whichever is higher

      // Additional check: if paid amount matches frontend subtotal, allow it
      const frontendSubtotal = parseFloat(req.body.subTotal || 0);
      const matchesFrontendCalculation = Math.abs(parsedAmount - frontendSubtotal) <= 1.0;

      if (parsedAmount > (finalTotalAmount + tolerance) && !matchesFrontendCalculation) {
        console.log('Payment validation failed with details:', {
          parsedAmount,
          finalTotalAmount,
          tolerance,
          difference: parsedAmount - finalTotalAmount,
          exceedsBy: parsedAmount - finalTotalAmount - tolerance,
          frontendSubtotal,
          matchesFrontendCalculation
        });
        req.flash('error', `Paid amount (₹${parsedAmount}) cannot exceed the total amount (₹${finalTotalAmount}). If this seems incorrect, please refresh the page and try again.`);
        return res.redirect('/bills/create');
      }

      // If paid amount matches frontend calculation but not backend, log it but allow
      if (matchesFrontendCalculation && Math.abs(parsedAmount - finalTotalAmount) > tolerance) {
        console.log('NOTICE: Paid amount matches frontend calculation, allowing despite backend mismatch:', {
          parsedAmount,
          finalTotalAmount,
          frontendSubtotal,
          backendCalculatedTotal: finalTotalAmount
        });
      }

      console.log('Payment validation passed successfully');

      billData.paidAmount = parsedAmount;
      billData.remainingAmount = finalTotalAmount - parsedAmount;

      // Log the payment data for debugging
      console.log('Payment data:', {
        paidAmount: billData.paidAmount,
        remainingAmount: billData.remainingAmount,
        subTotal: billData.subTotal,
        gstAmount: billData.gstAmount,
        totalAmount: billData.totalAmount
      });
    } else {
      // Default: full payment
      billData.paidAmount = finalTotalAmount;
      billData.remainingAmount = 0;
    }

    // Bill number will be generated by the model's pre-save hook

    console.log('=== CREATING BILL ===');
    console.log('Bill data being saved:', JSON.stringify(billData, null, 2));

    // Create bill
    const bill = await Bill.create(billData);

    console.log('=== BILL CREATED ===');
    console.log('Created bill ID:', bill._id);
    console.log('Created bill items:', JSON.stringify(bill.items, null, 2));

    // Update inventory for each product
    for (const update of productUpdates) {
      const product = await Product.findById(update.productId);
      if (product) {
        // Decrease quantity
        product.quantity -= update.quantity;
        // Increase total sold
        product.totalSold += update.quantity;

        // Update financial tracking based on payment type
        const itemTotal = update.price * update.quantity;
        if (paymentType === 'Cash') {
          // For cash payments, track based on paid vs remaining
          if (billData.paidAmount >= billData.totalAmount) {
            // Fully paid
            product.totalPaidAmount += itemTotal;
          } else {
            // Partially paid - split proportionally
            const paidRatio = billData.paidAmount / billData.totalAmount;
            product.totalPaidAmount += itemTotal * paidRatio;
            product.totalCreditAmount += itemTotal * (1 - paidRatio);
          }
        } else if (paymentType === 'Credit') {
          // For credit payments
          if (creditType === 'Full Credit') {
            product.totalCreditAmount += itemTotal;
          } else if (creditType === 'Half Credit') {
            product.totalPaidAmount += itemTotal / 2;
            product.totalCreditAmount += itemTotal / 2;
          } else if (creditType === 'Custom Credit') {
            const paidRatio = billData.paidAmount / billData.totalAmount;
            product.totalPaidAmount += itemTotal * paidRatio;
            product.totalCreditAmount += itemTotal * (1 - paidRatio);
          }
        }

        await product.save();
      }
    }

    // Generate PDF
    const pdfDir = path.join(__dirname, '../public/bills');

    // Create directory if it doesn't exist
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const pdfPath = path.join(pdfDir, `bill-${bill._id}.pdf`);

    // Generate PDF using original format (not template)
    await generateBillPDF(bill, pdfPath);

    // Send email if customer email is provided
    if (bill.customer && bill.customer.email) {
      // Validate email format before attempting to send
      if (!isValidEmailFormat(bill.customer.email)) {
        console.log(`Invalid email format detected: ${bill.customer.email}`);
        req.flash('success', 'Bill created successfully but email format is invalid');
      } else {
        try {
          console.log(`Attempting to send email to: ${bill.customer.email}`);
          const emailResult = await sendBillEmail(bill, pdfPath);

          if (emailResult.success) {
            console.log(`Email successfully sent to ${bill.customer.email} with message ID: ${emailResult.messageId}`);
            req.flash('success', `Bill created successfully and sent to ${bill.customer.email}`);
          } else {
            console.error('Email sending failed:', emailResult.message);
            req.flash('success', `Bill created successfully but email could not be sent: ${emailResult.message}`);
          }
        } catch (emailError) {
          console.error('Error in email sending process:', emailError);
          req.flash('success', 'Bill created successfully but there was an error sending the email');
        }
      }
    } else {
      req.flash('success', 'Bill created successfully');
    }

    res.redirect(`/bills/${bill._id}`);
  } catch (error) {
    console.error('Create bill error:', error);

    // Provide more specific error messages based on the error type
    if (error.name === 'ValidationError') {
      // Mongoose validation error
      const validationErrors = Object.values(error.errors).map(err => err.message);
      req.flash('error', `Validation error: ${validationErrors.join(', ')}`);
    } else if (error.code === 11000) {
      // Duplicate key error
      if (error.keyPattern && error.keyPattern.billNumber) {
        // This is a duplicate bill number error
        req.flash('error', 'Failed to generate a unique bill number. Please try again.');
      } else {
        req.flash('error', 'A bill with this information already exists');
      }
    } else if (error.message && error.message.includes('bill number')) {
      // Specific error related to bill number generation
      req.flash('error', 'Failed to generate a unique bill number. Please try again.');
    } else {
      // Generic error
      req.flash('error', `Failed to create bill: ${error.message}`);
    }

    res.redirect('/bills/create');
  }
};

// Get all bills
exports.getBills = async (req, res) => {
  try {
    const bills = await Bill.find().sort({ createdAt: -1 });

    res.render('bills/list', {
      title: 'Bills - Kushi Decorators',
      bills,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get bills error:', error);
    req.flash('error', 'Failed to fetch bills');
    res.redirect('/dashboard');
  }
};

// Get unknown bills
exports.getUnknownBills = async (req, res) => {
  try {
    // Get search parameters from query
    const { billNumber, dateFrom, dateTo, paymentStatus, search } = req.query;

    // Build search query
    let searchQuery = { isUnknown: true };

    // Search by bill number
    if (billNumber && billNumber.trim()) {
      searchQuery.billNumber = { $regex: billNumber.trim(), $options: 'i' };
    }

    // Search by date range
    if (dateFrom || dateTo) {
      searchQuery.billDate = {};
      if (dateFrom) {
        searchQuery.billDate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add one day to include the end date
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        searchQuery.billDate.$lt = endDate;
      }
    }

    // Search by payment status
    if (paymentStatus) {
      if (paymentStatus === 'pending') {
        searchQuery.remainingAmount = { $gt: 0 };
      } else if (paymentStatus === 'paid') {
        searchQuery.remainingAmount = { $lte: 0 };
      }
    }

    // General search across bill number (if search parameter is provided)
    if (search && search.trim()) {
      searchQuery.$or = [
        { billNumber: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    console.log('Unknown bills search query:', JSON.stringify(searchQuery, null, 2));

    const unknownBills = await Bill.find(searchQuery).sort({ createdAt: -1 });

    // Calculate statistics for all unknown bills (not just filtered)
    const allUnknownBills = await Bill.find({ isUnknown: true });
    const totalUnknownBills = allUnknownBills.length;
    const totalAmount = allUnknownBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const totalPaid = allUnknownBills.reduce((sum, bill) => sum + bill.paidAmount, 0);
    const totalRemaining = allUnknownBills.reduce((sum, bill) => sum + bill.remainingAmount, 0);

    // Calculate filtered statistics
    const filteredStats = {
      totalBills: unknownBills.length,
      totalAmount: unknownBills.reduce((sum, bill) => sum + bill.totalAmount, 0),
      totalPaid: unknownBills.reduce((sum, bill) => sum + bill.paidAmount, 0),
      totalRemaining: unknownBills.reduce((sum, bill) => sum + bill.remainingAmount, 0)
    };

    const stats = {
      totalBills: totalUnknownBills,
      totalAmount,
      totalPaid,
      totalRemaining
    };

    res.render('bills/unknown', {
      title: 'Unknown Bills - Kushi Decorators',
      bills: unknownBills,
      stats,
      filteredStats,
      searchParams: { billNumber, dateFrom, dateTo, paymentStatus, search },
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get unknown bills error:', error);
    req.flash('error', 'Failed to fetch unknown bills');
    res.redirect('/dashboard');
  }
};

// Get bill details
exports.getBillDetails = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id).populate('items.product');

    if (!bill) {
      req.flash('error', 'Bill not found');
      return res.redirect('/bills');
    }

    // DEBUG: Log the bill details to see what's actually in the database
    console.log('=== BILL DETAILS DEBUG ===');
    console.log('Bill ID:', bill._id);
    console.log('Bill Number:', bill.billNumber);
    console.log('Total Amount:', bill.totalAmount);
    console.log('Items count:', bill.items.length);
    console.log('Items details:', JSON.stringify(bill.items, null, 2));

    // Check if a return bill exists for this bill
    const returnBill = await ReturnBill.findOne({ originalBill: bill._id });

    // Get admin user for the view
    const admin = await Admin.findById(req.session.adminId);

    res.render('bills/details', {
      title: `Bill ${bill.billNumber} - Kushi Decorators`,
      bill,
      returnBill,
      user: admin ? { ...admin.toObject(), isAdmin: true } : null,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get bill details error:', error);
    req.flash('error', 'Failed to fetch bill details');
    res.redirect('/bills');
  }
};

// Download bill PDF
exports.downloadBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      req.flash('error', 'Bill not found');
      return res.redirect('/bills');
    }

    // Get template ID from query parameter
    const templateId = req.query.template || null;

    // Create unique filename based on template
    const templateSuffix = templateId ? `-template-${templateId}` : '';
    const pdfPath = path.join(__dirname, '../public/bills', `bill-${bill._id}${templateSuffix}.pdf`);

    // Generate PDF based on whether template is specified
    if (templateId) {
      // User selected a specific template - use template system
      try {
        console.log(`Generating PDF with template: ${templateId}`);
        const pdfBuffer = await generateBillPDFWithTemplate(bill, templateId, req.user._id);
        fs.writeFileSync(pdfPath, pdfBuffer);
        console.log('PDF generated successfully with selected template');
      } catch (error) {
        console.error('Error generating PDF with template, falling back to default:', error);
        await generateBillPDF(bill, pdfPath);
      }
    } else {
      // No template specified - use original bill format
      console.log('Generating PDF with original format (no template)');
      await generateBillPDF(bill, pdfPath);
    }

    // Set headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=bill-${bill.billNumber}.pdf`);

    // Stream the file
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

    // Clean up template-specific files after download (keep default)
    if (templateId) {
      fileStream.on('end', () => {
        setTimeout(() => {
          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
            console.log(`Cleaned up template-specific PDF: ${pdfPath}`);
          }
        }, 1000);
      });
    }

  } catch (error) {
    console.error('Download bill error:', error);
    req.flash('error', 'Failed to download bill');
    res.redirect(`/bills/${req.params.id}`);
  }
};

// Delete bill
exports.deleteBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      req.flash('error', 'Bill not found');
      return res.redirect('/bills');
    }

    // Update inventory before deleting the bill
    console.log('Updating inventory before deleting bill:', bill.billNumber);

    // Process each item in the bill
    for (const item of bill.items) {
      // Find the product
      const product = await Product.findById(item.product);

      if (product) {
        console.log(`Updating product ${product.name} for bill deletion`);

        // Restore quantity
        product.quantity += item.quantity;
        console.log(`Restored ${item.quantity} units to inventory, new quantity: ${product.quantity}`);

        // Decrease total sold
        product.totalSold -= item.quantity;
        product.totalSold = Math.max(0, product.totalSold); // Ensure not negative
        console.log(`Decreased total sold by ${item.quantity}, new total sold: ${product.totalSold}`);

        // Update financial tracking
        const itemTotal = item.price * item.quantity;

        if (bill.paidAmount >= bill.totalAmount) {
          // Fully paid bill - reduce from paid amount
          product.totalPaidAmount -= itemTotal;
          product.totalPaidAmount = Math.max(0, product.totalPaidAmount); // Ensure not negative
          console.log(`Decreased total paid amount by ${itemTotal}, new total paid: ${product.totalPaidAmount}`);
        } else if (bill.paidAmount <= 0) {
          // Fully credit bill - reduce from credit amount
          product.totalCreditAmount -= itemTotal;
          product.totalCreditAmount = Math.max(0, product.totalCreditAmount); // Ensure not negative
          console.log(`Decreased total credit amount by ${itemTotal}, new total credit: ${product.totalCreditAmount}`);
        } else {
          // Partially paid bill - reduce proportionally
          const paidRatio = bill.paidAmount / bill.totalAmount;
          const paidAmount = itemTotal * paidRatio;
          const creditAmount = itemTotal * (1 - paidRatio);

          product.totalPaidAmount -= paidAmount;
          product.totalCreditAmount -= creditAmount;

          // Ensure not negative
          product.totalPaidAmount = Math.max(0, product.totalPaidAmount);
          product.totalCreditAmount = Math.max(0, product.totalCreditAmount);

          console.log(`Decreased paid by ${paidAmount} and credit by ${creditAmount}`);
          console.log(`New totals - paid: ${product.totalPaidAmount}, credit: ${product.totalCreditAmount}`);
        }

        // Save the product
        await product.save();
      } else {
        console.log(`Product not found for item: ${item.name}`);
      }
    }

    // Delete the bill PDF if it exists
    const pdfPath = path.join(__dirname, '../public/bills', `bill-${bill._id}.pdf`);
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
      console.log(`Deleted PDF file: ${pdfPath}`);
    }

    // Delete the bill from the database
    await Bill.findByIdAndDelete(req.params.id);
    console.log(`Deleted bill ${bill.billNumber} from database`);

    req.flash('success', `Bill ${bill.billNumber} deleted successfully`);
    res.redirect('/bills');
  } catch (error) {
    console.error('Delete bill error:', error);
    req.flash('error', `Failed to delete bill: ${error.message}`);
    res.redirect('/bills');
  }
};

// Get bill edit form
exports.getEditBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      req.flash('error', 'Bill not found');
      return res.redirect('/bills');
    }

    // Get product categories
    const categories = ['Board', 'Chanel', 'Hardware', 'Bori'];

    res.render('bills/edit', {
      title: `Edit Bill ${bill.billNumber} - Kushi Decorators`,
      bill,
      categories,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get edit bill error:', error);
    req.flash('error', 'Failed to load bill edit page');
    res.redirect('/bills');
  }
};

// Update bill
exports.updateBill = async (req, res) => {
  try {
    // Find the bill with populated product references
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      req.flash('error', 'Bill not found');
      return res.redirect('/bills');
    }

    // Store the original paid amount and total amount for comparison later
    const originalPaidAmount = bill.paidAmount;
    const originalRemainingAmount = bill.remainingAmount;
    const originalTotalAmount = bill.totalAmount;

    // Extract form data
    const {
      customerName,
      customerPhone,
      customerPlace,
      customerEmail,
      work,
      pickedBy,
      paymentType,
      creditType,
      paidAmount,
      customPaidAmount,
      discountAmount,
      gstEnabled,
      gstType,
      gstPercentage,
      gstAmount,
      billDate,
      unknownCustomer
    } = req.body;

    // Validate input (skip customer validation for unknown customers)
    const isUnknownCustomer = unknownCustomer === 'on';

    if (!isUnknownCustomer) {
      if (!customerName || !customerPhone || !customerPlace || !work || !pickedBy) {
        req.flash('error', 'All customer fields are required');
        return res.redirect(`/bills/${req.params.id}/edit`);
      }
    }

    if (!paymentType) {
      req.flash('error', 'Payment type is required');
      return res.redirect(`/bills/${req.params.id}/edit`);
    }

    // Validate bill date
    if (billDate) {
      const selectedDate = new Date(billDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Set to end of today

      if (selectedDate > today) {
        req.flash('error', 'Bill date cannot be in the future');
        return res.redirect(`/bills/${req.params.id}/edit`);
      }
    }

    // Update customer information
    bill.customer.name = customerName;
    bill.customer.phone = customerPhone;
    bill.customer.place = customerPlace;
    bill.customer.email = customerEmail || '';
    bill.work = work;
    bill.pickedBy = pickedBy;
    bill.paymentType = paymentType;
    bill.isUnknown = unknownCustomer === 'on';

    // Update bill date if provided
    if (billDate) {
      bill.billDate = new Date(billDate);
    }

    // Handle GST
    const isGstEnabled = gstEnabled === 'on';
    bill.gstEnabled = isGstEnabled;

    if (isGstEnabled) {
      // Calculate subtotal if not already set
      if (!bill.subTotal) {
        let subtotal = 0;
        for (const item of bill.items) {
          subtotal += item.price * item.quantity;
        }
        bill.subTotal = subtotal;
      }

      // Set GST type and percentage
      bill.gstType = gstType || 'CGST+SGST 12%';

      // Extract percentage from GST type if not provided
      if (!gstPercentage) {
        const match = bill.gstType.match(/(\d+)%/);
        bill.gstPercentage = match ? parseInt(match[1]) : 12;
      } else {
        bill.gstPercentage = parseFloat(gstPercentage);
      }

      // Calculate GST amount
      bill.gstAmount = parseFloat(gstAmount) || (bill.subTotal * bill.gstPercentage / 100);

      // Update total amount with GST
      bill.totalAmount = bill.subTotal + bill.gstAmount;
    } else {
      // If GST is disabled, remove GST fields
      bill.gstType = undefined;
      bill.gstPercentage = undefined;
      bill.gstAmount = undefined;

      // Set total amount to subtotal or recalculate
      if (bill.subTotal) {
        bill.totalAmount = bill.subTotal;
      } else {
        let total = 0;
        for (const item of bill.items) {
          total += item.price * item.quantity;
        }
        bill.totalAmount = total;
      }
    }

    // Handle discount amount
    const parsedDiscountAmount = parseFloat(discountAmount) || 0;
    bill.discountAmount = parsedDiscountAmount;

    if (parsedDiscountAmount > 0) {
      // Validate discount doesn't exceed total
      if (parsedDiscountAmount > bill.totalAmount) {
        req.flash('error', `Discount amount (₹${parsedDiscountAmount}) cannot exceed the total amount (₹${bill.totalAmount.toFixed(2)})`);
        return res.redirect(`/bills/${req.params.id}/edit`);
      }

      // Apply discount to total amount
      bill.totalAmount = Math.max(0, bill.totalAmount - parsedDiscountAmount);
    }

    // Handle payment (only Cash is supported)
    let newPaidAmount = bill.totalAmount; // Default to full payment
    let newRemainingAmount = 0;

    if (paidAmount) {
      // Parse the paid amount
      const parsedAmount = parseFloat(paidAmount);

      // Validate the paid amount
      if (isNaN(parsedAmount)) {
        req.flash('error', 'Invalid paid amount. Please enter a valid number.');
        return res.redirect(`/bills/${req.params.id}/edit`);
      }

      // If paid amount exceeds new total (after discount), auto-adjust to full payment
      if (parsedAmount > bill.totalAmount) {
        console.log(`Auto-adjusting paid amount from ${parsedAmount} to ${bill.totalAmount} due to discount`);
        newPaidAmount = bill.totalAmount;
        newRemainingAmount = 0;
      } else {
        // Ensure paid amount doesn't exceed total (with generous tolerance for floating-point precision)
        if (!isAmountValid(parsedAmount, bill.totalAmount)) {
          req.flash('error', 'Paid amount cannot exceed the total amount');
          return res.redirect(`/bills/${req.params.id}/edit`);
        }

        newPaidAmount = parsedAmount;
        newRemainingAmount = bill.totalAmount - parsedAmount;
      }
    }

    // Check if payment status has changed
    const paymentStatusChanged = newPaidAmount !== originalPaidAmount;

    // Update bill payment fields
    bill.paidAmount = newPaidAmount;
    bill.remainingAmount = newRemainingAmount;

    // Log the payment data for debugging
    console.log('=== PAYMENT CALCULATION DEBUG ===');
    console.log('Original values:', {
      originalPaidAmount,
      originalRemainingAmount,
      originalTotalAmount
    });
    console.log('New values:', {
      newPaidAmount,
      newRemainingAmount,
      newTotalAmount: bill.totalAmount,
      discountAmount: bill.discountAmount
    });
    console.log('Payment status changed:', paymentStatusChanged);
    console.log('Calculation check:', {
      expectedRemaining: bill.totalAmount - newPaidAmount,
      actualRemaining: newRemainingAmount,
      isCorrect: (bill.totalAmount - newPaidAmount) === newRemainingAmount
    });

    // Clear any credit-related fields
    bill.creditType = undefined;
    bill.customPaidAmount = undefined;

    // Save the updated bill
    console.log('=== BEFORE SAVING BILL ===');
    console.log('Bill data to save:', {
      id: bill._id,
      totalAmount: bill.totalAmount,
      discountAmount: bill.discountAmount,
      paidAmount: bill.paidAmount,
      remainingAmount: bill.remainingAmount
    });

    await bill.save();

    console.log('=== AFTER SAVING BILL ===');
    console.log('Saved bill data:', {
      id: bill._id,
      totalAmount: bill.totalAmount,
      discountAmount: bill.discountAmount,
      paidAmount: bill.paidAmount,
      remainingAmount: bill.remainingAmount
    });

    // If payment status changed, update inventory records
    if (paymentStatusChanged) {
      console.log('Payment status changed, updating inventory records');

      // Process each item in the bill
      for (const item of bill.items) {
        // Find the product
        const product = await Product.findById(item.product);

        if (product) {
          const itemTotal = item.price * item.quantity;

          // Calculate the change in paid and credit amounts
          // Use originalTotalAmount for comparison to handle discount scenarios correctly
          if (originalPaidAmount < originalTotalAmount && newPaidAmount >= bill.totalAmount) {
            // Changed from partially paid to fully paid
            const originalPaidRatio = originalPaidAmount / originalTotalAmount;
            const originalCreditAmount = itemTotal * (1 - originalPaidRatio);

            // Move amount from credit to paid
            product.totalCreditAmount -= originalCreditAmount;
            product.totalPaidAmount += originalCreditAmount;

            console.log(`Product ${product.name}: Moved ${originalCreditAmount.toFixed(2)} from credit to paid`);
          }
          else if (originalPaidAmount >= originalTotalAmount && newPaidAmount < bill.totalAmount) {
            // Changed from fully paid to partially paid
            const newPaidRatio = newPaidAmount / bill.totalAmount;
            const newCreditAmount = itemTotal * (1 - newPaidRatio);

            // Move amount from paid to credit
            product.totalPaidAmount -= newCreditAmount;
            product.totalCreditAmount += newCreditAmount;

            console.log(`Product ${product.name}: Moved ${newCreditAmount.toFixed(2)} from paid to credit`);
          }
          else if (originalPaidAmount < originalTotalAmount && newPaidAmount < bill.totalAmount) {
            // Both partially paid, but amount changed
            const originalPaidRatio = originalPaidAmount / originalTotalAmount;
            const newPaidRatio = newPaidAmount / bill.totalAmount;

            const itemOriginalPaidAmount = itemTotal * originalPaidRatio;
            const itemOriginalCreditAmount = itemTotal * (1 - originalPaidRatio);

            const itemNewPaidAmount = itemTotal * newPaidRatio;
            const itemNewCreditAmount = itemTotal * (1 - newPaidRatio);

            // Update the amounts
            product.totalPaidAmount = product.totalPaidAmount - itemOriginalPaidAmount + itemNewPaidAmount;
            product.totalCreditAmount = product.totalCreditAmount - itemOriginalCreditAmount + itemNewCreditAmount;

            console.log(`Product ${product.name}: Updated paid/credit distribution`);
          }

          // Ensure no negative values
          product.totalPaidAmount = Math.max(0, product.totalPaidAmount);
          product.totalCreditAmount = Math.max(0, product.totalCreditAmount);

          // Save the product
          await product.save();
        }
      }
    }

    // Regenerate the PDF using original format (not template)
    const pdfPath = path.join(__dirname, '../public/bills', `bill-${bill._id}.pdf`);
    await generateBillPDF(bill, pdfPath);

    req.flash('success', `Bill ${bill.billNumber} updated successfully`);
    res.redirect(`/bills/${bill._id}`);
  } catch (error) {
    console.error('Update bill error:', error);
    req.flash('error', `Failed to update bill: ${error.message}`);
    res.redirect(`/bills/${req.params.id}/edit`);
  }
};

// Get customer purchase history (API)
exports.getCustomerPurchaseHistory = async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({ error: 'Customer phone number is required' });
    }

    // Find all bills for this customer
    const bills = await Bill.find({ 'customer.phone': phone })
      .sort({ createdAt: -1 })
      .select('_id billNumber items createdAt totalAmount');

    // Format the response
    const purchaseHistory = [];

    for (const bill of bills) {
      // Add each item from the bill
      for (const item of bill.items) {
        purchaseHistory.push({
          billId: bill._id,
          billNumber: bill.billNumber,
          billDate: bill.createdAt,
          productId: item.product,
          productName: item.name,
          category: item.category,
          price: item.price,
          quantity: item.quantity,
          totalPrice: item.price * item.quantity
        });
      }
    }

    res.json(purchaseHistory);
  } catch (error) {
    console.error('Get customer purchase history error:', error);
    res.status(500).json({ error: 'Failed to fetch customer purchase history' });
  }
};
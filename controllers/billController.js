const Bill = require('../models/Bill');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const ReturnBill = require('../models/ReturnBill');
const Admin = require('../models/Admin');
const { generateBillPDF } = require('../utils/pdfGenerator');
const { sendBillEmail, isValidEmailFormat } = require('../utils/emailService');
const fs = require('fs');
const path = require('path');

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
    const paymentType = req.body.paymentType;
    const creditType = req.body.creditType;
    const paidAmount = req.body.paidAmount;
    const customPaidAmount = req.body.customPaidAmount;

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
    const productIds = req.body['productIds[]'] || req.body.productIds;
    const quantities = req.body['quantities[]'] || req.body.quantities;

    // Validate input with detailed error messages
    const missingFields = [];

    if (!customerName) missingFields.push('Customer Name');
    if (!customerPhone) missingFields.push('Phone Number');
    if (!customerPlace) missingFields.push('Place');
    if (!work) missingFields.push('Work');
    if (!pickedBy) missingFields.push('Picked By');
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
    const products = await Product.find({ _id: { $in: validProductIds } });

    if (products.length !== validProductIds.length) {
      req.flash('error', 'Some products were not found');
      return res.redirect('/bills/create');
    }

    // Create items array
    const items = [];
    let totalAmount = 0;
    const productUpdates = [];

    for (let i = 0; i < validProductIds.length; i++) {
      const product = products.find(p => p._id.toString() === validProductIds[i]);
      const quantity = parseInt(validQuantities[i]);

      if (product && quantity > 0) {
        // Check if there's enough quantity in stock
        if (product.quantity < quantity) {
          req.flash('error', `Not enough stock for ${product.name}. Available: ${product.quantity}, Requested: ${quantity}`);
          return res.redirect('/bills/create');
        }

        const itemAmount = product.price * quantity;
        totalAmount += itemAmount;

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

    // Ensure we have at least one valid item
    if (items.length === 0) {
      req.flash('error', 'No valid products were found. Please try again.');
      return res.redirect('/bills/create');
    }

    // Create or update customer
    let customer = await Customer.findOne({ phone: customerPhone });

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

    // Calculate GST amount if enabled
    let calculatedGstAmount = 0;
    let finalTotalAmount = totalAmount;

    if (gstEnabled) {
      // Use the GST amount from the form or calculate it
      if (gstType && gstPercentage > 0) {
        calculatedGstAmount = gstAmount || (totalAmount * gstPercentage / 100);
      } else {
        // Default to 12% if no GST type or percentage is provided
        calculatedGstAmount = totalAmount * 0.12;
      }

      // Add GST amount to total
      finalTotalAmount = totalAmount + calculatedGstAmount;
      console.log('GST calculation:', {
        subtotal: totalAmount,
        gstAmount: calculatedGstAmount,
        totalWithGst: finalTotalAmount
      });
    }

    // Prepare bill data
    const billData = {
      customer: {
        name: customerName,
        phone: customerPhone,
        place: customerPlace,
        email: customerEmail
      },
      work,
      pickedBy,
      items,
      subTotal: totalAmount,
      gstEnabled,
      totalAmount: finalTotalAmount,
      paymentType
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

      // Validate the paid amount
      if (isNaN(parsedAmount)) {
        req.flash('error', 'Invalid paid amount. Please enter a valid number.');
        return res.redirect('/bills/create');
      }

      // Ensure paid amount doesn't exceed total
      if (parsedAmount > finalTotalAmount) {
        req.flash('error', 'Paid amount cannot exceed the total amount');
        return res.redirect('/bills/create');
      }

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

    // Create bill
    const bill = await Bill.create(billData);

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

// Get bill details
exports.getBillDetails = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id).populate('items.product');

    if (!bill) {
      req.flash('error', 'Bill not found');
      return res.redirect('/bills');
    }

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

    const pdfPath = path.join(__dirname, '../public/bills', `bill-${bill._id}.pdf`);

    // Check if PDF exists
    if (!fs.existsSync(pdfPath)) {
      // Generate PDF if it doesn't exist
      await generateBillPDF(bill, pdfPath);
    }

    // Set headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=bill-${bill.billNumber}.pdf`);

    // Stream the file
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
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

    // Store the original paid amount for comparison later
    const originalPaidAmount = bill.paidAmount;
    const originalRemainingAmount = bill.remainingAmount;

    // Extract form data
    const {
      customerName,
      customerPhone,
      customerPlace,
      work,
      pickedBy,
      paymentType,
      creditType,
      paidAmount,
      customPaidAmount,
      gstEnabled,
      gstType,
      gstPercentage,
      gstAmount
    } = req.body;

    // Validate input
    if (!customerName || !customerPhone || !customerPlace || !work || !pickedBy || !paymentType) {
      req.flash('error', 'All fields are required');
      return res.redirect(`/bills/${req.params.id}/edit`);
    }

    // Update customer information
    bill.customer.name = customerName;
    bill.customer.phone = customerPhone;
    bill.customer.place = customerPlace;
    bill.work = work;
    bill.pickedBy = pickedBy;
    bill.paymentType = paymentType;

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

      // Ensure paid amount doesn't exceed total
      if (parsedAmount > bill.totalAmount) {
        req.flash('error', 'Paid amount cannot exceed the total amount');
        return res.redirect(`/bills/${req.params.id}/edit`);
      }

      newPaidAmount = parsedAmount;
      newRemainingAmount = bill.totalAmount - parsedAmount;
    }

    // Check if payment status has changed
    const paymentStatusChanged = newPaidAmount !== originalPaidAmount;

    // Update bill payment fields
    bill.paidAmount = newPaidAmount;
    bill.remainingAmount = newRemainingAmount;

    // Log the payment data for debugging
    console.log('Payment data (update):', {
      originalPaidAmount,
      originalRemainingAmount,
      newPaidAmount,
      newRemainingAmount,
      paymentStatusChanged
    });

    // Clear any credit-related fields
    bill.creditType = undefined;
    bill.customPaidAmount = undefined;

    // Save the updated bill
    await bill.save();

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
          if (originalPaidAmount < bill.totalAmount && newPaidAmount >= bill.totalAmount) {
            // Changed from partially paid to fully paid
            const originalPaidRatio = originalPaidAmount / bill.totalAmount;
            const originalCreditAmount = itemTotal * (1 - originalPaidRatio);

            // Move amount from credit to paid
            product.totalCreditAmount -= originalCreditAmount;
            product.totalPaidAmount += originalCreditAmount;

            console.log(`Product ${product.name}: Moved ${originalCreditAmount.toFixed(2)} from credit to paid`);
          }
          else if (originalPaidAmount >= bill.totalAmount && newPaidAmount < bill.totalAmount) {
            // Changed from fully paid to partially paid
            const newPaidRatio = newPaidAmount / bill.totalAmount;
            const newCreditAmount = itemTotal * (1 - newPaidRatio);

            // Move amount from paid to credit
            product.totalPaidAmount -= newCreditAmount;
            product.totalCreditAmount += newCreditAmount;

            console.log(`Product ${product.name}: Moved ${newCreditAmount.toFixed(2)} from paid to credit`);
          }
          else if (originalPaidAmount < bill.totalAmount && newPaidAmount < bill.totalAmount) {
            // Both partially paid, but amount changed
            const originalPaidRatio = originalPaidAmount / bill.totalAmount;
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

    // Regenerate the PDF
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
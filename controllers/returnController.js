const ReturnBill = require('../models/ReturnBill');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Bill = require('../models/Bill');
const { generateReturnBillPDF } = require('../utils/pdfGenerator');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Get return management dashboard
exports.getReturnManagement = async (req, res) => {
  try {
    // Get all pending return bills
    const returnBills = await ReturnBill.find().sort({ createdAt: -1 });

    res.render('returns/dashboard', {
      title: 'Return Management - Kushi Trader',
      returnBills,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get return management error:', error);
    req.flash('error', 'Failed to load return management dashboard');
    res.redirect('/dashboard');
  }
};

// Get bill selection page for return creation
exports.getSelectBill = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Build query based on search parameters
    let query = {};
    let searchQuery = '';

    if (req.query.phone) {
      query['customer.phone'] = req.query.phone;
      searchQuery = `phone=${req.query.phone}`;
    }

    if (req.query.billNumber) {
      query.billNumber = new RegExp(req.query.billNumber, 'i');
      searchQuery = `billNumber=${req.query.billNumber}`;
    }

    // Get total count for pagination
    const totalBills = await Bill.countDocuments(query);
    const totalPages = Math.ceil(totalBills / limit);

    // Get bills with pagination
    const bills = await Bill.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Check which bills already have returns
    const billIds = bills.map(bill => bill._id);
    const returnBills = await ReturnBill.find({ originalBill: { $in: billIds } });

    // Create a map of bill IDs to return bills
    const returnBillMap = {};
    returnBills.forEach(returnBill => {
      returnBillMap[returnBill.originalBill.toString()] = returnBill;
    });

    res.render('returns/select-bill', {
      title: 'Select Bill for Return - Kushi Trader',
      bills,
      returnBillMap,
      currentPage: page,
      totalPages,
      searchQuery,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get select bill error:', error);
    req.flash('error', 'Failed to load bill selection page');
    res.redirect('/returns');
  }
};

// Get return bill creation form
exports.getCreateReturnBill = async (req, res) => {
  try {
    // Get product categories
    const categories = ['Board', 'Chanel', 'Hardware', 'Bori'];

    // Check if we're creating a return from an existing bill
    let originalBill = null;
    let customer = null;

    if (req.query.billId) {
      // Fetch the original bill
      originalBill = await Bill.findById(req.query.billId);

      if (!originalBill) {
        req.flash('error', 'Original bill not found');
        return res.redirect('/returns/select-bill');
      }

      // Check if a return bill already exists for this original bill
      const existingReturnBill = await ReturnBill.findOne({ originalBill: req.query.billId });

      if (existingReturnBill) {
        req.flash('error', `A return bill (#${existingReturnBill.returnNumber}) already exists for this bill. You cannot create multiple returns for the same bill.`);
        return res.redirect(`/returns/${existingReturnBill._id}`);
      }

      // Get customer information
      if (originalBill.customer && originalBill.customer.phone) {
        customer = await Customer.findOne({ phone: originalBill.customer.phone });
      }
    } else {
      // If no bill ID is provided, redirect to bill selection page
      req.flash('info', 'Please select a bill to create a return');
      return res.redirect('/returns/select-bill');
    }

    res.render('returns/create', {
      title: 'Create Return Bill - Kushi Trader',
      categories,
      originalBill,
      customer,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get create return bill error:', error);
    req.flash('error', 'Failed to load return bill creation page');
    res.redirect('/returns/select-bill');
  }
};

// Create new return bill
exports.postCreateReturnBill = async (req, res) => {
  try {
    // Extract form data
    const customerName = req.body.customerName;
    const customerPhone = req.body.customerPhone;
    const customerPlace = req.body.customerPlace;
    const reason = req.body.reason;
    const pickedBy = req.body.pickedBy;
    const originalBillId = req.body.originalBillId;
    const originalBillNumber = req.body.originalBillNumber;

    // Validate original bill information
    if (!originalBillId || !originalBillNumber) {
      req.flash('error', 'Original bill information is required');
      return res.redirect('/returns/select-bill');
    }

    // Check if a return bill already exists for this original bill
    const existingReturnBill = await ReturnBill.findOne({ originalBill: originalBillId });

    if (existingReturnBill) {
      req.flash('error', `A return bill (#${existingReturnBill.returnNumber}) already exists for this bill. You cannot create multiple returns for the same bill.`);
      return res.redirect(`/returns/${existingReturnBill._id}`);
    }

    // Handle array fields that might have square brackets in their names
    const productIds = req.body['productIds[]'] || req.body.productIds;
    const quantities = req.body['quantities[]'] || req.body.quantities;
    const originalBillIds = req.body['originalBillIds[]'] || req.body.originalBillIds;
    const originalBillNumbers = req.body['originalBillNumbers[]'] || req.body.originalBillNumbers;

    // Validate input with detailed error messages
    const missingFields = [];

    if (!customerName) missingFields.push('Customer Name');
    if (!customerPhone) missingFields.push('Phone Number');
    if (!customerPlace) missingFields.push('Place');
    if (!reason) missingFields.push('Return Reason');
    if (!pickedBy) missingFields.push('Picked By');

    // Check if productIds and quantities exist in any form (array or single value)
    const hasProductIds = productIds !== undefined && productIds !== null && productIds !== '';
    const hasQuantities = quantities !== undefined && quantities !== null && quantities !== '';

    if (!hasProductIds) missingFields.push('Products');
    if (!hasQuantities) missingFields.push('Quantities');

    if (missingFields.length > 0) {
      req.flash('error', `Missing required fields: ${missingFields.join(', ')}`);
      return res.redirect('/returns/create');
    }

    // Convert productIds and quantities to arrays if they're not already
    let productIdArray = [];
    let quantityArray = [];
    let originalBillIdArray = [];
    let originalBillNumberArray = [];

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

    if (Array.isArray(originalBillIds)) {
      originalBillIdArray = originalBillIds;
    } else if (originalBillIds) {
      originalBillIdArray = [originalBillIds];
    }

    if (Array.isArray(originalBillNumbers)) {
      originalBillNumberArray = originalBillNumbers;
    } else if (originalBillNumbers) {
      originalBillNumberArray = [originalBillNumbers];
    }

    // Validate products and quantities
    if (productIdArray.length === 0) {
      req.flash('error', 'Please add at least one product');
      return res.redirect('/returns/create');
    }

    if (quantityArray.length === 0) {
      req.flash('error', 'Please specify quantities for products');
      return res.redirect('/returns/create');
    }

    if (productIdArray.length !== quantityArray.length) {
      req.flash('error', 'Product and quantity counts do not match. Please try again.');
      return res.redirect('/returns/create');
    }

    // Filter out any empty product IDs
    const validProductIds = productIdArray.filter(id => id && id.trim() !== '');
    const validQuantities = [];

    // Match quantities and bill info to valid product IDs
    const validOriginalBillIds = [];
    const validOriginalBillNumbers = [];

    for (let i = 0; i < productIdArray.length; i++) {
      if (productIdArray[i] && productIdArray[i].trim() !== '') {
        validQuantities.push(quantityArray[i]);

        // Add original bill info if available
        if (originalBillIdArray[i]) {
          validOriginalBillIds.push(originalBillIdArray[i]);
        } else {
          validOriginalBillIds.push(null);
        }

        if (originalBillNumberArray[i]) {
          validOriginalBillNumbers.push(originalBillNumberArray[i]);
        } else {
          validOriginalBillNumbers.push(null);
        }
      }
    }

    // Check if we have any valid products
    if (validProductIds.length === 0) {
      req.flash('error', 'Please select at least one product');
      return res.redirect('/returns/create');
    }

    // Get products from database using valid product IDs
    const products = await Product.find({ _id: { $in: validProductIds } });

    if (products.length !== validProductIds.length) {
      req.flash('error', 'Some products were not found');
      return res.redirect('/returns/create');
    }

    // Create items array
    const items = [];

    for (let i = 0; i < validProductIds.length; i++) {
      const product = products.find(p => p._id.toString() === validProductIds[i]);
      const quantity = parseInt(validQuantities[i]);

      if (product && quantity > 0) {
        items.push({
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: quantity,
          category: product.category,
          originalBill: validOriginalBillIds[i] || null,
          originalBillNumber: validOriginalBillNumbers[i] || null
        });
      }
    }

    // Ensure we have at least one valid item
    if (items.length === 0) {
      req.flash('error', 'No valid products were found. Please try again.');
      return res.redirect('/returns/create');
    }

    // Create or update customer
    let customer = await Customer.findOne({ phone: customerPhone });

    if (!customer) {
      customer = await Customer.create({
        name: customerName,
        phone: customerPhone,
        place: customerPlace
      });
    } else {
      // Update customer details if they've changed
      if (customer.name !== customerName || customer.place !== customerPlace) {
        customer.name = customerName;
        customer.place = customerPlace;
        await customer.save();
      }
    }

    // Prepare return bill data
    const returnBillData = {
      originalBill: originalBillId,
      originalBillNumber: originalBillNumber,
      customer: {
        name: customerName,
        phone: customerPhone,
        place: customerPlace
      },
      reason,
      pickedBy,
      items,
      status: 'Pending'
    };

    // Create return bill
    const returnBill = await ReturnBill.create(returnBillData);

    // Generate PDF
    const pdfDir = path.join(__dirname, '../public/returns');

    // Create directory if it doesn't exist
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const pdfPath = path.join(pdfDir, `return-${returnBill._id}.pdf`);
    await generateReturnBillPDF(returnBill, pdfPath);

    req.flash('success', 'Return bill created successfully');
    res.redirect(`/returns/${returnBill._id}`);
  } catch (error) {
    console.error('Create return bill error:', error);

    // Provide more specific error messages based on the error type
    if (error.name === 'ValidationError') {
      // Mongoose validation error
      const validationErrors = Object.values(error.errors).map(err => err.message);
      req.flash('error', `Validation error: ${validationErrors.join(', ')}`);
    } else {
      // Generic error
      req.flash('error', `Failed to create return bill: ${error.message}`);
    }

    res.redirect('/returns/create');
  }
};

// Get return bill details
exports.getReturnBillDetails = async (req, res) => {
  try {
    const returnBill = await ReturnBill.findById(req.params.id).populate('items.product');

    if (!returnBill) {
      req.flash('error', 'Return bill not found');
      return res.redirect('/returns');
    }

    res.render('returns/details', {
      title: `Return ${returnBill.returnNumber} - Kushi Trader`,
      returnBill,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get return bill details error:', error);
    req.flash('error', 'Failed to fetch return bill details');
    res.redirect('/returns');
  }
};

// Download return bill PDF
exports.downloadReturnBill = async (req, res) => {
  try {
    const returnBill = await ReturnBill.findById(req.params.id);

    if (!returnBill) {
      req.flash('error', 'Return bill not found');
      return res.redirect('/returns');
    }

    const pdfPath = path.join(__dirname, '../public/returns', `return-${returnBill._id}.pdf`);

    // Check if PDF exists
    if (!fs.existsSync(pdfPath)) {
      // Generate PDF if it doesn't exist
      await generateReturnBillPDF(returnBill, pdfPath);
    }

    // Set headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=return-${returnBill.returnNumber}.pdf`);

    // Stream the file
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download return bill error:', error);
    req.flash('error', 'Failed to download return bill');
    res.redirect(`/returns/${req.params.id}`);
  }
};

// Get return bill edit form
exports.getEditReturnBill = async (req, res) => {
  try {
    const returnBill = await ReturnBill.findById(req.params.id);

    if (!returnBill) {
      req.flash('error', 'Return bill not found');
      return res.redirect('/returns');
    }

    // Get product categories
    const categories = ['Board', 'Chanel', 'Hardware', 'Bori'];

    res.render('returns/edit', {
      title: `Edit Return ${returnBill.returnNumber} - Kushi Trader`,
      returnBill,
      categories,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get edit return bill error:', error);
    req.flash('error', 'Failed to load return bill edit page');
    res.redirect('/returns');
  }
};

// Update return bill
exports.updateReturnBill = async (req, res) => {
  try {
    // Find the return bill
    const returnBill = await ReturnBill.findById(req.params.id);

    if (!returnBill) {
      req.flash('error', 'Return bill not found');
      return res.redirect('/returns');
    }

    // Extract form data
    const {
      customerName,
      customerPhone,
      customerPlace,
      reason,
      pickedBy,
      status,
      resolution,
      resolutionNotes
    } = req.body;

    // Validate input
    if (!customerName || !customerPhone || !customerPlace || !reason || !pickedBy) {
      req.flash('error', 'All fields are required');
      return res.redirect(`/returns/${req.params.id}/edit`);
    }

    // Update customer information
    returnBill.customer.name = customerName;
    returnBill.customer.phone = customerPhone;
    returnBill.customer.place = customerPlace;
    returnBill.reason = reason;
    returnBill.pickedBy = pickedBy;

    // Update status and resolution if provided
    if (status) {
      const oldStatus = returnBill.status;
      returnBill.status = status;

      // If status changed to Resolved, set resolvedAt date
      if (oldStatus !== 'Resolved' && status === 'Resolved') {
        returnBill.resolvedAt = new Date();
      }

      // If resolution is provided, update it
      if (resolution) {
        returnBill.resolution = resolution;
      }

      // If resolution notes are provided, update them
      if (resolutionNotes) {
        returnBill.resolutionNotes = resolutionNotes;
      }

      // If status is Resolved and resolution is "Re-added to Inventory", update inventory
      if (status === 'Resolved' && resolution === 'Re-added to Inventory') {
        // Process each item in the return bill
        for (const item of returnBill.items) {
          // Find the product
          const product = await Product.findById(item.product);

          if (product) {
            // Add quantity back to inventory
            product.quantity += item.quantity;
            await product.save();
          }
        }
      }
    }

    // Save the updated return bill
    await returnBill.save();

    // Regenerate the PDF
    const pdfPath = path.join(__dirname, '../public/returns', `return-${returnBill._id}.pdf`);
    await generateReturnBillPDF(returnBill, pdfPath);

    req.flash('success', `Return bill ${returnBill.returnNumber} updated successfully`);
    res.redirect(`/returns/${returnBill._id}`);
  } catch (error) {
    console.error('Update return bill error:', error);
    req.flash('error', `Failed to update return bill: ${error.message}`);
    res.redirect(`/returns/${req.params.id}/edit`);
  }
};

// Delete return bill
exports.deleteReturnBill = async (req, res) => {
  try {
    const returnBill = await ReturnBill.findById(req.params.id);

    if (!returnBill) {
      req.flash('error', 'Return bill not found');
      return res.redirect('/returns');
    }

    // Delete the return bill PDF if it exists
    const pdfPath = path.join(__dirname, '../public/returns', `return-${returnBill._id}.pdf`);
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    // Delete the return bill from the database
    await ReturnBill.findByIdAndDelete(req.params.id);

    req.flash('success', `Return bill ${returnBill.returnNumber} deleted successfully`);
    res.redirect('/returns');
  } catch (error) {
    console.error('Delete return bill error:', error);
    req.flash('error', `Failed to delete return bill: ${error.message}`);
    res.redirect('/returns');
  }
};

// Get return statistics
exports.getReturnStatistics = async (req, res) => {
  try {
    // Get statistics data
    const stats = await getStatisticsData();

    res.render('returns/statistics', {
      title: 'Return Statistics - Kushi Trader',
      stats,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get return statistics error:', error);
    req.flash('error', 'Failed to load return statistics');
    res.redirect('/returns');
  }
};

// API endpoint for return statistics
exports.getReturnStatisticsAPI = async (req, res) => {
  try {
    const period = req.query.period || 'allTime';
    const stats = await getStatisticsData(period);
    res.json(stats);
  } catch (error) {
    console.error('Get return statistics API error:', error);
    res.status(500).json({ error: 'Failed to fetch return statistics' });
  }
};

// Helper function to get statistics data
async function getStatisticsData(period = 'allTime') {
  // Set date filter based on period
  let dateFilter = {};
  const now = new Date();

  if (period === 'thisMonth') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    dateFilter = { createdAt: { $gte: startOfMonth } };
  } else if (period === 'lastMonth') {
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    dateFilter = { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } };
  } else if (period === 'thisYear') {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    dateFilter = { createdAt: { $gte: startOfYear } };
  }

  // Get total returns
  const totalReturns = await ReturnBill.countDocuments(dateFilter);

  // Get pending returns
  const pendingReturns = await ReturnBill.countDocuments({ ...dateFilter, status: 'Pending' });

  // Get resolved returns
  const resolvedReturns = await ReturnBill.countDocuments({ ...dateFilter, status: 'Resolved' });

  // Calculate resolution rate
  const resolutionRate = totalReturns > 0 ? Math.round((resolvedReturns / totalReturns) * 100) : 0;

  // Get resolution types
  const resolutionTypes = await ReturnBill.aggregate([
    { $match: { ...dateFilter, status: 'Resolved' } },
    { $group: { _id: '$resolution', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Add pending to resolution types if there are pending returns
  if (pendingReturns > 0) {
    resolutionTypes.push({ _id: 'Pending', count: pendingReturns });
  }

  // Get returns by category
  const categoryCounts = await ReturnBill.aggregate([
    { $match: dateFilter },
    { $unwind: '$items' },
    { $group: { _id: '$items.category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Get monthly returns
  const monthlyReturns = await ReturnBill.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Get top returned products
  const topReturnedProducts = await ReturnBill.aggregate([
    { $match: dateFilter },
    { $unwind: '$items' },
    {
      $group: {
        _id: { name: '$items.name', category: '$items.category' },
        count: { $sum: 1 },
        totalQuantity: { $sum: '$items.quantity' }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 }
  ]);

  return {
    totalReturns,
    pendingReturns,
    resolvedReturns,
    resolutionRate,
    resolutionTypes,
    categoryCounts,
    monthlyReturns,
    topReturnedProducts
  };
}

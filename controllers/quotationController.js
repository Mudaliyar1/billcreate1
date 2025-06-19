const Quotation = require('../models/Quotation');
const QuotationProduct = require('../models/QuotationProduct');
const Customer = require('../models/Customer');
const GstRate = require('../models/GstRate');
const { generateQuotationPDF } = require('../utils/pdfGenerator');
const path = require('path');
const fs = require('fs');

// Utility function to round amounts to 2 decimal places
function roundAmount(amount) {
  return Math.round(amount * 100) / 100;
}

// Get quotation creation form
exports.getCreateQuotation = async (req, res) => {
  try {
    // Get product categories
    const categories = ['Board', 'Chanel', 'Hardware', 'Bori'];

    res.render('quotations/create', {
      title: 'Create Quotation - Kushi Decorators',
      categories,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get create quotation error:', error);
    req.flash('error', 'Failed to load quotation creation page');
    res.redirect('/dashboard');
  }
};

// Create new quotation
exports.postCreateQuotation = async (req, res) => {
  try {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Extract form data
    const customerName = req.body.customerName;
    const customerPhone = req.body.customerPhone;
    const customerPlace = req.body.customerPlace;
    const customerEmail = req.body.customerEmail;
    const unknownCustomer = req.body.unknownCustomer === 'on';
    const discountAmount = req.body.discountAmount;
    const gstEnabled = req.body.gstEnabled === 'on';
    const gstType = req.body.gstType;
    const gstPercentage = req.body.gstPercentage;
    const quotationDate = req.body.quotationDate;
    const validUntil = req.body.validUntil;

    // Product data - handle both array notation and regular field names
    let productIds = req.body['productIds[]'] || req.body.productIds;
    let quantities = req.body['quantities[]'] || req.body.quantities;
    let feet = req.body['feet[]'] || req.body.feet;
    let runningFeet = req.body['runningFeet[]'] || req.body.runningFeet;
    let unitTypes = req.body['unitTypes[]'] || req.body.unitTypes;

    console.log('Product data extracted:');
    console.log('productIds:', productIds);
    console.log('quantities:', quantities);
    console.log('feet:', feet);
    console.log('runningFeet:', runningFeet);
    console.log('unitTypes:', unitTypes);

    // Validation
    if (!unknownCustomer) {
      if (!customerName || !customerPhone || !customerPlace) {
        req.flash('error', 'Customer name, phone, and place are required');
        return res.redirect('/quotations/create');
      }
    }

    // Validate quotation date
    if (quotationDate) {
      const selectedDate = new Date(quotationDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (selectedDate > today) {
        req.flash('error', 'Quotation date cannot be in the future');
        return res.redirect('/quotations/create');
      }
    }

    // Convert arrays
    let productIdArray = [];
    let quantityArray = [];
    let feetArray = [];
    let runningFeetArray = [];
    let unitTypeArray = [];

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

    if (Array.isArray(feet)) {
      feetArray = feet;
    } else if (feet) {
      feetArray = [feet];
    }

    if (Array.isArray(runningFeet)) {
      runningFeetArray = runningFeet;
    } else if (runningFeet) {
      runningFeetArray = [runningFeet];
    }

    if (Array.isArray(unitTypes)) {
      unitTypeArray = unitTypes;
    } else if (unitTypes) {
      unitTypeArray = [unitTypes];
    }

    console.log('Converted arrays:');
    console.log('productIdArray:', productIdArray);
    console.log('quantityArray:', quantityArray);
    console.log('feetArray:', feetArray);
    console.log('runningFeetArray:', runningFeetArray);
    console.log('unitTypeArray:', unitTypeArray);

    console.log('Checking product array length:', productIdArray.length);
    if (productIdArray.length === 0) {
      console.log('No products found, redirecting with error');
      req.flash('error', 'At least one product must be selected');
      return res.redirect('/quotations/create');
    }

    // Process products and calculate amounts
    const items = [];
    let totalAmount = 0;

    for (let i = 0; i < productIdArray.length; i++) {
      const productId = productIdArray[i];
      const quantity = parseInt(quantityArray[i]) || 1;
      const ftValue = parseFloat(feetArray[i]) || 0;
      const rftValue = parseFloat(runningFeetArray[i]) || 0;
      const unitType = unitTypeArray[i] || 'piece';

      if (!productId) continue;

      const product = await QuotationProduct.findById(productId);
      if (!product) {
        req.flash('error', `Product not found for ID: ${productId}`);
        return res.redirect('/quotations/create');
      }

      let itemPrice = 0;
      let itemQuantity = quantity;

      // Calculate price based on unit type
      switch (unitType) {
        case 'ft':
          itemPrice = product.pricePerFt * ftValue;
          itemQuantity = ftValue;
          break;
        case 'rft':
          itemPrice = product.pricePerRft * rftValue;
          itemQuantity = rftValue;
          break;
        default: // piece
          itemPrice = product.price * quantity;
          itemQuantity = quantity;
          break;
      }

      const item = {
        product: productId,
        name: product.name,
        price: itemPrice,
        quantity: itemQuantity,
        feet: ftValue,
        runningFeet: rftValue,
        unitType: unitType,
        category: product.category
      };

      items.push(item);
      totalAmount += itemPrice;
    }

    // Handle GST
    let gstAmount = 0;
    if (gstEnabled && gstPercentage) {
      const gstPercent = parseFloat(gstPercentage);
      if (gstType === 'CGST+SGST') {
        gstAmount = (totalAmount * gstPercent) / 100;
      } else if (gstType === 'IGST') {
        gstAmount = (totalAmount * gstPercent) / 100;
      }
      totalAmount += gstAmount;
    }

    // Apply discount
    const finalTotalAmount = totalAmount - (parseFloat(discountAmount) || 0);

    // Prepare quotation data
    const quotationData = {
      isUnknown: unknownCustomer,
      customer: {
        name: unknownCustomer ? 'Unknown' : customerName,
        phone: unknownCustomer ? 'Unknown' : customerPhone,
        place: unknownCustomer ? 'Unknown' : customerPlace,
        email: unknownCustomer ? '' : (customerEmail || '')
      },
      items,
      subTotal: totalAmount,
      gstEnabled,
      discountAmount: parseFloat(discountAmount) || 0,
      totalAmount: finalTotalAmount,
      quotationDate: quotationDate ? new Date(quotationDate) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : undefined
    };

    if (gstEnabled) {
      quotationData.gstType = gstType;
      quotationData.gstPercentage = parseFloat(gstPercentage);
      quotationData.gstAmount = gstAmount;
    }

    console.log('Creating quotation with data:', JSON.stringify(quotationData, null, 2));

    // Create quotation
    const quotation = await Quotation.create(quotationData);

    console.log('Quotation created:', quotation._id);

    // Generate PDF
    const pdfDir = path.join(__dirname, '../public/quotations');

    // Create directory if it doesn't exist
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const pdfPath = path.join(pdfDir, `quotation-${quotation._id}.pdf`);
    await generateQuotationPDF(quotation, pdfPath);

    // Save customer if not unknown and doesn't exist
    if (!unknownCustomer && customerPhone && customerPhone !== 'Unknown') {
      try {
        const existingCustomer = await Customer.findOne({ phone: customerPhone });
        if (!existingCustomer) {
          await Customer.create({
            name: customerName,
            phone: customerPhone,
            place: customerPlace,
            email: customerEmail || ''
          });
          console.log('New customer saved');
        }
      } catch (customerError) {
        console.error('Error saving customer:', customerError);
      }
    }

    req.flash('success', 'Quotation created successfully');
    res.redirect(`/quotations/${quotation._id}`);
  } catch (error) {
    console.error('Create quotation error:', error);
    req.flash('error', `Failed to create quotation: ${error.message}`);
    res.redirect('/quotations/create');
  }
};

// Get all quotations
exports.getQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find().sort({ createdAt: -1 });

    res.render('quotations/list', {
      title: 'Quotations - Kushi Decorators',
      quotations,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get quotations error:', error);
    req.flash('error', 'Failed to fetch quotations');
    res.redirect('/dashboard');
  }
};

// Get quotation details
exports.getQuotationDetails = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id).populate('items.product');

    if (!quotation) {
      req.flash('error', 'Quotation not found');
      return res.redirect('/quotations');
    }

    res.render('quotations/details', {
      title: `Quotation ${quotation.quotationNumber} - Kushi Decorators`,
      quotation,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get quotation details error:', error);
    req.flash('error', 'Failed to fetch quotation details');
    res.redirect('/quotations');
  }
};

// Get quotation edit form
exports.getEditQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      req.flash('error', 'Quotation not found');
      return res.redirect('/quotations');
    }

    // Get product categories
    const categories = ['Board', 'Chanel', 'Hardware', 'Bori'];

    res.render('quotations/edit', {
      title: `Edit Quotation ${quotation.quotationNumber} - Kushi Decorators`,
      quotation,
      categories,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get edit quotation error:', error);
    req.flash('error', 'Failed to load quotation edit page');
    res.redirect('/quotations');
  }
};

// Update quotation
exports.updateQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      req.flash('error', 'Quotation not found');
      return res.redirect('/quotations');
    }

    // Extract form data
    const {
      customerName,
      customerPhone,
      customerPlace,
      customerEmail,
      discountAmount,
      gstEnabled,
      gstType,
      gstPercentage,
      quotationDate,
      validUntil,
      status,
      unknownCustomer
    } = req.body;

    // Update customer information
    quotation.customer.name = customerName;
    quotation.customer.phone = customerPhone;
    quotation.customer.place = customerPlace;
    quotation.customer.email = customerEmail || '';
    quotation.isUnknown = unknownCustomer === 'on';

    // Update quotation date if provided
    if (quotationDate) {
      quotation.quotationDate = new Date(quotationDate);
    }

    // Update valid until date if provided
    if (validUntil) {
      quotation.validUntil = new Date(validUntil);
    }

    // Update status if provided
    if (status) {
      quotation.status = status;
    }

    // Handle GST
    const isGstEnabled = gstEnabled === 'on';
    quotation.gstEnabled = isGstEnabled;

    if (isGstEnabled) {
      quotation.gstType = gstType;
      quotation.gstPercentage = parseFloat(gstPercentage);

      // Recalculate GST amount
      const gstPercent = parseFloat(gstPercentage);
      quotation.gstAmount = (quotation.subTotal * gstPercent) / 100;
      quotation.totalAmount = quotation.subTotal + quotation.gstAmount;
    } else {
      quotation.gstType = undefined;
      quotation.gstPercentage = undefined;
      quotation.gstAmount = 0;
      quotation.totalAmount = quotation.subTotal;
    }

    // Handle discount amount
    const parsedDiscountAmount = parseFloat(discountAmount) || 0;
    quotation.discountAmount = parsedDiscountAmount;

    if (parsedDiscountAmount > 0) {
      quotation.totalAmount = Math.max(0, quotation.totalAmount - parsedDiscountAmount);
    }

    await quotation.save();

    // Regenerate the PDF
    const pdfPath = path.join(__dirname, '../public/quotations', `quotation-${quotation._id}.pdf`);
    await generateQuotationPDF(quotation, pdfPath);

    req.flash('success', `Quotation ${quotation.quotationNumber} updated successfully`);
    res.redirect(`/quotations/${quotation._id}`);
  } catch (error) {
    console.error('Update quotation error:', error);
    req.flash('error', `Failed to update quotation: ${error.message}`);
    res.redirect(`/quotations/${req.params.id}/edit`);
  }
};

// Download quotation PDF
exports.downloadQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      req.flash('error', 'Quotation not found');
      return res.redirect('/quotations');
    }

    const pdfPath = path.join(__dirname, '../public/quotations', `quotation-${quotation._id}.pdf`);

    // Check if PDF exists
    if (!fs.existsSync(pdfPath)) {
      // Generate PDF if it doesn't exist
      await generateQuotationPDF(quotation, pdfPath);
    }

    // Set headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quotation-${quotation.quotationNumber}.pdf`);

    // Stream the file
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download quotation error:', error);
    req.flash('error', 'Failed to download quotation');
    res.redirect(`/quotations/${req.params.id}`);
  }
};

// Delete quotation
exports.deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      req.flash('error', 'Quotation not found');
      return res.redirect('/quotations');
    }

    // Delete the quotation PDF if it exists
    const pdfPath = path.join(__dirname, '../public/quotations', `quotation-${quotation._id}.pdf`);
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
      console.log(`Deleted PDF file: ${pdfPath}`);
    }

    await Quotation.findByIdAndDelete(req.params.id);

    req.flash('success', `Quotation ${quotation.quotationNumber} deleted successfully`);
    res.redirect('/quotations');
  } catch (error) {
    console.error('Delete quotation error:', error);
    req.flash('error', 'Failed to delete quotation');
    res.redirect('/quotations');
  }
};



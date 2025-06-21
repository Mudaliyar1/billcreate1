const Quotation2 = require('../models/Quotation2');
const pdfGenerator = require('../utils/pdfGenerator');

// Get all quotations 2.0
exports.getQuotations2 = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const quotations = await Quotation2.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Quotation2.countDocuments();
    const totalPages = Math.ceil(total / limit);

    res.render('quotations2/index', {
      title: 'Quotation 2.0 - Kushi Decorators',
      quotations,
      currentPage: page,
      totalPages,
      total,
      path: req.path,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get quotations 2.0 error:', error);
    req.flash('error', 'Failed to fetch quotations');
    res.redirect('/dashboard');
  }
};

// Get create quotation 2.0 form
exports.getCreateQuotation2 = async (req, res) => {
  try {
    res.render('quotations2/create', {
      title: 'Create Quotation 2.0 - Kushi Decorators',
      path: req.path,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get create quotation 2.0 error:', error);
    req.flash('error', 'Failed to load create form');
    res.redirect('/quotations2');
  }
};

// Create new quotation 2.0
exports.postCreateQuotation2 = async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      customerPlace,
      customerGstNo,
      validUntil,
      notes,
      items
    } = req.body;

    // Validate required fields
    if (!customerName || !customerPhone || !customerAddress || !customerPlace || !validUntil) {
      req.flash('error', 'Please fill in all required customer fields');
      return res.redirect('/quotations2/create');
    }

    // Handle items - convert to array if it's not already
    let processedItemsArray = [];
    if (items) {
      if (Array.isArray(items)) {
        processedItemsArray = items;
      } else {
        // If it's a single item object, wrap it in an array
        processedItemsArray = [items];
      }
    }

    // Validate items
    if (!processedItemsArray || processedItemsArray.length === 0) {
      req.flash('error', 'Please add at least one item');
      return res.redirect('/quotations2/create');
    }

    // Process items
    const processedItems = processedItemsArray.map(item => ({
      itemName: item.itemName,
      description: item.description || '',
      quantity: parseFloat(item.quantity) || 0,
      unit: item.unit || 'Sqf',
      rate: parseFloat(item.amount) || 0, // Using amount as rate for calculation
      discount: parseFloat(item.discount) || 0,
      taxPercent: parseFloat(item.taxPercent) || 0,
      amount: parseFloat(item.amount) || 0
    }));

    // Generate quotation number
    const quotationNumber = await Quotation2.generateQuotationNumber();

    // Create quotation
    const quotation = new Quotation2({
      quotationNumber,
      customer: {
        name: customerName,
        phone: customerPhone,
        email: customerEmail || '',
        address: customerAddress,
        place: customerPlace,
        gstNo: customerGstNo || ''
      },
      items: processedItems,
      validUntil: new Date(validUntil),
      notes: notes || ''
    });

    await quotation.save();

    req.flash('success', `Quotation 2.0 ${quotationNumber} created successfully`);
    res.redirect(`/quotations2/${quotation._id}`);
  } catch (error) {
    console.error('Create quotation 2.0 error:', error);
    req.flash('error', 'Failed to create quotation');
    res.redirect('/quotations2/create');
  }
};

// Get quotation 2.0 details
exports.getQuotation2Details = async (req, res) => {
  try {
    const quotation = await Quotation2.findById(req.params.id);

    if (!quotation) {
      req.flash('error', 'Quotation not found');
      return res.redirect('/quotations2');
    }

    res.render('quotations2/details', {
      title: `Quotation 2.0 ${quotation.quotationNumber} - Kushi Decorators`,
      quotation,
      path: req.path,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get quotation 2.0 details error:', error);
    req.flash('error', 'Failed to fetch quotation details');
    res.redirect('/quotations2');
  }
};

// Get edit quotation 2.0 form
exports.getEditQuotation2 = async (req, res) => {
  try {
    const quotation = await Quotation2.findById(req.params.id);

    if (!quotation) {
      req.flash('error', 'Quotation not found');
      return res.redirect('/quotations2');
    }

    res.render('quotations2/edit', {
      title: `Edit Quotation 2.0 ${quotation.quotationNumber} - Kushi Decorators`,
      quotation,
      path: req.path,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get edit quotation 2.0 error:', error);
    req.flash('error', 'Failed to load edit form');
    res.redirect('/quotations2');
  }
};

// Update quotation 2.0
exports.updateQuotation2 = async (req, res) => {
  try {
    const quotation = await Quotation2.findById(req.params.id);

    if (!quotation) {
      req.flash('error', 'Quotation not found');
      return res.redirect('/quotations2');
    }

    const {
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      customerPlace,
      customerGstNo,
      validUntil,
      status,
      notes,
      items
    } = req.body;

    // Update customer information
    quotation.customer = {
      name: customerName,
      phone: customerPhone,
      email: customerEmail || '',
      address: customerAddress,
      place: customerPlace,
      gstNo: customerGstNo || ''
    };

    // Update items
    if (items && Array.isArray(items)) {
      quotation.items = items.map(item => ({
        itemName: item.itemName,
        description: item.description || '',
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit || 'Sqf',
        rate: parseFloat(item.amount) || 0, // Using amount as rate for calculation
        discount: parseFloat(item.discount) || 0,
        taxPercent: parseFloat(item.taxPercent) || 0,
        amount: parseFloat(item.amount) || 0
      }));
    }

    // Update other fields
    quotation.validUntil = new Date(validUntil);
    quotation.status = status || quotation.status;
    quotation.notes = notes || '';

    await quotation.save();

    req.flash('success', `Quotation 2.0 ${quotation.quotationNumber} updated successfully`);
    res.redirect(`/quotations2/${quotation._id}`);
  } catch (error) {
    console.error('Update quotation 2.0 error:', error);
    req.flash('error', 'Failed to update quotation');
    res.redirect(`/quotations2/${req.params.id}/edit`);
  }
};

// Delete quotation 2.0
exports.deleteQuotation2 = async (req, res) => {
  try {
    const quotation = await Quotation2.findById(req.params.id);

    if (!quotation) {
      req.flash('error', 'Quotation not found');
      return res.redirect('/quotations2');
    }

    await Quotation2.findByIdAndDelete(req.params.id);

    req.flash('success', `Quotation 2.0 ${quotation.quotationNumber} deleted successfully`);
    res.redirect('/quotations2');
  } catch (error) {
    console.error('Delete quotation 2.0 error:', error);
    req.flash('error', 'Failed to delete quotation');
    res.redirect('/quotations2');
  }
};

// Download quotation 2.0 as PDF
exports.downloadQuotation2 = async (req, res) => {
  try {
    const quotation = await Quotation2.findById(req.params.id);

    if (!quotation) {
      req.flash('error', 'Quotation not found');
      return res.redirect('/quotations2');
    }

    // Generate PDF using the updated PDF generator
    const pdfBuffer = await pdfGenerator.generateQuotation2PDF(quotation);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Quotation2_${quotation.quotationNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Download quotation 2.0 error:', error);
    req.flash('error', 'Failed to generate PDF');
    res.redirect(`/quotations2/${req.params.id}`);
  }
};

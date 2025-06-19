const QuotationProduct = require('../models/QuotationProduct');

// Get quotation products creation form
exports.getCreateQuotationProduct = async (req, res) => {
  try {
    res.render('quotation-products/create', {
      title: 'Create Quotation Product - Kushi Decorators',
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get create quotation product error:', error);
    req.flash('error', 'Failed to load quotation product creation page');
    res.redirect('/dashboard');
  }
};

// Create new quotation product
exports.postCreateQuotationProduct = async (req, res) => {
  try {
    const { name, price, pricePerFt, pricePerRft, unitType, quantity } = req.body;

    // Validation
    if (!name || !unitType) {
      req.flash('error', 'Name and unit type are required');
      return res.redirect('/quotation-products/create');
    }

    // Check if product already exists
    const existingProduct = await QuotationProduct.findOne({ name });
    if (existingProduct) {
      req.flash('error', 'A quotation product with this name already exists');
      return res.redirect('/quotation-products/create');
    }

    // Create quotation product
    const quotationProductData = {
      name: name.trim(),
      price: parseFloat(price) || 0,
      pricePerFt: parseFloat(pricePerFt) || 0,
      pricePerRft: parseFloat(pricePerRft) || 0,
      unitType,
      quantity: parseInt(quantity) || 0
    };

    const quotationProduct = await QuotationProduct.create(quotationProductData);

    req.flash('success', 'Quotation product created successfully');
    res.redirect('/quotation-products');
  } catch (error) {
    console.error('Create quotation product error:', error);
    req.flash('error', `Failed to create quotation product: ${error.message}`);
    res.redirect('/quotation-products/create');
  }
};

// Get all quotation products
exports.getQuotationProducts = async (req, res) => {
  try {
    const quotationProducts = await QuotationProduct.find().sort({ name: 1 });

    res.render('quotation-products/list', {
      title: 'Quotation Products - Kushi Decorators',
      quotationProducts,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get quotation products error:', error);
    req.flash('error', 'Failed to fetch quotation products');
    res.redirect('/dashboard');
  }
};

// Get quotation product edit form
exports.getEditQuotationProduct = async (req, res) => {
  try {
    const quotationProduct = await QuotationProduct.findById(req.params.id);

    if (!quotationProduct) {
      req.flash('error', 'Quotation product not found');
      return res.redirect('/quotation-products');
    }

    res.render('quotation-products/edit', {
      title: `Edit ${quotationProduct.name} - Kushi Decorators`,
      quotationProduct,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get edit quotation product error:', error);
    req.flash('error', 'Failed to load quotation product edit page');
    res.redirect('/quotation-products');
  }
};

// Update quotation product
exports.updateQuotationProduct = async (req, res) => {
  try {
    const quotationProduct = await QuotationProduct.findById(req.params.id);

    if (!quotationProduct) {
      req.flash('error', 'Quotation product not found');
      return res.redirect('/quotation-products');
    }

    const { name, price, pricePerFt, pricePerRft, unitType, quantity } = req.body;

    // Check if name is being changed and if it already exists
    if (name !== quotationProduct.name) {
      const existingProduct = await QuotationProduct.findOne({
        name,
        _id: { $ne: req.params.id }
      });
      if (existingProduct) {
        req.flash('error', 'A quotation product with this name already exists');
        return res.redirect(`/quotation-products/${req.params.id}/edit`);
      }
    }

    // Update quotation product
    quotationProduct.name = name.trim();
    quotationProduct.price = parseFloat(price) || 0;
    quotationProduct.pricePerFt = parseFloat(pricePerFt) || 0;
    quotationProduct.pricePerRft = parseFloat(pricePerRft) || 0;
    quotationProduct.unitType = unitType;
    quotationProduct.quantity = parseInt(quantity) || 0;

    await quotationProduct.save();

    req.flash('success', 'Quotation product updated successfully');
    res.redirect('/quotation-products');
  } catch (error) {
    console.error('Update quotation product error:', error);
    req.flash('error', `Failed to update quotation product: ${error.message}`);
    res.redirect(`/quotation-products/${req.params.id}/edit`);
  }
};

// Delete quotation product
exports.deleteQuotationProduct = async (req, res) => {
  try {
    const quotationProduct = await QuotationProduct.findById(req.params.id);

    if (!quotationProduct) {
      req.flash('error', 'Quotation product not found');
      return res.redirect('/quotation-products');
    }

    await QuotationProduct.findByIdAndDelete(req.params.id);

    req.flash('success', `Quotation product "${quotationProduct.name}" deleted successfully`);
    res.redirect('/quotation-products');
  } catch (error) {
    console.error('Delete quotation product error:', error);
    req.flash('error', 'Failed to delete quotation product');
    res.redirect('/quotation-products');
  }
};

// API endpoint to get all quotation products
exports.getAllQuotationProducts = async (req, res) => {
  try {
    const products = await QuotationProduct.find({}).sort({ name: 1 });
    res.json(products);
  } catch (error) {
    console.error('Get all quotation products error:', error);
    res.status(500).json({ error: 'Failed to fetch quotation products' });
  }
};

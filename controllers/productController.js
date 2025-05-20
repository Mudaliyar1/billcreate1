const Product = require('../models/Product');

// Get all products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ category: 1, name: 1 });

    res.render('products/list', {
      title: 'Products - Kushi Trader',
      products,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get products error:', error);
    req.flash('error', 'Failed to fetch products');
    res.redirect('/dashboard');
  }
};

// Get product creation form
exports.getAddProduct = (req, res) => {
  res.render('products/create', {
    title: 'Add Product - Kushi Trader',
    error: req.flash('error'),
    success: req.flash('success')
  });
};

// Create new product
exports.postAddProduct = async (req, res) => {
  const { name, price, category, quantity } = req.body;

  try {
    // Validate input
    if (!name || !price || !category) {
      req.flash('error', 'All fields are required');
      return res.redirect('/products/add');
    }

    // Check if product already exists
    const existingProduct = await Product.findOne({ name, category });

    if (existingProduct) {
      req.flash('error', 'Product already exists in this category');
      return res.redirect('/products/add');
    }

    // Create new product
    await Product.create({
      name,
      price,
      category,
      quantity: parseInt(quantity) || 0
    });

    req.flash('success', 'Product added successfully');
    res.redirect('/products');
  } catch (error) {
    console.error('Add product error:', error);
    req.flash('error', 'Failed to add product');
    res.redirect('/products/add');
  }
};

// Get product edit form
exports.getEditProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/products');
    }

    res.render('products/edit', {
      title: 'Edit Product - Kushi Trader',
      product,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get edit product error:', error);
    req.flash('error', 'Failed to fetch product');
    res.redirect('/products');
  }
};

// Update product
exports.postEditProduct = async (req, res) => {
  const { name, price, category, quantity } = req.body;

  try {
    // Validate input
    if (!name || !price || !category) {
      req.flash('error', 'All fields are required');
      return res.redirect(`/products/edit/${req.params.id}`);
    }

    // Check if product exists
    const product = await Product.findById(req.params.id);

    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/products');
    }

    // Update product
    product.name = name;
    product.price = price;
    product.category = category;
    product.quantity = parseInt(quantity) || 0;

    await product.save();

    req.flash('success', 'Product updated successfully');
    res.redirect('/products');
  } catch (error) {
    console.error('Edit product error:', error);
    req.flash('error', 'Failed to update product');
    res.redirect(`/products/edit/${req.params.id}`);
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/products');
    }

    await product.deleteOne();

    req.flash('success', 'Product deleted successfully');
    res.redirect('/products');
  } catch (error) {
    console.error('Delete product error:', error);
    req.flash('error', 'Failed to delete product');
    res.redirect('/products');
  }
};

// Get products by category (API)
exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    // Make sure to include all necessary fields, especially quantity
    const products = await Product.find({ category })
      .select('_id name price category quantity')
      .sort({ name: 1 });

    // Log the products for debugging
    console.log('Products for category', category, ':', products);

    res.json(products);
  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

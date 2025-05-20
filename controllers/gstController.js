const GstRate = require('../models/GstRate');

// Get GST rates list
exports.getGstRates = async (req, res) => {
  try {
    const gstRates = await GstRate.find().sort({ type: 1 });
    
    res.render('gst/list', {
      title: 'GST Rates - Kushi Trader',
      gstRates,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get GST rates error:', error);
    req.flash('error', 'Failed to fetch GST rates');
    res.redirect('/dashboard');
  }
};

// Get GST rate creation form
exports.getCreateGstRate = async (req, res) => {
  try {
    res.render('gst/create', {
      title: 'Create GST Rate - Kushi Trader',
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get create GST rate error:', error);
    req.flash('error', 'Failed to load GST rate creation page');
    res.redirect('/gst');
  }
};

// Create new GST rate
exports.postCreateGstRate = async (req, res) => {
  try {
    const { type, percentage, description, isDefault } = req.body;
    
    // Validate input
    if (!type || !percentage || !description) {
      req.flash('error', 'All fields are required');
      return res.redirect('/gst/create');
    }
    
    // Check if GST rate with this type already exists
    const existingRate = await GstRate.findOne({ type });
    if (existingRate) {
      req.flash('error', `GST rate with type ${type} already exists`);
      return res.redirect('/gst/create');
    }
    
    // Create new GST rate
    const gstRate = await GstRate.create({
      type,
      percentage: parseFloat(percentage),
      description,
      isDefault: isDefault === 'on'
    });
    
    req.flash('success', 'GST rate created successfully');
    res.redirect('/gst');
  } catch (error) {
    console.error('Create GST rate error:', error);
    req.flash('error', `Failed to create GST rate: ${error.message}`);
    res.redirect('/gst/create');
  }
};

// Get GST rate edit form
exports.getEditGstRate = async (req, res) => {
  try {
    const gstRate = await GstRate.findById(req.params.id);
    
    if (!gstRate) {
      req.flash('error', 'GST rate not found');
      return res.redirect('/gst');
    }
    
    res.render('gst/edit', {
      title: 'Edit GST Rate - Kushi Trader',
      gstRate,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get edit GST rate error:', error);
    req.flash('error', 'Failed to load GST rate edit page');
    res.redirect('/gst');
  }
};

// Update GST rate
exports.updateGstRate = async (req, res) => {
  try {
    const { percentage, description, isDefault } = req.body;
    
    // Validate input
    if (!percentage || !description) {
      req.flash('error', 'All fields are required');
      return res.redirect(`/gst/${req.params.id}/edit`);
    }
    
    // Find and update the GST rate
    const gstRate = await GstRate.findById(req.params.id);
    
    if (!gstRate) {
      req.flash('error', 'GST rate not found');
      return res.redirect('/gst');
    }
    
    // Update fields
    gstRate.percentage = parseFloat(percentage);
    gstRate.description = description;
    gstRate.isDefault = isDefault === 'on';
    
    await gstRate.save();
    
    req.flash('success', 'GST rate updated successfully');
    res.redirect('/gst');
  } catch (error) {
    console.error('Update GST rate error:', error);
    req.flash('error', `Failed to update GST rate: ${error.message}`);
    res.redirect(`/gst/${req.params.id}/edit`);
  }
};

// Delete GST rate
exports.deleteGstRate = async (req, res) => {
  try {
    const gstRate = await GstRate.findById(req.params.id);
    
    if (!gstRate) {
      req.flash('error', 'GST rate not found');
      return res.redirect('/gst');
    }
    
    await gstRate.remove();
    
    req.flash('success', 'GST rate deleted successfully');
    res.redirect('/gst');
  } catch (error) {
    console.error('Delete GST rate error:', error);
    req.flash('error', `Failed to delete GST rate: ${error.message}`);
    res.redirect('/gst');
  }
};

// API endpoint to get all GST rates
exports.apiGetGstRates = async (req, res) => {
  try {
    const gstRates = await GstRate.find().sort({ type: 1 });
    res.json({ success: true, data: gstRates });
  } catch (error) {
    console.error('API get GST rates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

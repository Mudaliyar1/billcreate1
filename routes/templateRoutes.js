const express = require('express');
const router = express.Router();
const BillTemplate = require('../models/BillTemplate');
const { ensureAdmin } = require('../middleware/auth');

// Get all templates
router.get('/templates', ensureAdmin, async (req, res) => {
  try {
    const templates = await BillTemplate.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 });
    
    res.render('templates/list', {
      title: 'Bill Templates',
      templates,
      user: req.user,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    req.flash('error', 'Error loading templates');
    res.redirect('/dashboard');
  }
});

// Show template editor (new template)
router.get('/templates/editor', ensureAdmin, async (req, res) => {
  try {
    res.render('templates/editor', {
      title: 'Create Template',
      template: null,
      user: req.user,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Error loading template editor:', error);
    req.flash('error', 'Error loading template editor');
    res.redirect('/templates');
  }
});

// Show template editor (edit existing template)
router.get('/templates/editor/:id', ensureAdmin, async (req, res) => {
  try {
    const template = await BillTemplate.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!template) {
      req.flash('error', 'Template not found');
      return res.redirect('/templates');
    }

    res.render('templates/editor', {
      title: 'Edit Template',
      template,
      user: req.user,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Error loading template editor:', error);
    req.flash('error', 'Error loading template editor');
    res.redirect('/templates');
  }
});

// Save template
router.post('/templates/save', ensureAdmin, async (req, res) => {
  try {
    const { templateId, name, description, pageSettings, elements, isDefault } = req.body;
    
    let template;
    
    if (templateId) {
      // Update existing template
      template = await BillTemplate.findOne({
        _id: templateId,
        createdBy: req.user._id
      });
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      template.name = name;
      template.description = description;
      template.pageSettings = pageSettings;
      template.elements = elements;
      template.isDefault = isDefault || false;
    } else {
      // Create new template
      template = new BillTemplate({
        name,
        description,
        pageSettings,
        elements,
        isDefault: isDefault || false,
        createdBy: req.user._id
      });
    }
    
    await template.save();
    
    res.json({ 
      success: true, 
      message: 'Template saved successfully',
      templateId: template._id
    });
  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({ error: 'Error saving template' });
  }
});

// Get list of templates for selection (moved before other API routes)
router.get('/api/templates/list', ensureAdmin, async (req, res) => {
  try {
    const templates = await BillTemplate.find({ createdBy: req.user._id })
      .select('_id name description isDefault elements')
      .sort({ isDefault: -1, createdAt: -1 });

    res.json(templates);
  } catch (error) {
    console.error('Error fetching template list:', error);
    res.status(500).json({ error: 'Error fetching templates' });
  }
});

// Get default template (moved before the :id route to avoid conflicts)
router.get('/api/templates/default', ensureAdmin, async (req, res) => {
  try {
    let template = await BillTemplate.findOne({
      createdBy: req.user._id,
      isDefault: true
    });

    // If no default template, create one
    if (!template) {
      template = await createDefaultTemplate(req.user._id);
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching default template:', error);
    res.status(500).json({ error: 'Error fetching default template' });
  }
});

// Get template data (API)
router.get('/api/templates/:id', ensureAdmin, async (req, res) => {
  try {
    const template = await BillTemplate.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Error fetching template' });
  }
});

// Set default template
router.post('/api/templates/:id/set-default', ensureAdmin, async (req, res) => {
  try {
    const template = await BillTemplate.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Remove default from all other templates
    await BillTemplate.updateMany(
      { createdBy: req.user._id },
      { isDefault: false }
    );

    // Set this template as default
    template.isDefault = true;
    await template.save();

    res.json({ success: true, message: 'Default template updated' });
  } catch (error) {
    console.error('Error setting default template:', error);
    res.status(500).json({ error: 'Error setting default template' });
  }
});

// Delete template
router.delete('/api/templates/:id', ensureAdmin, async (req, res) => {
  try {
    const template = await BillTemplate.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.isDefault) {
      return res.status(400).json({ error: 'Cannot delete default template' });
    }

    await BillTemplate.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Error deleting template' });
  }
});

// Helper function to create default template
async function createDefaultTemplate(userId) {
  const defaultElements = [
    {
      id: 'company_header',
      type: 'company_header',
      label: 'Company Header',
      position: { x: 40, y: 40 },
      size: { width: 515, height: 60 },
      style: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
      order: 1
    },
    {
      id: 'company_address',
      type: 'company_address',
      label: 'Company Address',
      position: { x: 40, y: 110 },
      size: { width: 350, height: 40 },
      style: { fontSize: 10, textAlign: 'center' },
      order: 2
    },
    {
      id: 'bill_number',
      type: 'bill_number',
      label: 'Bill Number',
      position: { x: 445, y: 40 },
      size: { width: 110, height: 20 },
      style: { fontSize: 14, fontWeight: 'bold' },
      order: 3
    },
    {
      id: 'bill_date',
      type: 'bill_date',
      label: 'Bill Date',
      position: { x: 445, y: 80 },
      size: { width: 110, height: 20 },
      style: { fontSize: 12 },
      order: 4
    },
    {
      id: 'customer_info',
      type: 'customer_info',
      label: 'Customer Information',
      position: { x: 40, y: 180 },
      size: { width: 250, height: 120 },
      style: { fontSize: 12 },
      order: 5
    },
    {
      id: 'work_details',
      type: 'work_details',
      label: 'Work Details',
      position: { x: 355, y: 180 },
      size: { width: 200, height: 80 },
      style: { fontSize: 12 },
      order: 6
    },
    {
      id: 'items_table',
      type: 'items_table',
      label: 'Items Table',
      position: { x: 40, y: 320 },
      size: { width: 515, height: 200 },
      style: { fontSize: 10 },
      order: 7
    },
    {
      id: 'total_amount',
      type: 'total_amount',
      label: 'Total Amount',
      position: { x: 355, y: 540 },
      size: { width: 200, height: 80 },
      style: { fontSize: 12, fontWeight: 'bold' },
      order: 8
    },
    {
      id: 'payment_details',
      type: 'payment_details',
      label: 'Payment Details',
      position: { x: 40, y: 640 },
      size: { width: 200, height: 60 },
      style: { fontSize: 10 },
      order: 9
    },
    {
      id: 'qr_code',
      type: 'qr_code',
      label: 'QR Code',
      position: { x: 355, y: 640 },
      size: { width: 120, height: 120 },
      order: 10
    },
    {
      id: 'footer',
      type: 'footer',
      label: 'Footer',
      position: { x: 40, y: 780 },
      size: { width: 515, height: 30 },
      style: { fontSize: 10, textAlign: 'center' },
      order: 11
    }
  ];

  const template = new BillTemplate({
    name: 'Default Template',
    description: 'Default bill template',
    isDefault: true,
    elements: defaultElements,
    createdBy: userId
  });

  await template.save();
  return template;
}

module.exports = router;

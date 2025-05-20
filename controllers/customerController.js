const Customer = require('../models/Customer');
const Bill = require('../models/Bill');

// Get all customers with statistics
exports.getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ name: 1 });

    // Get bills for all customers to calculate statistics
    const bills = await Bill.find();

    // Create a map of customer phone to their statistics
    const customerStats = {};

    // Initialize stats for each customer
    customers.forEach(customer => {
      customerStats[customer.phone] = {
        totalBills: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalRemaining: 0
      };
    });

    // Initialize overall statistics
    const overallStats = {
      totalCustomers: customers.length,
      totalBills: 0,
      totalAmount: 0,
      totalPaid: 0,
      totalRemaining: 0,
      cashBills: 0,
      creditBills: 0
    };

    // Calculate statistics for each customer
    bills.forEach(bill => {
      const customerPhone = bill.customer.phone;

      // Update overall stats
      overallStats.totalBills++;
      overallStats.totalAmount += bill.totalAmount;

      if (bill.paymentType === 'Cash') {
        overallStats.totalPaid += bill.paidAmount;
        if (bill.remainingAmount > 0) {
          overallStats.totalRemaining += bill.remainingAmount;
        }
        overallStats.cashBills++;
      } else if (bill.paymentType === 'Credit') {
        overallStats.creditBills++;
        if (bill.creditType === 'Half Credit') {
          overallStats.totalPaid += (bill.totalAmount / 2);
          overallStats.totalRemaining += (bill.totalAmount / 2);
        } else if (bill.creditType === 'Custom Credit') {
          overallStats.totalPaid += (bill.customPaidAmount || 0);
          overallStats.totalRemaining += (bill.totalAmount - (bill.customPaidAmount || 0));
        } else {
          overallStats.totalRemaining += bill.totalAmount;
        }
      }

      // Skip if customer not found in our list
      if (!customerStats[customerPhone]) return;

      // Update total bills and amount
      customerStats[customerPhone].totalBills++;
      customerStats[customerPhone].totalAmount += bill.totalAmount;

      // Calculate paid and remaining amounts
      if (bill.paymentType === 'Cash') {
        customerStats[customerPhone].totalPaid += bill.paidAmount;
        if (bill.remainingAmount > 0) {
          customerStats[customerPhone].totalRemaining += bill.remainingAmount;
        }
      } else if (bill.paymentType === 'Credit') {
        if (bill.creditType === 'Half Credit') {
          customerStats[customerPhone].totalPaid += (bill.totalAmount / 2);
          customerStats[customerPhone].totalRemaining += (bill.totalAmount / 2);
        } else if (bill.creditType === 'Custom Credit') {
          customerStats[customerPhone].totalPaid += (bill.customPaidAmount || 0);
          customerStats[customerPhone].totalRemaining += (bill.totalAmount - (bill.customPaidAmount || 0));
        } else {
          customerStats[customerPhone].totalRemaining += bill.totalAmount;
        }
      }
    });

    res.render('customers/list', {
      title: 'Customers - Kushi Trader',
      customers,
      customerStats,
      overallStats,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get customers error:', error);
    req.flash('error', 'Failed to fetch customers');
    res.redirect('/dashboard');
  }
};

// Get customer details with bills and statistics
exports.getCustomerDetails = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      req.flash('error', 'Customer not found');
      return res.redirect('/customers');
    }

    // Get query parameters for filtering
    const { paymentType, startDate, endDate, search, hasRemaining } = req.query;

    // Build filter query
    const filterQuery = { 'customer.phone': customer.phone };

    // Add payment type filter if provided
    if (paymentType) {
      filterQuery.paymentType = paymentType;
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      filterQuery.createdAt = {};

      if (startDate) {
        filterQuery.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        // Set the end date to the end of the day
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filterQuery.createdAt.$lte = endDateTime;
      }
    }

    // Add search filter if provided (search by bill number or work)
    if (search) {
      filterQuery.$or = [
        { billNumber: { $regex: search, $options: 'i' } },
        { 'work': { $regex: search, $options: 'i' } }
      ];
    }

    // Add remaining amount filter if provided
    if (hasRemaining === 'true') {
      filterQuery.remainingAmount = { $gt: 0 };
    } else if (hasRemaining === 'false') {
      filterQuery.remainingAmount = 0;
    }

    // Find bills for this customer with filters
    const bills = await Bill.find(filterQuery).sort({ createdAt: -1 });

    // Calculate statistics
    const totalBills = bills.length;
    const totalAmount = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const totalPaid = bills.reduce((sum, bill) => {
      if (bill.paymentType === 'Cash') {
        return sum + bill.paidAmount;
      } else if (bill.paymentType === 'Credit') {
        if (bill.creditType === 'Half Credit') {
          return sum + (bill.totalAmount / 2);
        } else if (bill.creditType === 'Custom Credit') {
          return sum + (bill.customPaidAmount || 0);
        } else {
          return sum;
        }
      }
      return sum;
    }, 0);

    const totalRemaining = bills.reduce((sum, bill) => {
      if (bill.paymentType === 'Cash') {
        return sum + (bill.remainingAmount || 0);
      } else if (bill.paymentType === 'Credit') {
        if (bill.creditType === 'Half Credit') {
          return sum + (bill.totalAmount / 2);
        } else if (bill.creditType === 'Custom Credit') {
          return sum + (bill.totalAmount - (bill.customPaidAmount || 0));
        } else {
          return sum + bill.totalAmount;
        }
      }
      return sum;
    }, 0);

    // Count bills by payment type
    const cashBills = bills.filter(bill => bill.paymentType === 'Cash').length;
    const creditBills = bills.filter(bill => bill.paymentType === 'Credit').length;

    // Calculate percentages for the progress bars
    const cashPercentage = totalBills > 0 ? Math.round((cashBills / totalBills) * 100) : 0;
    const creditPercentage = totalBills > 0 ? Math.round((creditBills / totalBills) * 100) : 0;

    // Get all bills for this customer (unfiltered) for the statistics card
    const allBills = await Bill.find({ 'customer.phone': customer.phone });
    const lifetimeStats = {
      totalBills: allBills.length,
      totalAmount: allBills.reduce((sum, bill) => sum + bill.totalAmount, 0),
      totalPaid: allBills.reduce((sum, bill) => {
        if (bill.paymentType === 'Cash') {
          return sum + bill.paidAmount;
        } else if (bill.paymentType === 'Credit') {
          if (bill.creditType === 'Half Credit') {
            return sum + (bill.totalAmount / 2);
          } else if (bill.creditType === 'Custom Credit') {
            return sum + (bill.customPaidAmount || 0);
          }
        }
        return sum;
      }, 0),
      totalRemaining: allBills.reduce((sum, bill) => {
        if (bill.paymentType === 'Cash') {
          return sum + (bill.remainingAmount || 0);
        } else if (bill.paymentType === 'Credit') {
          if (bill.creditType === 'Half Credit') {
            return sum + (bill.totalAmount / 2);
          } else if (bill.creditType === 'Custom Credit') {
            return sum + (bill.totalAmount - (bill.customPaidAmount || 0));
          } else {
            return sum + bill.totalAmount;
          }
        }
        return sum;
      }, 0)
    };

    res.render('customers/details', {
      title: `${customer.name} - Kushi Trader`,
      customer,
      bills,
      filters: {
        paymentType,
        startDate,
        endDate,
        search,
        hasRemaining
      },
      stats: {
        totalBills,
        totalAmount,
        totalPaid,
        totalRemaining,
        cashBills,
        creditBills,
        cashPercentage,
        creditPercentage
      },
      lifetimeStats,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get customer details error:', error);
    req.flash('error', 'Failed to fetch customer details');
    res.redirect('/customers');
  }
};

// Get customer creation form
exports.getAddCustomer = (req, res) => {
  res.render('customers/create', {
    title: 'Add Customer - Kushi Trader',
    error: req.flash('error'),
    success: req.flash('success')
  });
};

// Create new customer
exports.postAddCustomer = async (req, res) => {
  const { name, phone, place } = req.body;

  try {
    // Validate input
    if (!name || !phone || !place) {
      req.flash('error', 'All fields are required');
      return res.redirect('/customers/add');
    }

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ phone });

    if (existingCustomer) {
      req.flash('error', 'A customer with this phone number already exists');
      return res.redirect('/customers/add');
    }

    // Create new customer
    const customer = await Customer.create({
      name,
      phone,
      place
    });

    req.flash('success', 'Customer added successfully');
    res.redirect('/customers');
  } catch (error) {
    console.error('Add customer error:', error);
    req.flash('error', 'Failed to add customer');
    res.redirect('/customers/add');
  }
};

// Get customer edit form
exports.getEditCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      req.flash('error', 'Customer not found');
      return res.redirect('/customers');
    }

    res.render('customers/edit', {
      title: `Edit ${customer.name} - Kushi Trader`,
      customer,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get edit customer error:', error);
    req.flash('error', 'Failed to load customer edit page');
    res.redirect('/customers');
  }
};

// Update customer
exports.updateCustomer = async (req, res) => {
  try {
    const { name, phone, place } = req.body;

    // Validate input
    if (!name || !phone || !place) {
      req.flash('error', 'All fields are required');
      return res.redirect(`/customers/${req.params.id}/edit`);
    }

    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      req.flash('error', 'Customer not found');
      return res.redirect('/customers');
    }

    // Check if phone number is being changed and if it already exists
    if (phone !== customer.phone) {
      const existingCustomer = await Customer.findOne({ phone });
      if (existingCustomer && existingCustomer._id.toString() !== req.params.id) {
        req.flash('error', 'A customer with this phone number already exists');
        return res.redirect(`/customers/${req.params.id}/edit`);
      }
    }

    // Update customer
    customer.name = name;
    customer.phone = phone;
    customer.place = place;
    customer.email = email;
    await customer.save();

    // Update customer info in bills
    await Bill.updateMany(
      { 'customer.phone': customer.phone },
      {
        $set: {
          'customer.name': name,
          'customer.place': place,
          'customer.email': email
        }
      }
    );

    req.flash('success', 'Customer updated successfully');
    res.redirect(`/customers/${customer._id}`);
  } catch (error) {
    console.error('Update customer error:', error);
    req.flash('error', 'Failed to update customer');
    res.redirect(`/customers/${req.params.id}/edit`);
  }
};

// Get customer delete confirmation page
exports.getDeleteCustomerConfirmation = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      req.flash('error', 'Customer not found');
      return res.redirect('/customers');
    }

    // Check if customer has bills
    const billCount = await Bill.countDocuments({ 'customer.phone': customer.phone });

    res.render('customers/delete-confirmation', {
      title: `Delete ${customer.name} - Khushi Decoraters`,
      customer,
      billCount,
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get delete customer confirmation error:', error);
    req.flash('error', 'Failed to load delete confirmation page');
    res.redirect('/customers');
  }
};

// Delete customer
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerName, confirmDelete } = req.body;

    const customer = await Customer.findById(id);

    if (!customer) {
      req.flash('error', 'Customer not found');
      return res.redirect('/customers');
    }

    // Check if confirmation checkbox is checked and name matches
    if (!confirmDelete || customerName !== customer.name) {
      req.flash('error', 'Please type the customer name correctly and check the confirmation box to delete');
      return res.redirect(`/customers/${id}/delete`);
    }

    // Check if customer has bills
    const billCount = await Bill.countDocuments({ 'customer.phone': customer.phone });

    // If customer has bills, we'll still allow deletion with proper confirmation
    if (billCount > 0) {
      // Delete customer
      await Customer.findByIdAndDelete(id);
      req.flash('success', `Customer ${customer.name} deleted successfully along with their association to ${billCount} bills.`);
      return res.redirect('/customers');
    }

    // Delete customer
    await Customer.findByIdAndDelete(id);

    req.flash('success', 'Customer deleted successfully');
    res.redirect('/customers');
  } catch (error) {
    console.error('Delete customer error:', error);
    req.flash('error', 'Failed to delete customer');
    res.redirect('/customers');
  }
};

// Search customers (API)
exports.searchCustomers = async (req, res) => {
  try {
    const { query } = req.query;

    console.log('Customer search query:', query);

    if (!query) {
      console.log('Empty query, returning empty array');
      return res.json([]);
    }

    // Check if query is a phone number (exact match)
    if (/^\d+$/.test(query)) {
      console.log('Searching by phone number (exact):', query);
      const customerByExactPhone = await Customer.findOne({ phone: query });

      if (customerByExactPhone) {
        console.log('Found customer by exact phone match:', customerByExactPhone);
        return res.json([customerByExactPhone]);
      }
    }

    // Regular search with regex
    console.log('Performing regex search for:', query);
    const customers = await Customer.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } }
      ]
    }).limit(10);

    console.log(`Found ${customers.length} customers`);
    res.json(customers);
  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({ error: 'Failed to search customers' });
  }
};

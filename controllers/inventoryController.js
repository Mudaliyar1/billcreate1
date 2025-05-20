const Product = require('../models/Product');
const Bill = require('../models/Bill');

// Get inventory dashboard
exports.getInventoryDashboard = async (req, res) => {
  try {
    // Get filter parameters
    const { timeFilter = 'all', category = 'all', sortBy = 'name', sortOrder = 'asc' } = req.query;

    // Build date filter
    let dateFilter = {};
    const now = new Date();

    if (timeFilter === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { $gte: startOfDay } };
    } else if (timeFilter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: startOfMonth } };
    } else if (timeFilter === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { createdAt: { $gte: startOfYear } };
    }

    // Build category filter
    let categoryFilter = {};
    if (category !== 'all') {
      categoryFilter = { category };
    }

    // Combine filters
    const filter = { ...dateFilter, ...categoryFilter };

    // Build sort options
    let sortOptions = {};
    if (sortBy === 'name') {
      sortOptions.name = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'quantity') {
      sortOptions.quantity = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'totalSold') {
      sortOptions.totalSold = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'totalCreditAmount') {
      sortOptions.totalCreditAmount = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'totalPaidAmount') {
      sortOptions.totalPaidAmount = sortOrder === 'asc' ? 1 : -1;
    }

    // Get products with inventory data
    const products = await Product.find(filter).sort(sortOptions);

    // Calculate statistics
    let stats = {
      totalProducts: products.length,
      totalQuantity: 0,
      totalSold: 0,
      totalCreditAmount: 0,
      totalPaidAmount: 0,
      lowStockCount: 0
    };

    products.forEach(product => {
      stats.totalQuantity += product.quantity || 0;
      stats.totalSold += product.totalSold || 0;
      stats.totalCreditAmount += product.totalCreditAmount || 0;
      stats.totalPaidAmount += product.totalPaidAmount || 0;

      if ((product.quantity || 0) <= 5) {
        stats.lowStockCount++;
      }
    });

    // Get top products
    const topSellingProducts = [...products].sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0)).slice(0, 5);
    const topCreditProducts = [...products].sort((a, b) => (b.totalCreditAmount || 0) - (a.totalCreditAmount || 0)).slice(0, 5);
    const topPaidProducts = [...products].sort((a, b) => (b.totalPaidAmount || 0) - (a.totalPaidAmount || 0)).slice(0, 5);
    const lowStockProducts = products.filter(p => (p.quantity || 0) <= 5).sort((a, b) => (a.quantity || 0) - (b.quantity || 0));

    res.render('inventory/dashboard', {
      title: 'Inventory Management - Khushi Decoraters',
      products,
      stats,
      topSellingProducts,
      topCreditProducts,
      topPaidProducts,
      lowStockProducts,
      filters: {
        timeFilter,
        category,
        sortBy,
        sortOrder
      },
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get inventory dashboard error:', error);
    req.flash('error', 'Failed to load inventory dashboard');
    res.redirect('/dashboard');
  }
};

// Get inventory report
exports.getInventoryReport = async (req, res) => {
  try {
    // Get filter parameters
    const { startDate, endDate, category } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};

      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = endDateTime;
      }
    }

    // Build category filter
    let categoryFilter = {};
    if (category && category !== 'all') {
      categoryFilter.category = category;
    }

    // Combine filters
    const filter = { ...dateFilter, ...categoryFilter };

    // Get bills for the period
    const bills = await Bill.find(filter).sort({ createdAt: -1 });

    // Get products
    const products = await Product.find(categoryFilter);

    // Calculate product sales during the period
    const productSales = {};

    bills.forEach(bill => {
      bill.items.forEach(item => {
        const productId = item.product.toString();

        if (!productSales[productId]) {
          productSales[productId] = {
            name: item.name,
            category: item.category,
            quantitySold: 0,
            totalAmount: 0,
            paidAmount: 0,
            creditAmount: 0
          };
        }

        const itemTotal = item.price * item.quantity;
        productSales[productId].quantitySold += item.quantity;
        productSales[productId].totalAmount += itemTotal;

        // Calculate paid and credit amounts based on bill payment
        if (bill.paymentType === 'Cash') {
          if (bill.paidAmount >= bill.totalAmount) {
            productSales[productId].paidAmount += itemTotal;
          } else {
            const paidRatio = bill.paidAmount / bill.totalAmount;
            productSales[productId].paidAmount += itemTotal * paidRatio;
            productSales[productId].creditAmount += itemTotal * (1 - paidRatio);
          }
        } else if (bill.paymentType === 'Credit') {
          if (bill.creditType === 'Full Credit') {
            productSales[productId].creditAmount += itemTotal;
          } else if (bill.creditType === 'Half Credit') {
            productSales[productId].paidAmount += itemTotal / 2;
            productSales[productId].creditAmount += itemTotal / 2;
          } else if (bill.creditType === 'Custom Credit') {
            const paidRatio = bill.paidAmount / bill.totalAmount;
            productSales[productId].paidAmount += itemTotal * paidRatio;
            productSales[productId].creditAmount += itemTotal * (1 - paidRatio);
          }
        }
      });
    });

    // Convert to array and sort by quantity sold
    const salesArray = Object.values(productSales).sort((a, b) => b.quantitySold - a.quantitySold);

    // Calculate totals
    const totals = {
      quantitySold: 0,
      totalAmount: 0,
      paidAmount: 0,
      creditAmount: 0
    };

    salesArray.forEach(sale => {
      totals.quantitySold += sale.quantitySold;
      totals.totalAmount += sale.totalAmount;
      totals.paidAmount += sale.paidAmount;
      totals.creditAmount += sale.creditAmount;
    });

    res.render('inventory/report', {
      title: 'Inventory Report - Khushi Decoraters',
      salesArray,
      products,
      totals,
      filters: {
        startDate,
        endDate,
        category
      },
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get inventory report error:', error);
    req.flash('error', 'Failed to generate inventory report');
    res.redirect('/inventory');
  }
};

// Update product quantity
exports.updateProductQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    // Validate input
    if (quantity === undefined) {
      req.flash('error', 'Quantity is required');
      return res.redirect('/inventory');
    }

    // Find product
    const product = await Product.findById(id);

    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/inventory');
    }

    // Update quantity
    product.quantity = parseInt(quantity);
    await product.save();

    req.flash('success', `Quantity for ${product.name} updated successfully`);
    res.redirect('/inventory');
  } catch (error) {
    console.error('Update product quantity error:', error);
    req.flash('error', 'Failed to update product quantity');
    res.redirect('/inventory');
  }
};

// Reset and recalculate all product financial data
exports.resetFinancialData = async (req, res) => {
  try {
    console.log('Starting financial data reset and recalculation');

    // Get all products
    const products = await Product.find();
    console.log(`Found ${products.length} products to reset`);

    // Reset financial data for all products
    for (const product of products) {
      product.totalCreditAmount = 0;
      product.totalPaidAmount = 0;
      await product.save();
      console.log(`Reset financial data for ${product.name}`);
    }

    // Get all bills
    const bills = await Bill.find();
    console.log(`Found ${bills.length} bills to process`);

    // Process each bill to recalculate financial data
    for (const bill of bills) {
      for (const item of bill.items) {
        const product = await Product.findById(item.product);

        if (product) {
          const itemTotal = item.price * item.quantity;

          // Update financial tracking based on payment type
          if (bill.paymentType === 'Cash') {
            if (bill.paidAmount >= bill.totalAmount) {
              // Fully paid
              product.totalPaidAmount += itemTotal;
              console.log(`Added ${itemTotal} to paid amount for ${product.name}`);
            } else {
              // Partially paid - split proportionally
              const paidRatio = bill.paidAmount / bill.totalAmount;
              product.totalPaidAmount += itemTotal * paidRatio;
              product.totalCreditAmount += itemTotal * (1 - paidRatio);
              console.log(`Split payment for ${product.name}: ${itemTotal * paidRatio} paid, ${itemTotal * (1 - paidRatio)} credit`);
            }
          } else if (bill.paymentType === 'Credit') {
            if (bill.creditType === 'Full Credit') {
              // Fully credit
              product.totalCreditAmount += itemTotal;
              console.log(`Added ${itemTotal} to credit amount for ${product.name}`);
            } else if (bill.creditType === 'Half Credit') {
              // Half credit
              product.totalPaidAmount += itemTotal / 2;
              product.totalCreditAmount += itemTotal / 2;
              console.log(`Split half payment for ${product.name}: ${itemTotal / 2} paid, ${itemTotal / 2} credit`);
            } else if (bill.creditType === 'Custom Credit') {
              // Custom credit - split based on paid amount
              const paidRatio = bill.paidAmount / bill.totalAmount;
              product.totalPaidAmount += itemTotal * paidRatio;
              product.totalCreditAmount += itemTotal * (1 - paidRatio);
              console.log(`Split custom payment for ${product.name}: ${itemTotal * paidRatio} paid, ${itemTotal * (1 - paidRatio)} credit`);
            }
          }

          await product.save();
        } else {
          console.log(`Product not found for item: ${item.name}`);
        }
      }
    }

    req.flash('success', 'Financial data has been reset and recalculated successfully');
    res.redirect('/inventory');
  } catch (error) {
    console.error('Reset financial data error:', error);
    req.flash('error', `Failed to reset financial data: ${error.message}`);
    res.redirect('/inventory');
  }
};

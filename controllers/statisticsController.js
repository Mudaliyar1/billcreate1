const Bill = require('../models/Bill');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Quotation = require('../models/Quotation');
const Quotation2 = require('../models/Quotation2');
const ReturnBill = require('../models/ReturnBill');

// Get Statistics
const getStatistics = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Month names for display
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Get basic counts
    const totalCustomers = await Customer.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalBills = await Bill.countDocuments();

    // Date ranges
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    // Monthly statistics
    const monthlyBills = await Bill.find({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const monthlyTotalAmount = monthlyBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const monthlyPaidAmount = monthlyBills.reduce((sum, bill) => sum + bill.paidAmount, 0);
    const monthlyRemainingAmount = monthlyBills.reduce((sum, bill) => sum + bill.remainingAmount, 0);

    // Yearly statistics
    const yearlyBills = await Bill.find({
      createdAt: { $gte: startOfYear, $lte: endOfYear }
    });

    const yearlyTotalAmount = yearlyBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const yearlyPaidAmount = yearlyBills.reduce((sum, bill) => sum + bill.paidAmount, 0);
    const yearlyRemainingAmount = yearlyBills.reduce((sum, bill) => sum + bill.remainingAmount, 0);

    // Payment type statistics
    const cashBills = await Bill.countDocuments({ paymentType: 'Cash' });
    const creditBills = await Bill.countDocuments({ paymentType: 'Credit' });

    // Product category statistics
    const products = await Product.find();
    const productCategoryCounts = {};
    products.forEach(product => {
      productCategoryCounts[product.category] = (productCategoryCounts[product.category] || 0) + 1;
    });

    // Monthly sales by category
    const monthlySalesByCategory = {};
    monthlyBills.forEach(bill => {
      bill.items.forEach(item => {
        const category = item.category || 'Uncategorized';
        if (!monthlySalesByCategory[category]) {
          monthlySalesByCategory[category] = { quantity: 0, amount: 0 };
        }
        monthlySalesByCategory[category].quantity += item.quantity;
        monthlySalesByCategory[category].amount += item.price * item.quantity;
      });
    });

    // Monthly data for chart (last 12 months)
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(currentYear, currentMonth - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthBills = await Bill.find({
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      const totalAmount = monthBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      const paidAmount = monthBills.reduce((sum, bill) => sum + bill.paidAmount, 0);
      const remainingAmount = monthBills.reduce((sum, bill) => sum + bill.remainingAmount, 0);

      monthlyData.push({
        month: monthNames[monthDate.getMonth()],
        totalAmount,
        paidAmount,
        remainingAmount
      });
    }

    // Get enhanced analytics
    const enhancedAnalytics = await getEnhancedAnalytics();

    res.render('statistics', {
      title: 'Statistics - Kushi Trader',
      totalCustomers,
      totalProducts,
      totalBills,
      monthlyTotalAmount,
      monthlyPaidAmount,
      monthlyRemainingAmount,
      yearlyTotalAmount,
      yearlyPaidAmount,
      yearlyRemainingAmount,
      cashBills,
      creditBills,
      productCategoryCounts,
      monthlySalesByCategory,
      monthlyData,
      currentMonth: monthNames[currentMonth],
      currentYear,
      ...enhancedAnalytics, // Spread enhanced analytics
      error: req.flash('error'),
      success: req.flash('success')
    });

  } catch (error) {
    console.error('Get statistics error:', error);
    req.flash('error', 'Failed to fetch statistics');
    res.redirect('/dashboard');
  }
};

// Get statistics dashboard
exports.getStatistics = async (req, res) => {
  try {
    // Get current date
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    // Create date ranges
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    
    // Get total counts
    const totalCustomers = await Customer.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalBills = await Bill.countDocuments();
    
    // Get monthly statistics
    const monthlyBills = await Bill.find({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });
    
    const monthlyTotalAmount = monthlyBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const monthlyPaidAmount = monthlyBills.reduce((sum, bill) => sum + bill.paidAmount, 0);
    const monthlyRemainingAmount = monthlyBills.reduce((sum, bill) => sum + bill.remainingAmount, 0);
    
    // Get yearly statistics
    const yearlyBills = await Bill.find({
      createdAt: { $gte: startOfYear, $lte: endOfYear }
    });
    
    const yearlyTotalAmount = yearlyBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const yearlyPaidAmount = yearlyBills.reduce((sum, bill) => sum + bill.paidAmount, 0);
    const yearlyRemainingAmount = yearlyBills.reduce((sum, bill) => sum + bill.remainingAmount, 0);
    
    // Get payment type statistics
    const cashBills = await Bill.countDocuments({ paymentType: 'Cash' });
    const creditBills = await Bill.countDocuments({ paymentType: 'Credit' });
    
    // Get product category statistics
    const productCategories = ['Board', 'Chanel', 'Hardware', 'Bori'];
    const productCategoryCounts = {};
    
    for (const category of productCategories) {
      productCategoryCounts[category] = await Product.countDocuments({ category });
    }
    
    // Get monthly sales by category
    const monthlySalesByCategory = {};
    
    for (const bill of monthlyBills) {
      for (const item of bill.items) {
        if (!monthlySalesByCategory[item.category]) {
          monthlySalesByCategory[item.category] = {
            quantity: 0,
            amount: 0
          };
        }
        
        monthlySalesByCategory[item.category].quantity += item.quantity;
        monthlySalesByCategory[item.category].amount += (item.price * item.quantity);
      }
    }
    
    // Get monthly data for chart
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthlyData = [];
    
    for (let i = 0; i < 12; i++) {
      const startOfMonthI = new Date(currentYear, i, 1);
      const endOfMonthI = new Date(currentYear, i + 1, 0, 23, 59, 59, 999);
      
      const monthBills = await Bill.find({
        createdAt: { $gte: startOfMonthI, $lte: endOfMonthI }
      });
      
      const monthTotalAmount = monthBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      const monthPaidAmount = monthBills.reduce((sum, bill) => sum + bill.paidAmount, 0);
      const monthRemainingAmount = monthBills.reduce((sum, bill) => sum + bill.remainingAmount, 0);
      
      monthlyData.push({
        month: monthNames[i],
        totalAmount: monthTotalAmount,
        paidAmount: monthPaidAmount,
        remainingAmount: monthRemainingAmount,
        billCount: monthBills.length
      });
    }
    
    // Get enhanced analytics
    const enhancedAnalytics = await getEnhancedAnalytics();

    res.render('statistics', {
      title: 'Statistics - Kushi Trader',
      totalCustomers,
      totalProducts,
      totalBills,
      monthlyTotalAmount,
      monthlyPaidAmount,
      monthlyRemainingAmount,
      yearlyTotalAmount,
      yearlyPaidAmount,
      yearlyRemainingAmount,
      cashBills,
      creditBills,
      productCategoryCounts,
      monthlySalesByCategory,
      monthlyData,
      currentMonth: monthNames[currentMonth],
      currentYear,
      ...enhancedAnalytics, // Spread enhanced analytics
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    req.flash('error', 'Failed to fetch statistics');
    res.redirect('/dashboard');
  }
};

// Enhanced Analytics Function
async function getEnhancedAnalytics() {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Date ranges
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfLastMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    // 1. CUSTOMER ANALYTICS
    const customerAnalytics = await getCustomerAnalytics();

    // 2. PRODUCT PERFORMANCE ANALYTICS
    const productAnalytics = await getProductAnalytics();

    // 3. FINANCIAL INSIGHTS
    const financialInsights = await getFinancialInsights();

    // 4. INVENTORY INSIGHTS
    const inventoryInsights = await getInventoryInsights();

    // 5. QUOTATION ANALYTICS
    const quotationAnalytics = await getQuotationAnalytics();

    // 6. RETURN ANALYTICS
    const returnAnalytics = await getReturnAnalytics();

    // 7. GROWTH METRICS
    const growthMetrics = await getGrowthMetrics();

    return {
      customerAnalytics,
      productAnalytics,
      financialInsights,
      inventoryInsights,
      quotationAnalytics,
      returnAnalytics,
      growthMetrics
    };

  } catch (error) {
    console.error('Enhanced analytics error:', error);
    return {};
  }
}

// Customer Analytics
async function getCustomerAnalytics() {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // Get all customers with their bill statistics
    const customers = await Customer.find();
    const bills = await Bill.find();

    // Customer segmentation
    const customerSegments = {
      vip: [], // >50k total purchase
      regular: [], // 10k-50k total purchase
      occasional: [], // 1k-10k total purchase
      new: [] // <1k total purchase
    };

    let totalCustomerValue = 0;
    const customerStats = [];

    for (const customer of customers) {
      const customerBills = bills.filter(bill => bill.customer.phone === customer.phone);
      const totalPurchase = customerBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      const totalPaid = customerBills.reduce((sum, bill) => sum + bill.paidAmount, 0);
      const totalPending = customerBills.reduce((sum, bill) => sum + bill.remainingAmount, 0);
      const billCount = customerBills.length;
      const avgOrderValue = billCount > 0 ? totalPurchase / billCount : 0;

      // Last purchase date
      const lastPurchase = customerBills.length > 0
        ? new Date(Math.max(...customerBills.map(bill => new Date(bill.createdAt))))
        : null;

      const customerData = {
        ...customer.toObject(),
        totalPurchase,
        totalPaid,
        totalPending,
        billCount,
        avgOrderValue,
        lastPurchase
      };

      customerStats.push(customerData);
      totalCustomerValue += totalPurchase;

      // Segment customers
      if (totalPurchase > 50000) {
        customerSegments.vip.push(customerData);
      } else if (totalPurchase > 10000) {
        customerSegments.regular.push(customerData);
      } else if (totalPurchase > 1000) {
        customerSegments.occasional.push(customerData);
      } else {
        customerSegments.new.push(customerData);
      }
    }

    // Top customers by value
    const topCustomers = customerStats
      .sort((a, b) => b.totalPurchase - a.totalPurchase)
      .slice(0, 10);

    // Customer retention metrics
    const monthlyCustomers = bills.filter(bill =>
      new Date(bill.createdAt) >= startOfMonth && new Date(bill.createdAt) <= endOfMonth
    ).map(bill => bill.customer.phone);

    const uniqueMonthlyCustomers = [...new Set(monthlyCustomers)].length;

    return {
      customerSegments,
      topCustomers,
      totalCustomerValue,
      avgCustomerValue: customers.length > 0 ? totalCustomerValue / customers.length : 0,
      uniqueMonthlyCustomers,
      customerRetentionRate: customers.length > 0 ? (uniqueMonthlyCustomers / customers.length * 100).toFixed(1) : 0
    };

  } catch (error) {
    console.error('Customer analytics error:', error);
    return {};
  }
}

// Product Performance Analytics
async function getProductAnalytics() {
  try {
    const products = await Product.find();
    const bills = await Bill.find();

    const productPerformance = [];

    for (const product of products) {
      // Calculate sales metrics for each product
      const productSales = [];

      bills.forEach(bill => {
        bill.items.forEach(item => {
          if (item.name === product.name) {
            productSales.push({
              quantity: item.quantity,
              revenue: item.price * item.quantity,
              date: bill.createdAt
            });
          }
        });
      });

      const totalQuantitySold = productSales.reduce((sum, sale) => sum + sale.quantity, 0);
      const totalRevenue = productSales.reduce((sum, sale) => sum + sale.revenue, 0);
      const avgSellingPrice = totalQuantitySold > 0 ? totalRevenue / totalQuantitySold : 0;

      // Calculate profit margin (assuming cost is 70% of selling price)
      const estimatedCost = product.price * 0.7;
      const profitPerUnit = product.price - estimatedCost;
      const totalProfit = totalQuantitySold * profitPerUnit;
      const profitMargin = product.price > 0 ? ((profitPerUnit / product.price) * 100).toFixed(1) : 0;

      // Inventory turnover
      const inventoryTurnover = product.quantity > 0 ? (totalQuantitySold / product.quantity).toFixed(2) : 0;

      productPerformance.push({
        ...product.toObject(),
        totalQuantitySold,
        totalRevenue,
        avgSellingPrice,
        totalProfit,
        profitMargin,
        inventoryTurnover,
        salesFrequency: productSales.length
      });
    }

    // Sort by different metrics
    const topSellingProducts = [...productPerformance]
      .sort((a, b) => b.totalQuantitySold - a.totalQuantitySold)
      .slice(0, 10);

    const topRevenueProducts = [...productPerformance]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    const topProfitProducts = [...productPerformance]
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 10);

    const slowMovingProducts = [...productPerformance]
      .filter(p => p.inventoryTurnover < 0.5)
      .sort((a, b) => a.inventoryTurnover - b.inventoryTurnover)
      .slice(0, 10);

    return {
      productPerformance,
      topSellingProducts,
      topRevenueProducts,
      topProfitProducts,
      slowMovingProducts
    };

  } catch (error) {
    console.error('Product analytics error:', error);
    return {};
  }
}

// Financial Insights
async function getFinancialInsights() {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfLastMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    const bills = await Bill.find();

    // Current month financial data
    const currentMonthBills = bills.filter(bill =>
      new Date(bill.createdAt) >= startOfMonth && new Date(bill.createdAt) <= endOfMonth
    );

    // Last month financial data
    const lastMonthBills = bills.filter(bill =>
      new Date(bill.createdAt) >= startOfLastMonth && new Date(bill.createdAt) <= endOfLastMonth
    );

    const currentMonthRevenue = currentMonthBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const lastMonthRevenue = lastMonthBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const revenueGrowth = lastMonthRevenue > 0 ?
      (((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1) : 0;

    // Cash flow analysis
    const totalReceivables = bills.reduce((sum, bill) => sum + bill.remainingAmount, 0);
    const totalReceived = bills.reduce((sum, bill) => sum + bill.paidAmount, 0);
    const collectionRate = bills.length > 0 ?
      ((totalReceived / (totalReceived + totalReceivables)) * 100).toFixed(1) : 0;

    // Payment method analysis
    const cashRevenue = bills.filter(bill => bill.paymentType === 'Cash')
      .reduce((sum, bill) => sum + bill.totalAmount, 0);
    const creditRevenue = bills.filter(bill => bill.paymentType === 'Credit')
      .reduce((sum, bill) => sum + bill.totalAmount, 0);

    // Average order value trends
    const avgOrderValue = bills.length > 0 ?
      bills.reduce((sum, bill) => sum + bill.totalAmount, 0) / bills.length : 0;

    const currentMonthAOV = currentMonthBills.length > 0 ?
      currentMonthRevenue / currentMonthBills.length : 0;
    const lastMonthAOV = lastMonthBills.length > 0 ?
      lastMonthRevenue / lastMonthBills.length : 0;
    const aovGrowth = lastMonthAOV > 0 ?
      (((currentMonthAOV - lastMonthAOV) / lastMonthAOV) * 100).toFixed(1) : 0;

    return {
      currentMonthRevenue,
      lastMonthRevenue,
      revenueGrowth,
      totalReceivables,
      totalReceived,
      collectionRate,
      cashRevenue,
      creditRevenue,
      avgOrderValue,
      currentMonthAOV,
      lastMonthAOV,
      aovGrowth
    };

  } catch (error) {
    console.error('Financial insights error:', error);
    return {};
  }
}

// Inventory Insights
async function getInventoryInsights() {
  try {
    const products = await Product.find();
    const bills = await Bill.find();

    let totalInventoryValue = 0;
    let lowStockProducts = [];
    let outOfStockProducts = [];
    let overstockedProducts = [];

    products.forEach(product => {
      const inventoryValue = product.quantity * product.price;
      totalInventoryValue += inventoryValue;

      // Stock level analysis
      if (product.quantity === 0) {
        outOfStockProducts.push(product);
      } else if (product.quantity < 10) { // Assuming 10 is low stock threshold
        lowStockProducts.push(product);
      } else if (product.quantity > 100) { // Assuming 100 is overstock threshold
        overstockedProducts.push(product);
      }
    });

    // Calculate inventory turnover for categories
    const categoryTurnover = {};
    const categories = ['Board', 'Chanel', 'Hardware', 'Bori'];

    categories.forEach(category => {
      const categoryProducts = products.filter(p => p.category === category);
      const categoryStock = categoryProducts.reduce((sum, p) => sum + p.quantity, 0);

      let categorySold = 0;
      bills.forEach(bill => {
        bill.items.forEach(item => {
          if (item.category === category) {
            categorySold += item.quantity;
          }
        });
      });

      categoryTurnover[category] = {
        stock: categoryStock,
        sold: categorySold,
        turnover: categoryStock > 0 ? (categorySold / categoryStock).toFixed(2) : 0
      };
    });

    return {
      totalInventoryValue,
      lowStockProducts: lowStockProducts.slice(0, 10),
      outOfStockProducts: outOfStockProducts.slice(0, 10),
      overstockedProducts: overstockedProducts.slice(0, 10),
      categoryTurnover
    };

  } catch (error) {
    console.error('Inventory insights error:', error);
    return {};
  }
}

// Quotation Analytics
async function getQuotationAnalytics() {
  try {
    const quotations = await Quotation.find();
    const quotations2 = await Quotation2.find();
    const bills = await Bill.find();

    const totalQuotations = quotations.length + quotations2.length;
    const totalQuotationValue = quotations.reduce((sum, q) => sum + q.totalAmount, 0) +
                               quotations2.reduce((sum, q) => sum + q.totalAmount, 0);

    // Conversion rate (quotations that became bills)
    let convertedQuotations = 0;
    quotations.forEach(quotation => {
      const converted = bills.some(bill =>
        bill.customer.phone === quotation.customer.phone &&
        Math.abs(new Date(bill.createdAt) - new Date(quotation.createdAt)) < 30 * 24 * 60 * 60 * 1000 // Within 30 days
      );
      if (converted) convertedQuotations++;
    });

    const conversionRate = totalQuotations > 0 ?
      ((convertedQuotations / totalQuotations) * 100).toFixed(1) : 0;

    return {
      totalQuotations,
      totalQuotationValue,
      conversionRate,
      avgQuotationValue: totalQuotations > 0 ? totalQuotationValue / totalQuotations : 0
    };

  } catch (error) {
    console.error('Quotation analytics error:', error);
    return {};
  }
}

// Return Analytics
async function getReturnAnalytics() {
  try {
    const returns = await ReturnBill.find();
    const bills = await Bill.find();

    const totalReturns = returns.length;
    const totalReturnValue = returns.reduce((sum, ret) => {
      return sum + ret.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
    }, 0);

    const returnRate = bills.length > 0 ? ((totalReturns / bills.length) * 100).toFixed(1) : 0;

    // Return reasons analysis
    const returnReasons = {};
    returns.forEach(ret => {
      const reason = ret.reason || 'Not specified';
      returnReasons[reason] = (returnReasons[reason] || 0) + 1;
    });

    return {
      totalReturns,
      totalReturnValue,
      returnRate,
      returnReasons
    };

  } catch (error) {
    console.error('Return analytics error:', error);
    return {};
  }
}

// Growth Metrics
async function getGrowthMetrics() {
  try {
    const currentDate = new Date();
    const bills = await Bill.find();

    // Calculate growth for last 6 months
    const monthlyGrowth = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthBills = bills.filter(bill =>
        new Date(bill.createdAt) >= startOfMonth && new Date(bill.createdAt) <= endOfMonth
      );

      const monthRevenue = monthBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      const monthCustomers = [...new Set(monthBills.map(bill => bill.customer.phone))].length;

      monthlyGrowth.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: monthRevenue,
        customers: monthCustomers,
        orders: monthBills.length
      });
    }

    return {
      monthlyGrowth
    };

  } catch (error) {
    console.error('Growth metrics error:', error);
    return {};
  }
}

// Export Statistics Data
const exportStatistics = async (req, res) => {
  try {
    const { format } = req.query; // 'csv' or 'json'

    // Get all analytics data
    const enhancedAnalytics = await getEnhancedAnalytics();
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Basic statistics
    const totalCustomers = await Customer.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalBills = await Bill.countDocuments();

    const exportData = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalCustomers,
        totalProducts,
        totalBills,
        ...enhancedAnalytics.financialInsights
      },
      customerAnalytics: enhancedAnalytics.customerAnalytics,
      productAnalytics: enhancedAnalytics.productAnalytics,
      inventoryInsights: enhancedAnalytics.inventoryInsights,
      quotationAnalytics: enhancedAnalytics.quotationAnalytics,
      returnAnalytics: enhancedAnalytics.returnAnalytics,
      growthMetrics: enhancedAnalytics.growthMetrics
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertToCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=statistics-${Date.now()}.csv`);
      res.send(csv);
    } else {
      // Default to JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=statistics-${Date.now()}.json`);
      res.json(exportData);
    }

  } catch (error) {
    console.error('Export statistics error:', error);
    req.flash('error', 'Failed to export statistics');
    res.redirect('/statistics');
  }
};

// Helper function to convert data to CSV
function convertToCSV(data) {
  let csv = 'Statistics Report\n\n';

  // Summary section
  csv += 'SUMMARY\n';
  csv += 'Metric,Value\n';
  csv += `Total Customers,${data.summary.totalCustomers}\n`;
  csv += `Total Products,${data.summary.totalProducts}\n`;
  csv += `Total Bills,${data.summary.totalBills}\n`;
  csv += `Current Month Revenue,${data.summary.currentMonthRevenue || 0}\n`;
  csv += `Revenue Growth,${data.summary.revenueGrowth || 0}%\n`;
  csv += `Collection Rate,${data.summary.collectionRate || 0}%\n`;
  csv += `Average Order Value,${data.summary.avgOrderValue || 0}\n\n`;

  // Top customers
  if (data.customerAnalytics && data.customerAnalytics.topCustomers) {
    csv += 'TOP CUSTOMERS\n';
    csv += 'Name,Phone,Total Purchase,Bills Count,Average Order Value\n';
    data.customerAnalytics.topCustomers.slice(0, 10).forEach(customer => {
      csv += `"${customer.name}",${customer.phone},${customer.totalPurchase},${customer.billCount},${customer.avgOrderValue}\n`;
    });
    csv += '\n';
  }

  // Top products
  if (data.productAnalytics && data.productAnalytics.topSellingProducts) {
    csv += 'TOP SELLING PRODUCTS\n';
    csv += 'Product Name,Quantity Sold,Total Revenue,Profit Margin\n';
    data.productAnalytics.topSellingProducts.slice(0, 10).forEach(product => {
      csv += `"${product.name}",${product.totalQuantitySold},${product.totalRevenue},${product.profitMargin}%\n`;
    });
    csv += '\n';
  }

  return csv;
}

// Get Daily Statistics
const getDailyStatistics = async (req, res) => {
  try {
    const { date } = req.query;

    // Default to today if no date provided
    const selectedDate = date ? new Date(date) : new Date();

    // Set time to start and end of day
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get daily analytics
    const dailyAnalytics = await getDailyAnalytics(startOfDay, endOfDay);

    // Format date for display
    const formattedDate = selectedDate.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    res.render('daily-statistics', {
      title: 'Daily Statistics - Kushi Trader',
      selectedDate: selectedDate.toISOString().split('T')[0], // Format for input[type="date"]
      formattedDate,
      ...dailyAnalytics,
      error: req.flash('error'),
      success: req.flash('success')
    });

  } catch (error) {
    console.error('Get daily statistics error:', error);
    req.flash('error', 'Failed to fetch daily statistics');
    res.redirect('/statistics');
  }
};

// Get Daily Analytics Data
async function getDailyAnalytics(startOfDay, endOfDay) {
  try {
    // Get bills for the selected day
    const dailyBills = await Bill.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).populate('customer');

    // Basic daily metrics
    const totalBills = dailyBills.length;
    const totalRevenue = dailyBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const totalPaid = dailyBills.reduce((sum, bill) => sum + bill.paidAmount, 0);
    const totalCredit = dailyBills.reduce((sum, bill) => sum + bill.remainingAmount, 0);
    const avgOrderValue = totalBills > 0 ? totalRevenue / totalBills : 0;

    // Payment method breakdown
    const cashBills = dailyBills.filter(bill => bill.paymentType === 'Cash');
    const creditBills = dailyBills.filter(bill => bill.paymentType === 'Credit');
    const cashRevenue = cashBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const creditRevenue = creditBills.reduce((sum, bill) => sum + bill.totalAmount, 0);

    // Customer analytics
    const uniqueCustomers = [...new Set(dailyBills.map(bill => bill.customer.phone))];
    const totalCustomers = uniqueCustomers.length;

    // New vs returning customers
    const allCustomers = await Customer.find();
    const newCustomers = [];
    const returningCustomers = [];

    for (const phone of uniqueCustomers) {
      const customer = allCustomers.find(c => c.phone === phone);
      if (customer) {
        const customerBills = await Bill.find({ 'customer.phone': phone });
        const firstBillDate = new Date(Math.min(...customerBills.map(b => new Date(b.createdAt))));

        if (firstBillDate >= startOfDay && firstBillDate <= endOfDay) {
          newCustomers.push(customer);
        } else {
          returningCustomers.push(customer);
        }
      }
    }

    // Product analytics
    const productSales = {};
    const categorySales = {};

    dailyBills.forEach(bill => {
      bill.items.forEach(item => {
        // Product sales
        if (!productSales[item.name]) {
          productSales[item.name] = {
            name: item.name,
            category: item.category,
            quantity: 0,
            revenue: 0,
            orders: 0
          };
        }
        productSales[item.name].quantity += item.quantity;
        productSales[item.name].revenue += item.price * item.quantity;
        productSales[item.name].orders += 1;

        // Category sales
        const category = item.category || 'Uncategorized';
        if (!categorySales[category]) {
          categorySales[category] = {
            quantity: 0,
            revenue: 0,
            orders: 0
          };
        }
        categorySales[category].quantity += item.quantity;
        categorySales[category].revenue += item.price * item.quantity;
        categorySales[category].orders += 1;
      });
    });

    // Top products by different metrics
    const topProductsByQuantity = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const topProductsByRevenue = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Top customers for the day
    const customerSales = {};
    dailyBills.forEach(bill => {
      const customerKey = bill.customer.phone;
      if (!customerSales[customerKey]) {
        customerSales[customerKey] = {
          name: bill.customer.name,
          phone: bill.customer.phone,
          place: bill.customer.place,
          totalAmount: 0,
          billCount: 0,
          paidAmount: 0,
          creditAmount: 0
        };
      }
      customerSales[customerKey].totalAmount += bill.totalAmount;
      customerSales[customerKey].paidAmount += bill.paidAmount;
      customerSales[customerKey].creditAmount += bill.remainingAmount;
      customerSales[customerKey].billCount += 1;
    });

    const topCustomers = Object.values(customerSales)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    // Hourly sales distribution
    const hourlySales = Array(24).fill(0).map((_, hour) => ({
      hour: hour,
      revenue: 0,
      orders: 0
    }));

    dailyBills.forEach(bill => {
      const hour = new Date(bill.createdAt).getHours();
      hourlySales[hour].revenue += bill.totalAmount;
      hourlySales[hour].orders += 1;
    });

    return {
      // Basic metrics
      totalBills,
      totalRevenue,
      totalPaid,
      totalCredit,
      avgOrderValue,

      // Payment breakdown
      cashBills: cashBills.length,
      creditBills: creditBills.length,
      cashRevenue,
      creditRevenue,

      // Customer metrics
      totalCustomers,
      newCustomers: newCustomers.length,
      returningCustomers: returningCustomers.length,

      // Product analytics
      topProductsByQuantity,
      topProductsByRevenue,
      categorySales,

      // Customer analytics
      topCustomers,

      // Time-based analytics
      hourlySales,

      // Detailed data
      dailyBills: dailyBills.slice(0, 20), // Latest 20 bills for display
      newCustomersList: newCustomers.slice(0, 10),
      returningCustomersList: returningCustomers.slice(0, 10)
    };

  } catch (error) {
    console.error('Daily analytics error:', error);
    return {};
  }
}

// Get Date Range Statistics API
const getDateRangeStatistics = async (req, res) => {
  try {
    const { startDate, endDate, period } = req.query;

    let start, end;

    if (period) {
      // Handle predefined periods
      const today = new Date();
      switch (period) {
        case 'today':
          start = new Date(today);
          start.setHours(0, 0, 0, 0);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case 'yesterday':
          start = new Date(today);
          start.setDate(start.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          end = new Date(today);
          end.setDate(end.getDate() - 1);
          end.setHours(23, 59, 59, 999);
          break;
        case 'last7days':
          start = new Date(today);
          start.setDate(start.getDate() - 7);
          start.setHours(0, 0, 0, 0);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case 'last30days':
          start = new Date(today);
          start.setDate(start.getDate() - 30);
          start.setHours(0, 0, 0, 0);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case 'thisMonth':
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        case 'lastMonth':
          start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
          break;
        default:
          start = new Date(today);
          start.setHours(0, 0, 0, 0);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
      }
    } else if (startDate && endDate) {
      // Handle custom date range
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      // Default to today
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    // Get analytics for the date range
    const analytics = await getDateRangeAnalytics(start, end);

    res.json({
      success: true,
      period: period || 'custom',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      ...analytics
    });

  } catch (error) {
    console.error('Get date range statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch date range statistics'
    });
  }
};

// Get Date Range Analytics
async function getDateRangeAnalytics(startDate, endDate) {
  try {
    // Get bills for the date range
    const bills = await Bill.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('customer');

    // Basic metrics
    const totalBills = bills.length;
    const totalRevenue = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const totalPaid = bills.reduce((sum, bill) => sum + bill.paidAmount, 0);
    const totalCredit = bills.reduce((sum, bill) => sum + bill.remainingAmount, 0);
    const avgOrderValue = totalBills > 0 ? totalRevenue / totalBills : 0;

    // Daily breakdown
    const dailyBreakdown = {};
    bills.forEach(bill => {
      const dateKey = new Date(bill.createdAt).toISOString().split('T')[0];
      if (!dailyBreakdown[dateKey]) {
        dailyBreakdown[dateKey] = {
          date: dateKey,
          bills: 0,
          revenue: 0,
          paid: 0,
          credit: 0,
          customers: new Set()
        };
      }
      dailyBreakdown[dateKey].bills += 1;
      dailyBreakdown[dateKey].revenue += bill.totalAmount;
      dailyBreakdown[dateKey].paid += bill.paidAmount;
      dailyBreakdown[dateKey].credit += bill.remainingAmount;
      dailyBreakdown[dateKey].customers.add(bill.customer.phone);
    });

    // Convert sets to counts
    const dailyData = Object.values(dailyBreakdown).map(day => ({
      ...day,
      customers: day.customers.size
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Product analytics
    const productSales = {};
    bills.forEach(bill => {
      bill.items.forEach(item => {
        if (!productSales[item.name]) {
          productSales[item.name] = {
            name: item.name,
            category: item.category,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[item.name].quantity += item.quantity;
        productSales[item.name].revenue += item.price * item.quantity;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Customer analytics
    const uniqueCustomers = [...new Set(bills.map(bill => bill.customer.phone))];

    return {
      summary: {
        totalBills,
        totalRevenue,
        totalPaid,
        totalCredit,
        avgOrderValue,
        totalCustomers: uniqueCustomers.length
      },
      dailyData,
      topProducts,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
      }
    };

  } catch (error) {
    console.error('Date range analytics error:', error);
    return {};
  }
}

module.exports = {
  getStatistics,
  exportStatistics,
  getDailyStatistics,
  getDateRangeStatistics
};

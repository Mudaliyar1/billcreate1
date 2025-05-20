const Bill = require('../models/Bill');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

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
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    req.flash('error', 'Failed to fetch statistics');
    res.redirect('/dashboard');
  }
};

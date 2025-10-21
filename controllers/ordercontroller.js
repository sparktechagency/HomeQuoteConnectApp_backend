const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Option = require("../models/optionModel");
const Coupon = require("../models/couponModel");
const Email = require("../utils/Email");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { getAll, getOne, deleteOne } = require("../utils/handleFactory");

// =============================
// Create Order (Without Coupon)
// =============================
exports.createOrderController = catchAsync(async (req, res, next) => {
  console.log("createOrderController started");
  console.log("req.body:", req.body);

  const productIds = req.body.products.map(
    (p) => new mongoose.Types.ObjectId(p.option)
  );

  console.log("productIds:", productIds);

  const existingOptions = await Option.find({ _id: { $in: productIds } });

  console.log("existingOptions:", existingOptions);

  if (existingOptions.length !== productIds.length) {
    console.log("One or more products not found");
    return next(new AppError("One or more products not found", 404));
  }

  // Aggregate the product prices
  const productAggregation = await Option.aggregate([
    {
      $match: {
        _id: {
          $in: req.body.products.map(
            (item) => new mongoose.Types.ObjectId(item.option)
          ),
        },
      },
    },
    {
      $project: {
        price: 1,
        salePrice: 1,
        freeShipping: 1,
      },
    },
    {
      $addFields: {
        effectivePrice: {
          $cond: {
            if: { $gt: ["$salePrice", 0] },
            then: "$salePrice",
            else: "$price",
          },
        },
      },
    },
  ]);

  console.log("productAggregation:", productAggregation);

  // Calculate the total product cost
  let isFreeShipping = false;

  const productTotal = req.body.products.reduce((total, product) => {
    const option = productAggregation.find((v) =>
      v._id.equals(new mongoose.Types.ObjectId(product.option))
    );

    if (option) {
      if (option.freeShipping === true) isFreeShipping = true;
      return total + option.effectivePrice * product.quantity;
    }

    return total;
  }, 0);

  console.log("productTotal:", productTotal);

  // Add the shipping cost to the total
  if (isFreeShipping) req.body.shippingCost = 0;
  const totalCost = productTotal + req.body.shippingCost;

  console.log("totalCost:", totalCost);

  // Create the order with the calculated total cost
  let order = await Order.create({
    ...req.body,
    totalCost,
    district: req.body.district,
  });

  console.log("order created:", order);

  order = await Order.findById(order._id).populate({
    path: "products.option",
    select: "sku size price salePrice discountType discountValue product variant",
    populate: {
      path: "product variant",
      select: "name colorName colorCode",
    },
  });

  console.log("order populated:", order);

  // Update the sellNumber for each variant in the order
  await Promise.all(
    order.products.map(async (product) => {
      await Option.findByIdAndUpdate(
        product.option._id,
        { $inc: { saleNumber: product.quantity } },
        { new: true }
      );
    })
  );

  console.log("sellNumber updated");

  // Send confirmation email
  try {
    const orderUrl = `${req.protocol}://localhost:5173/orders/${order._id}`;
    // const email = new Email({ email: order.email, name: order.name }, orderUrl);
    const orderAdmin = new Email(
      { email: "sumon4d2@gmail.com", name: order.name },
      orderUrl
    );

    // await email.sendInvoice(order);
    await orderAdmin.sendInvoice(order);
    console.log("email sent");
  } catch (error) {
    console.log("Error sending email:", error);
  }

  res.status(201).json({
    status: "success",
    message: "Order request sent successfully, Check your email inbox please",
    data: { order },
  });
});

// =============================
// Create Order (With Coupon)
// =============================
exports.createOrderWithCouponController = catchAsync(async (req, res, next) => {
  console.log("createOrderWithCouponController started");
  console.log("req.body:", req.body);

  const { coupon, products } = req.body;

  if (!coupon) {
    console.log("You need to enter a coupon code to use this route");
    return next(
      new AppError("You need to enter a coupon code to use this route", 400)
    );
  }

  // Check if the coupon is valid
  const couponData = await Coupon.findOne({
    coupon,
    isActive: true,
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  });

  console.log("couponData:", couponData);

  if (!couponData) {
    console.log("Invalid or expired coupon");
    return next(new AppError("Invalid or expired coupon", 400));
  }

  const productIds = products.map((p) => new mongoose.Types.ObjectId(p.option));
  console.log("productIds:", productIds);

  const existingOptions = await Option.find({ _id: { $in: productIds } });
  console.log("existingOptions:", existingOptions);

  if (existingOptions.length !== productIds.length) {
    console.log("One or more products not found");
    return next(new AppError("One or more products not found", 404));
  }

  // Aggregate the product prices
  const productAggregation = await Option.aggregate([
    {
      $match: {
        _id: {
          $in: products.map((item) => new mongoose.Types.ObjectId(item.option)),
        },
      },
    },
    {
      $project: {
        price: 1,
        salePrice: 1,
        freeShipping: 1,
      },
    },
  ]);

  console.log("productAggregation:", productAggregation);

  // Calculate the total product cost
  let isFreeShipping = false;

  const productTotal = products.reduce((total, product) => {
    const option = productAggregation.find((v) =>
      v._id.equals(new mongoose.Types.ObjectId(product.option))
    );

    if (option) {
      if (option.freeShipping === true) isFreeShipping = true;
      return total + option.price * product.quantity;
    }

    return total;
  }, 0);

  console.log("productTotal:", productTotal);

  // Calculate discount
  const couponDiscount = (productTotal * couponData.discountPercent) / 100;
  const discountedProductTotal = productTotal - couponDiscount;

  console.log("couponDiscount:", couponDiscount);
  console.log("discountedProductTotal:", discountedProductTotal);

  // Calculate final total cost
  if (isFreeShipping) req.body.shippingCost = 0;
  const totalCost = discountedProductTotal + req.body.shippingCost;

  console.log("totalCost:", totalCost);

  // Create the order
  let order = await Order.create({
    ...req.body,
    totalCost,
    couponDiscount,
    district: req.body.district,
  });

  console.log("order created:", order);

  order = await Order.findById(order._id)
    .populate({
      path: "products.option",
      select: "sku size price salePrice discountType discountValue product variant",
      populate: {
        path: "product variant",
        select: "name colorName colorCode",
      },
    })
    .select("-__v");

  console.log("order populated:", order);

  // Update sale numbers
  await Promise.all(
    order.products.map(async (product) => {
      await Option.findByIdAndUpdate(
        product.option._id,
        { $inc: { sellNumber: product.quantity } },
        { new: true }
      );
    })
  );

  console.log("sellNumber updated");

  // Send confirmation email
  try {
    const orderUrl = `${req.protocol}://localhost:5173/orders/${order._id}`;
    const email = new Email({ email: order.email, name: order.name }, orderUrl);
    await email.sendInvoiceWithCoupon(order, couponData.discountPercent);
    console.log("email sent");
  } catch (error) {
    console.log("Error sending email:", error);
  }

  res.status(201).json({
    status: "success",
    message: "Order request sent successfully, Check your email inbox please",
    data: { order },
  });
});

// =============================
// Other Controllers
// =============================
exports.getAllOrdersController = getAll(Order, {
  path: "products.option",
  select: "-__v",
  populate: {
    path: "category subCategory brand product variant",
    select: "title name colorName colorCode",
  },
});

exports.getOrderController = getOne(Order, {
  path: "products.option",
  select: "-__v",
  populate: {
    path: "category subCategory brand product variant",
    select: "title name colorName colorCode",
  },
});

exports.updateOrderController = catchAsync(async (req, res, next) => {
  const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })
    .populate({
      path: "products.option",
      select: "sku size price salePrice discountType discountValue",
      populate: {
        path: "product variant",
        select: "name colorName colorCode",
      },
    })
    .select("-__v");

  if (!order) return next(new AppError("No order found with that ID!", 404));

  const orderUrl = `${req.protocol}://localhost:5173/orders/${order._id}`;
  const email = new Email({ email: order?.email, name: order.name }, orderUrl);

  const { orderStatus } = req.body;
  if (["approved", "delivered", "shipped", "canceled"].includes(orderStatus)) {
    // await email.sendInvoice(order);
  }

  res.status(200).json({
    status: "success",
    message: "Order has been updated successfully",
    data: { order },
  });
});

exports.deleteOrderController = deleteOne(Order);

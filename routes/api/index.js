const express = require("express");
const _ = express.Router();
const authRouter = require("./authRoutes.js");
const profileRoutes = require("./profileRoutes.js")
const jobRoutes = require("./jobRoutes.js")
const quoteRoutes = require("./quoteRoutes.js")
const providerRoutes = require("./profileRoutes.js")
const payments = require('./paymentRoutes.js');
const reviews = require('./reviewRoutes.js');
const support = require('./supportRoutes.js');
const admin = require('./adminRoutes.js');
const subscriptions = require ('./subscriptionRoutes.js');
const popular = require('./popularRoutes.js');
const adminCategoryRoutes = require('./adminCategoryRoutes.js');
const categories = require('./categoryRoutes.js');
const adminPaymentRoutes= require('./adminPaymentRoutes.js');

_.use("/auth", authRouter);
_.use('/profile', profileRoutes);
_.use('/jobs', jobRoutes);
_.use('/quotes', quoteRoutes);
_.use('/provider', providerRoutes);
_.use('/payments', payments);
_.use('/payments/webhook', express.raw({type: 'application/json'}));
_.use('/reviews', reviews);
_.use('/support', support);
_.use('/admin', admin);
_.use('/subscriptions', subscriptions);
_.use('/popular', popular);
_.use('/categories', categories);
_.use('/admin', adminCategoryRoutes);
_.use('/admin', adminPaymentRoutes);



// app.set('io', io);


module.exports = _;

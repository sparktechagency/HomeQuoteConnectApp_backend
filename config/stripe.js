// config/stripe.js
const Stripe = require('stripe');
const { STRIPE_SECRET_KEY } = require('./env');

const stripe = Stripe(STRIPE_SECRET_KEY);

// Create Stripe Connect account for provider
const createConnectAccount = async (user) => {
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: user.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: 'individual',
      individual: {
        email: user.email,
        first_name: user.fullName.split(' ')[0],
        last_name: user.fullName.split(' ').slice(1).join(' ') || '',
        phone: user.phoneNumber,
      },
      business_profile: {
        url: 'https://raza-home-quote-connect.com',
        mcc: '1520', // General contractors
      },
    });

    return account;
  } catch (error) {
    console.error('Stripe Connect account creation error:', error);
    throw new Error(`Failed to create Stripe account: ${error.message}`);
  }
};

// Create account link for onboarding
const createAccountLink = async (accountId, refreshUrl, returnUrl) => {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return accountLink;
  } catch (error) {
    console.error('Stripe account link creation error:', error);
    throw new Error(`Failed to create account link: ${error.message}`);
  }
};

// Create payment intent
const createPaymentIntent = async (amount, currency = 'usd', metadata = {}) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata,
    });

    return paymentIntent;
  } catch (error) {
    console.error('Stripe payment intent creation error:', error);
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }
};

// Transfer funds to provider
const transferToProvider = async (amount, destinationAccount, metadata = {}) => {
  try {
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      destination: destinationAccount,
      metadata,
    });

    return transfer;
  } catch (error) {
    console.error('Stripe transfer error:', error);
    throw new Error(`Failed to transfer funds: ${error.message}`);
  }
};

// Create payout
const createPayout = async (amount, stripeAccountId) => {
  try {
    const payout = await stripe.payouts.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
    }, {
      stripeAccount: stripeAccountId,
    });

    return payout;
  } catch (error) {
    console.error('Stripe payout error:', error);
    throw new Error(`Failed to create payout: ${error.message}`);
  }
};

module.exports = {
  stripe,
  createConnectAccount,
  createAccountLink,
  createPaymentIntent,
  transferToProvider,
  createPayout,
};
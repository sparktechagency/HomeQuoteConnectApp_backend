// utils/popularProviders.js
const User = require('../models/User');
const Review = require('../models/Review');
const Job = require('../models/Job');
const Quote = require('../models/Quote');

// Calculate provider popularity score
const calculatePopularityScore = async (provider) => {
  let score = 0;
  
  // Base score for verification (50 points)
  if (provider.verificationStatus === 'verified') {
    score += 50;
  }
  
  // Score for completed jobs (10 points per job)
  score += provider.totalCompletedJobs * 10;
  
  // Score for rating (20 points per star average)
  score += provider.averageRating * 20;
  
  // Score for response rate (based on quote acceptance)
  const responseRate = await calculateResponseRate(provider._id);
  score += responseRate * 30;
  
  // Score for recent activity (5 points per active job in last 30 days)
  const recentActivity = await calculateRecentActivity(provider._id);
  score += recentActivity * 5;
  
  // Bonus for subscription (25 points for active subscription)
  const hasActiveSubscription = await checkActiveSubscription(provider._id);
  if (hasActiveSubscription) {
    score += 25;
  }
  
  return Math.round(score);
};

// Calculate response rate (percentage of quotes that lead to accepted jobs)
const calculateResponseRate = async (providerId) => {
  const totalQuotes = await Quote.countDocuments({ provider: providerId });
  const acceptedQuotes = await Quote.countDocuments({ 
    provider: providerId, 
    status: 'accepted' 
  });
  
  if (totalQuotes === 0) return 0;
  return (acceptedQuotes / totalQuotes) * 100;
};

// Calculate recent activity (number of active jobs in last 30 days)
const calculateRecentActivity = async (providerId) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const activeJobs = await Job.countDocuments({
    'acceptedQuote.provider': providerId,
    status: 'in_progress',
    updatedAt: { $gte: thirtyDaysAgo }
  });
  
  return activeJobs;
};

// Check if provider has active subscription
const checkActiveSubscription = async (providerId) => {
  const UserSubscription = require('../models/UserSubscription');
  
  const activeSubscription = await UserSubscription.findOne({
    user: providerId,
    status: 'active',
    endDate: { $gt: new Date() }
  });
  
  return !!activeSubscription;
};

// Get popular providers with pagination and filtering
const getPopularProviders = async (options = {}) => {
  const {
    page = 1,
    limit = 10,
    serviceCategory,
    specializations,
    minRating = 0,
    maxDistance,
    latitude,
    longitude,
    experienceLevel,
    sortBy = 'popularity'
  } = options;

  // Build base filter for providers
  const filter = {
    role: 'provider',
    verificationStatus: 'verified',
    isBlocked: false
  };

  // Additional filters
  if (serviceCategory) {
    filter.serviceCategory = serviceCategory;
  }

  if (specializations) {
    const specArray = Array.isArray(specializations) ? specializations : specializations.split(',');
    filter.specializations = { $in: specArray };
  }

  if (experienceLevel) {
    filter.experienceLevel = experienceLevel;
  }

  if (minRating > 0) {
    filter.averageRating = { $gte: minRating };
  }

  // Get all providers that match basic filters
  let providers = await User.find(filter)
    .select('fullName profilePhoto businessName experienceLevel specializations serviceAreas averageRating totalReviews totalCompletedJobs verificationStatus location credits isOnline lastActive')
    .populate('specializations', 'title category')
    .lean();

  // Calculate popularity scores and add location-based filtering
  const providersWithScores = await Promise.all(
    providers.map(async (provider) => {
      const popularityScore = await calculatePopularityScore(provider);
      
      // Calculate distance if coordinates provided
      let distance = null;
      if (latitude && longitude && provider.location && provider.location.coordinates) {
        distance = calculateDistance(
          latitude,
          longitude,
          provider.location.coordinates[1], // latitude
          provider.location.coordinates[0]  // longitude
        );
      }

      return {
        ...provider,
        popularityScore,
        distance
      };
    })
  );

  // Apply distance filter
  let filteredProviders = providersWithScores;
  if (maxDistance && latitude && longitude) {
    filteredProviders = providersWithScores.filter(provider => 
      provider.distance !== null && provider.distance <= maxDistance
    );
  }

  // Sort providers
  const sortedProviders = filteredProviders.sort((a, b) => {
    switch (sortBy) {
      case 'popularity':
        return b.popularityScore - a.popularityScore;
      case 'rating':
        return b.averageRating - a.averageRating;
      case 'experience':
        const experienceOrder = { 'expert': 4, 'advanced': 3, 'intermediate': 2, 'beginner': 1 };
        return (experienceOrder[b.experienceLevel] || 0) - (experienceOrder[a.experienceLevel] || 0);
      case 'distance':
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      default:
        return b.popularityScore - a.popularityScore;
    }
  });

  // Apply pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedProviders = sortedProviders.slice(startIndex, endIndex);

  // Populate with additional data (reviews, etc.)
  const populatedProviders = await Promise.all(
    paginatedProviders.map(async (provider) => {
      const recentReviews = await Review.find({
        reviewedUser: provider._id,
        reviewType: 'client_to_provider'
      })
      .populate('reviewer', 'fullName profilePhoto')
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

      const totalJobs = await Job.countDocuments({
        'acceptedQuote.provider': provider._id,
        status: 'completed'
      });

      return {
        ...provider,
        recentReviews,
        totalJobs,
        responseRate: await calculateResponseRate(provider._id)
      };
    })
  );

  return {
    providers: populatedProviders,
    pagination: {
      current: page,
      pages: Math.ceil(filteredProviders.length / limit),
      total: filteredProviders.length
    }
  };
};

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
};

// Update provider popularity scores (run periodically)
const updateAllProviderPopularityScores = async () => {
  const providers = await User.find({ role: 'provider' }).select('_id');
  
  for (const provider of providers) {
    const popularityScore = await calculatePopularityScore(provider);
    // Store popularity score in user document or cache
    await User.findByIdAndUpdate(provider._id, {
      $set: { popularityScore }
    });
  }
  
  console.log(`Updated popularity scores for ${providers.length} providers`);
};

module.exports = {
  calculatePopularityScore,
  getPopularProviders,
  updateAllProviderPopularityScores,
  calculateResponseRate
};
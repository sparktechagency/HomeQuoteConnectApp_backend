# Popular Providers API Documentation

## Endpoint: Get Popular Providers

**URL:** `GET /api/popular/providers`

**Authentication:** Not required (Public endpoint)

**Description:** Search and filter verified service providers with comprehensive filtering, sorting, and pagination options.

---

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | Number | No | 1 | Page number for pagination |
| `limit` | Number | No | 10 | Number of items per page |
| `searchQuery` | String | No | - | Search by provider name or business name (case-insensitive) |
| `serviceCategory` | String | No | - | Filter by service category ID |
| `specializations` | String/Array | No | - | Filter by specialization IDs (comma-separated or array) |
| `minRating` | Number | No | 0 | Minimum average rating (0-5) |
| `maxRating` | Number | No | - | Maximum average rating (0-5) |
| `experienceLevel` | String | No | - | Filter by experience level: `beginner`, `intermediate`, `advanced`, `expert` |
| `city` | String | No | - | Filter by city name (case-insensitive partial match) |
| `state` | String | No | - | Filter by state name (case-insensitive partial match) |
| `latitude` | Number | No | - | Latitude for distance-based filtering (requires longitude) |
| `longitude` | Number | No | - | Longitude for distance-based filtering (requires latitude) |
| `maxDistance` | Number | No | - | Maximum distance in kilometers (requires latitude & longitude) |
| `isOnline` | Boolean | No | - | Filter by online status: `true` or `false` |
| `sortBy` | String | No | `popularity` | Sort order. See sorting options below |

### Sorting Options

| Value | Description |
|-------|-------------|
| `popularity` | Sort by calculated popularity score (default) |
| `rating` | Sort by average rating (highest first) |
| `reviews` | Sort by total number of reviews (most first) |
| `jobs` | Sort by total completed jobs (most first) |
| `experience` | Sort by experience level (expert first) |
| `distance` | Sort by distance from coordinates (nearest first) |
| `latest` | Sort by registration date (newest first) |
| `online` | Prioritize online providers, then by popularity |

---

## Response Structure

```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "_id": "provider_id",
        "fullName": "John Doe",
        "businessName": "John's Plumbing Services",
        "profilePhoto": {
          "public_id": "cloudinary_id",
          "url": "https://cloudinary.com/image.jpg"
        },
        "bio": "Professional plumber with 10+ years experience",
        "experienceLevel": "expert",
        "specializations": [
          {
            "_id": "spec_id",
            "title": "Residential Plumbing",
            "category": "category_id"
          }
        ],
        "serviceAreas": ["New York", "Brooklyn", "Queens"],
        "averageRating": 4.8,
        "totalReviews": 127,
        "totalCompletedJobs": 245,
        "verificationStatus": "verified",
        "location": {
          "type": "Point",
          "coordinates": [-73.935242, 40.730610],
          "address": "123 Main St",
          "city": "New York",
          "state": "NY",
          "country": "USA",
          "zipCode": "10001"
        },
        "isOnline": true,
        "lastActive": "2024-01-15T10:30:00.000Z",
        "createdAt": "2023-01-01T00:00:00.000Z",
        "popularityScore": 485,
        "distance": 2.3,
        "recentReviews": [
          {
            "_id": "review_id",
            "rating": 5,
            "comment": "Excellent service!",
            "reviewer": {
              "_id": "client_id",
              "fullName": "Jane Smith",
              "profilePhoto": {
                "url": "https://cloudinary.com/profile.jpg"
              }
            },
            "createdAt": "2024-01-10T15:20:00.000Z"
          }
        ],
        "totalJobs": 245,
        "responseRate": 92.5
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 47,
      "itemsPerPage": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  },
  "message": "Popular providers fetched successfully"
}
```

---

## Example Requests

### 1. Basic Search - Get First Page

```bash
GET /api/popular/providers
```

**Response:** Returns 10 most popular verified providers sorted by popularity score.

---

### 2. Search by Name

```bash
GET /api/popular/providers?searchQuery=john
```

**Description:** Find providers with "john" in their full name or business name.

**Use Case:** User types in search bar to find specific provider.

---

### 3. Filter by Rating Range

```bash
GET /api/popular/providers?minRating=4&maxRating=5&sortBy=rating
```

**Description:** Get only highly-rated providers (4-5 stars), sorted by rating.

**Use Case:** Client wants to hire only top-rated professionals.

---

### 4. Filter by Location and Service Category

```bash
GET /api/popular/providers?city=New%20York&serviceCategory=plumbing_category_id&limit=20
```

**Description:** Find plumbing providers in New York, show 20 results per page.

**Use Case:** Client needs local service provider in specific city.

---

### 5. Distance-Based Search

```bash
GET /api/popular/providers?latitude=40.7128&longitude=-74.0060&maxDistance=10&sortBy=distance
```

**Description:** Find providers within 10km of coordinates, sorted by nearest first.

**Use Case:** Mobile app with GPS - find nearby providers.

---

### 6. Filter by Experience and Online Status

```bash
GET /api/popular/providers?experienceLevel=expert&isOnline=true&sortBy=online
```

**Description:** Find expert-level providers who are currently online.

**Use Case:** Client needs immediate consultation from experienced provider.

---

### 7. Advanced Multi-Filter Search

```bash
GET /api/popular/providers?searchQuery=electrician&city=Los%20Angeles&state=CA&minRating=4.5&experienceLevel=advanced&isOnline=true&sortBy=reviews&page=1&limit=15
```

**Description:** Complex search combining:
- Text search: "electrician"
- Location: Los Angeles, CA
- Quality: Minimum 4.5 stars
- Experience: Advanced level
- Availability: Currently online
- Sort by: Most reviewed first
- Pagination: 15 items per page

**Use Case:** Client has very specific requirements and wants best matches.

---

### 8. Get Latest Registered Providers

```bash
GET /api/popular/providers?sortBy=latest&limit=5
```

**Description:** Get 5 newest verified providers on the platform.

**Use Case:** "New on platform" featured section in app.

---

### 9. Filter by Specializations

```bash
GET /api/popular/providers?specializations=spec1_id,spec2_id,spec3_id&sortBy=jobs
```

**Description:** Find providers with specific specializations, sorted by completed jobs count.

**Use Case:** Client needs provider with multiple specific skills.

---

### 10. Pagination Example

```bash
# First page
GET /api/popular/providers?page=1&limit=10

# Second page
GET /api/popular/providers?page=2&limit=10

# Third page
GET /api/popular/providers?page=3&limit=10
```

**Description:** Navigate through results using page parameter.

**Use Case:** "Load More" or pagination UI in frontend.

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid parameters provided",
  "error": "maxDistance requires both latitude and longitude"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to fetch popular providers",
  "error": "Database connection error"
}
```

---

## Notes

1. **Combining Filters:** All filters can be combined together. The API uses AND logic (all conditions must match).

2. **Performance:** 
   - Distance calculations are performed for all results when lat/lon provided
   - Consider limiting results with `maxDistance` for better performance
   - Text search uses regex - may be slower on large datasets

3. **Popularity Score Calculation:**
   - Verification status: +50 points
   - Completed jobs: +10 per job
   - Rating: +20 per star average
   - Response rate: +30 points (based on quote acceptance)
   - Recent activity: +5 per active job in last 30 days
   - Active subscription: +25 points

4. **Online Status:** 
   - `isOnline` reflects real-time provider availability
   - Updates when provider logs in/out of the app
   - `lastActive` shows last activity timestamp

5. **Distance Calculation:**
   - Uses Haversine formula for accurate Earth distance
   - Returns distance in kilometers
   - Requires valid latitude/longitude coordinates

6. **Rate Limiting:** Consider implementing rate limiting for this public endpoint to prevent abuse.

---

## Postman Collection Setup

### Base URL
```
http://localhost:5000/api/popular
```
or
```
https://your-production-domain.com/api/popular
```

### Create Environment Variables
- `base_url`: Your API base URL
- `provider_id`: Test provider ID for detail endpoint
- `category_id`: Test service category ID
- `spec_id`: Test specialization ID

### Import Collection
Save the following as `popular-providers.postman_collection.json`:

```json
{
  "info": {
    "name": "Popular Providers API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Popular Providers - Basic",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/providers",
          "host": ["{{base_url}}"],
          "path": ["providers"]
        }
      }
    },
    {
      "name": "Search by Name",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/providers?searchQuery=john",
          "host": ["{{base_url}}"],
          "path": ["providers"],
          "query": [
            {
              "key": "searchQuery",
              "value": "john"
            }
          ]
        }
      }
    },
    {
      "name": "Filter by Rating Range",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/providers?minRating=4&maxRating=5&sortBy=rating",
          "host": ["{{base_url}}"],
          "path": ["providers"],
          "query": [
            {
              "key": "minRating",
              "value": "4"
            },
            {
              "key": "maxRating",
              "value": "5"
            },
            {
              "key": "sortBy",
              "value": "rating"
            }
          ]
        }
      }
    },
    {
      "name": "Distance-Based Search",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/providers?latitude=40.7128&longitude=-74.0060&maxDistance=10&sortBy=distance",
          "host": ["{{base_url}}"],
          "path": ["providers"],
          "query": [
            {
              "key": "latitude",
              "value": "40.7128"
            },
            {
              "key": "longitude",
              "value": "-74.0060"
            },
            {
              "key": "maxDistance",
              "value": "10"
            },
            {
              "key": "sortBy",
              "value": "distance"
            }
          ]
        }
      }
    },
    {
      "name": "Online Expert Providers",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/providers?experienceLevel=expert&isOnline=true&sortBy=online",
          "host": ["{{base_url}}"],
          "path": ["providers"],
          "query": [
            {
              "key": "experienceLevel",
              "value": "expert"
            },
            {
              "key": "isOnline",
              "value": "true"
            },
            {
              "key": "sortBy",
              "value": "online"
            }
          ]
        }
      }
    },
    {
      "name": "Advanced Multi-Filter",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/providers?searchQuery=electrician&city=Los Angeles&state=CA&minRating=4.5&experienceLevel=advanced&isOnline=true&sortBy=reviews&page=1&limit=15",
          "host": ["{{base_url}}"],
          "path": ["providers"],
          "query": [
            {
              "key": "searchQuery",
              "value": "electrician"
            },
            {
              "key": "city",
              "value": "Los Angeles"
            },
            {
              "key": "state",
              "value": "CA"
            },
            {
              "key": "minRating",
              "value": "4.5"
            },
            {
              "key": "experienceLevel",
              "value": "advanced"
            },
            {
              "key": "isOnline",
              "value": "true"
            },
            {
              "key": "sortBy",
              "value": "reviews"
            },
            {
              "key": "page",
              "value": "1"
            },
            {
              "key": "limit",
              "value": "15"
            }
          ]
        }
      }
    },
    {
      "name": "Get Provider Details",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/providers/{{provider_id}}",
          "host": ["{{base_url}}"],
          "path": ["providers", "{{provider_id}}"]
        }
      }
    }
  ]
}
```

---

## Testing Checklist

- [ ] Basic pagination works (page 1, 2, 3...)
- [ ] Search by name returns relevant results
- [ ] Rating filters work (min, max, both)
- [ ] Location filters work (city, state)
- [ ] Distance-based search calculates correctly
- [ ] Experience level filter returns correct providers
- [ ] Online status filter works
- [ ] All sort options work correctly
- [ ] Combining multiple filters returns expected results
- [ ] Empty results handled gracefully
- [ ] Invalid parameters return proper error messages
- [ ] Pagination metadata is accurate
- [ ] Response time is acceptable (< 2 seconds)

---

## Frontend Integration Examples

### React Example
```javascript
const fetchProviders = async (filters) => {
  const queryParams = new URLSearchParams({
    page: filters.page || 1,
    limit: filters.limit || 10,
    ...(filters.searchQuery && { searchQuery: filters.searchQuery }),
    ...(filters.city && { city: filters.city }),
    ...(filters.minRating && { minRating: filters.minRating }),
    ...(filters.sortBy && { sortBy: filters.sortBy })
  });

  const response = await fetch(`/api/popular/providers?${queryParams}`);
  const data = await response.json();
  
  return data;
};

// Usage
const result = await fetchProviders({
  searchQuery: 'plumber',
  city: 'New York',
  minRating: 4,
  sortBy: 'rating',
  page: 1
});
```

### Angular Example
```typescript
getProviders(filters: any): Observable<any> {
  let params = new HttpParams()
    .set('page', filters.page || '1')
    .set('limit', filters.limit || '10');
    
  if (filters.searchQuery) {
    params = params.set('searchQuery', filters.searchQuery);
  }
  if (filters.city) {
    params = params.set('city', filters.city);
  }
  // Add other filters...
  
  return this.http.get('/api/popular/providers', { params });
}
```

---

## Version History

- **v1.1** (Current) - Added searchQuery, maxRating, city, state, isOnline filters; Enhanced sorting options
- **v1.0** - Initial release with basic filters (serviceCategory, specializations, minRating, distance, experienceLevel)

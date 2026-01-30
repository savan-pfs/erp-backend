# Cultivation Compass Backend

A Node.js/Express.js backend for the Cultivation Compass agricultural management system with PostgreSQL database.

## Features

- **Authentication**: JWT-based authentication with role-based access control
- **User Management**: Admin, Farmer, and Expert roles
- **Farm Management**: CRUD operations for farms
- **Crop Management**: Complete crop lifecycle tracking
- **Database**: PostgreSQL with migration system
- **Security**: Helmet, CORS, rate limiting, input validation

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Install PostgreSQL and create database:
```sql
CREATE DATABASE cultivation_compass;
```

4. Run database migrations:
```bash
npm run migrate
```

5. Seed database with initial data:
```bash
npm run seed
```

6. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

The backend will be available at `http://localhost:3004` with API health check at `/api/health`.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users` - Get all users (admin only)
- `PUT /api/users/:id/deactivate` - Deactivate user (admin only)

### Farms
- `GET /api/farms` - Get user's farms
- `GET /api/farms/:id` - Get specific farm
- `POST /api/farms` - Create new farm
- `PUT /api/farms/:id` - Update farm
- `DELETE /api/farms/:id` - Delete farm (soft delete)

### Crops
- `GET /api/crops` - Get user's crops (with optional filters)
- `GET /api/crops/:id` - Get specific crop
- `POST /api/crops` - Create new crop
- `PUT /api/crops/:id` - Update crop
- `DELETE /api/crops/:id` - Delete crop

## Default Credentials

After seeding, you can use these credentials:

- **Admin**: savan@google.com / savan1234
- **Farmer**: ramesh@farm.com / password123
- **Expert**: expert@agri.com / password123

## Database Schema

### Users
- id, email, password_hash, first_name, last_name, phone, role, is_active, timestamps

### Farms
- id, user_id, name, description, location_address, latitude, longitude, total_area, soil_type, water_source, ownership_type, is_active, timestamps

### Crops
- id, farm_id, crop_name, variety, planting_date, expected_harvest_date, actual_harvest_date, area_planted, planting_method, irrigation_method, fertilizer_used, pesticide_used, growth_stage, health_status, notes, timestamps

## Environment Variables

```
PORT=3004
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cultivation_compass
DB_USER=postgres
DB_PASSWORD=your_password_here
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3003
```

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with initial data

## Security Features

- Password hashing with bcryptjs
- JWT authentication
- Role-based access control
- Input validation with Joi
- Rate limiting
- CORS protection
- Helmet security headers

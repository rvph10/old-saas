# Nibblix Server

A comprehensive restaurant management system backend built with NestJS, providing robust authentication, real-time features, and scalable architecture.

## 🚀 Tech Stack

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis
- **Authentication**: JWT + Session-based with 2FA support
- **Real-time**: Socket.io
- **Email**: NodeMailer
- **Testing**: Jest + Supertest
- **Documentation**: Swagger/OpenAPI
- **Monitoring**: Prometheus + Grafana
- **CI/CD**: GitHub Actions
- **Containerization**: Docker & Kubernetes

## 📋 Prerequisites

- Node.js (v18+)
- PostgreSQL
- Redis
- Docker (optional)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/rvph10/nibblix.git
cd nibblix/server
npm install
cp .env.example .env
# Edit .env with your configurations
```

## 🔐 Authentication Features

- User registration with email verification
- Login with username/email
- Two-factor authentication (2FA)
- Session management with device tracking
- Password reset functionality
- Account security (rate limiting, brute force protection)
- Role-based access control

## 🔍 Health Checks

Health check endpoint available at:
```bash
GET /health
```
## ⚙️ Environment Variables

Key environment variables needed:

```env
# Application
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nibblix

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=1d

# Redis
REDIS_URL=redis://localhost:6379

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_username
SMTP_PASS=your_password
SMTP_FROM=noreply@example.com

# Security
CORS_ORIGIN=http://localhost:3000
```

## 🚧 Development Status
Currently in active development. Features are being added regularly.
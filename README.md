# 💊 Pharmaca – Multi-Vendor E-Commerce Platform for Medicines and Healthcare Products

Pharmaca is a modern, multi-vendor e-commerce platform built for the distribution and sale of medicines and healthcare products. It supports customer browsing, seller dashboards, admin controls, and secure online payments through Stripe.

## 🌐 Live Demo

[🔗 View Live Site](https://pharmaca-e18bf.web.app)

---

## 📖 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Usage](#usage)
- [Screenshots](#screenshots)
- [Troubleshooting](#troubleshooting)
- [Contributors](#contributors)

---

## ✅ Features

- 🔐 **User Authentication** via Firebase and JWT
- 🧑‍💼 **Seller Dashboard** for managing inventory
- 🛒 **Cart System** and Stripe Payment Integration
- 📦 **Order History** and live tracking
- 📊 **Admin Panel** for centralized control
- 🌐 **Responsive UI** using Tailwind CSS
- 📆 **Date pickers**, PDF export, and reporting tools
- 📈 **Sales charts and analytics** with Recharts
- 🧩 **Modular and scalable architecture**

---

## 🛠 Tech Stack

### 🧑‍🎨 Frontend

- **React** `^18.3.1`
- **React Router** `^7.1.1`
- **Tailwind CSS** `^3.4.17`
- **Vite** `^6.0.5`
- **Radix UI** Components
- **Lucide React** Icons
- **React Hook Form**, **TanStack Query**, **Swiper**, **Recharts**

### 🔌 APIs & Services

- **Firebase** (Authentication)
- **Stripe** (Payment Gateway)
- **Axios** (API Calls)

### 🧪 Development Tools

- **ESLint** with React plugins
- **PostCSS**, **Autoprefixer**
- **Tailwind Merge**, **Tailwind Animate**

---

## ⚙️ Getting Started

### 🔧 Prerequisites

- Node.js (v18+ recommended)
- MongoDB (local or Atlas)
- Firebase Project
- Stripe Account
- Vercel Project

---

### 📦 Installation

```bash
# Clone the repository
git clone https://github.com/PrapooRozario/pharmaca-server.git

# Install backend dependencies
npm install

# Create .env file
pharmaca-server/.env

MONGO_URI="your-mongodb-uri"
PAYMENT_SECRET_KEY="your-stripe-secret-key"
JWT_SECRET_TOKEN="your-jwt-secret-key"

```

### 📜 Available Scripts

```bash
In the /pharmaca-server directory, you can run:

nodemon index.js
Runs the development server using Vite.

vercel --prod
Deploy the server for production.

```

### 🚀 Usage

Seller Demo Account
Email: seller@gmail.com

Password: Seller@2025

Admin Demo Account
Email: admin@gmail.com

Password: Admin@2025

Use this to explore the seller dashboard and product management features.

![Homepage](https://i.ibb.co.com/7xfqvY1V/Screenshot-from-2025-05-04-01-23-40.png)
![Product List](https://i.ibb.co.com/KBN1zhd/Screenshot-from-2025-05-04-01-47-41.png)
![Seller Dashboard](https://i.ibb.co.com/dsKw3kQn/Screenshot-from-2025-05-04-01-51-05.png)
![Admin Panel](https://i.ibb.co.com/vCgpFCNg/Screenshot-from-2025-05-04-01-48-39.png)

### 🐞 Troubleshooting

- Firebase Auth Errors: Ensure the Firebase project has email/password auth enabled.

- MongoDB Errors: Check the URI and allow access from your IP.

- CORS Issues: Confirm that the backend includes proper CORS middleware.

- Stripe Errors: Use valid test keys and test cards (e.g., 4242 4242 4242 4242).

### 👥 Contributors

Prapoo Rozario

### 🙏 Acknowledgements

- Firebase Docs

- Stripe API

- Radix UI

- React Query

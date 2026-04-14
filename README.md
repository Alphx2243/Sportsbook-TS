# SportsBook - User Website
SportsBook is a campus sports management ecosystem built with **Next.js**, **React**, and **Socket.io**. It provides a real-time interface for facility bookings, live match tracking, and occupancy heatmaps.

## Architecture
The project is divided into three specialized platforms for optimal performance:

- **User Platform (Root)**: The main interface for students. ([Link](https://sportsbook-user.onrender.com/))
- **Admin Portal**: Dedicated dashboard for booking & inventory management ([Link](https://sportsbook-admin.onrender.com/)).
- **Socket Server**: Centralized WebSocket hub for the entire platform.


## Key Features
### Real-time
*   **Live Scoreboards**: Instant match updates across the campus.
*   **Realtime Occupancy visiblity**: Heatmaps and live density tracking.
*   **Realtime Availability of resources**: Immediate updates for booking changes.
### Scheduling
*   **QR-Integrated Check-ins**: Automated check-in/out via QR codes.
*   **Conflict-Free Booking**: Robust system to prevent overlapping sessions.
*   **Relaible Returns**: Integrated workflow for sports equipment management.
### Security
*   **Rate Limiting**: Custom Next.js Edge Middleware restricts traffic to prevent API abuse, allowing a maximum of 30 requests per minute per IP, and a global cap of 500 requests per minute.
## 🛠️ The Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, Framer Motion
- **Database**: PostgreSQL (Prisma ORM)
- **Real-time**: Socket.io (Standalone Node.js Server)
- **Styling**: Tailwind CSS

## 🚀 Start guide
### 1. Installation
```bash
npm install # Install root dependencies
```
### 2. Environment Configuration
Create a `.env` in the root:
```env
DATABASE_URL="" 
JWT_SECRET=""
NEXT_PUBLIC_SOCKET_URL=""
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
```

### 3. Execution
```bash
npm run dev # To run the project
```

## Test credentials:
1) User:

    Email : alphx@iiitd.ac.in

    Password : aforapple 

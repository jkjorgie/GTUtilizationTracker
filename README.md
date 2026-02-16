# GT Utilization Tracker

A comprehensive web application for tracking consultant utilization, project allocations, and PTO management. Built with Next.js 14, React, Tailwind CSS, and PostgreSQL.

## Features

- **Utilization Grid**: Interactive grid view showing consultant allocations by week
  - Toggle between Actuals, Projected, and Difference views
  - Color-coded cells for under/normal/over utilization
  - Hover tooltips with allocation details
  - Click-to-edit functionality for adding/modifying allocations
  - Filter by role, group, and name

- **Project Management**: Full CRUD for project timecodes
  - Track client, project name, timecode, type, and status
  - Filter by project type (Billable, Assigned, Filler, Projected)
  - Filter by status (Active, Inactive)

- **Consultant Management**: Full CRUD for consultant records
  - Multi-select groups (SA, BA, Tech, UX, AI)
  - Multi-select roles (Level 2-5, Lead)
  - Standard hours, overtime preferences, HR manager

- **PTO Management**: Complete PTO workflow
  - Submit requests with date range and all-day toggle
  - Manager approval workflow
  - Automatic allocation creation upon approval

- **Mass Load**: Bulk allocation tool
  - Select multiple consultants at once
  - Date range selection
  - Preview before creating allocations

- **Role-Based Access Control**:
  - Admin: Full access to all features
  - Manager: Approve PTO, use mass load, edit allocations
  - Employee: View utilization, submit PTO, edit own allocations

## Tech Stack

- **Framework**: Next.js 14 (App Router, Server Components, Server Actions)
- **UI**: React + Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL (Supabase/Neon compatible)
- **ORM**: Prisma
- **Auth**: NextAuth.js v5 (Auth.js)
- **Forms**: React Hook Form + Zod validation

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (local or hosted)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd gt-utilization-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your database URL and auth secret:
   ```
   DATABASE_URL="postgresql://user:password@host:5432/database"
   AUTH_SECRET="your-super-secret-key-change-in-production"
   AUTH_URL="http://localhost:3000"
   ```

5. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

6. Push the database schema:
   ```bash
   npm run db:push
   ```

7. Seed the database with sample data:
   ```bash
   npm run db:seed
   ```

8. Start the development server:
   ```bash
   npm run dev
   ```

9. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Test Accounts

After seeding, you can log in with:

| Role     | Email                  | Password    |
|----------|------------------------|-------------|
| Admin    | admin@company.com      | password123 |
| Manager  | manager@company.com    | password123 |
| Employee | jane@company.com       | password123 |
| Employee | john@company.com       | password123 |

## Database Commands

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database
npm run db:migrate    # Run migrations
npm run db:seed       # Seed sample data
npm run db:studio     # Open Prisma Studio
```

## Deployment

### Vercel + Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)

2. Get your database connection string from Supabase:
   - Go to Settings > Database
   - Copy the Connection String (URI)

3. Deploy to Vercel:
   - Push your code to GitHub
   - Import the project to Vercel
   - Add environment variables:
     - `DATABASE_URL`: Your Supabase connection string
     - `AUTH_SECRET`: Generate with `openssl rand -base64 32`
     - `AUTH_URL`: Your Vercel deployment URL

4. After deployment, run migrations:
   ```bash
   npx prisma db push
   ```

### Vercel + Neon

1. Create a Neon project at [neon.tech](https://neon.tech)

2. Get your connection string from the Neon dashboard

3. Follow the same Vercel deployment steps above

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/           # Protected routes
│   │   ├── projects/          # Projects management
│   │   ├── consultants/       # Consultants management
│   │   ├── pto/               # PTO management
│   │   ├── mass-load/         # Bulk allocations
│   │   └── utilization/       # Utilization grid
│   ├── actions/               # Server actions
│   └── api/auth/              # NextAuth API route
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── layout/                # Sidebar, header
│   ├── projects/              # Project components
│   ├── consultants/           # Consultant components
│   ├── pto/                   # PTO components
│   ├── mass-load/             # Mass load components
│   └── utilization/           # Grid components
├── lib/
│   ├── prisma.ts              # Prisma client
│   ├── auth.ts                # NextAuth config
│   └── utils.ts               # Utility functions
└── middleware.ts              # Auth middleware
```

## License

MIT

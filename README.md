# Receipt OCR Importer

Track refrigerator inventory using OCR-scanned receipts

## Features

- 📱 Receipt OCR scanning with Google Cloud Vision API
- 🍎 Food item management and tracking
- 📅 Expiry date monitoring with alerts
- 📊 Consumption history and analytics
- 🔐 Secure authentication with Supabase
- 💰 Multi-currency support (¥ / $)

## Tech Stack

- **Frontend**: Next.js 15.3.4, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **OCR**: Google Cloud Vision API & Document AI
- **Authentication**: Supabase Auth
- **Deployment**: Vercel

## Getting Started

First, install dependencies:

```bash
npm install
```

Set up environment variables in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_PRIVATE_KEY=your_private_key
GOOGLE_CLOUD_CLIENT_EMAIL=your_client_email
USE_DOCUMENT_AI=true
DOCUMENT_AI_PROCESSOR_ID=your_processor_id
DOCUMENT_AI_LOCATION=us
USE_HYBRID_STRATEGY=true
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. **Upload Receipt**: Take a photo or upload an image of your receipt
2. **OCR Processing**: The system automatically extracts food items with prices
3. **Select Items**: Choose which items to add to your inventory
4. **Manage Inventory**: View, edit, and track your food items
5. **Monitor Expiry**: Get alerts for items approaching expiration

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
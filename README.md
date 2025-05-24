# Sports Celebrity Reels

An AI-powered Next.js application that generates engaging sports celebrity history reels using artificial intelligence, stores them in AWS S3, and presents them in a smooth, TikTok-style vertical scrolling interface.

## 🚀 Features

- **AI-Powered Content Generation**: Leverages OpenAI GPT-4 for script generation and Amazon Polly for text-to-speech
- **TikTok-Style Reels**: Smooth vertical scrolling with touch gestures and mobile optimization
- **AWS S3 Integration**: Scalable video storage with CloudFront CDN for optimal delivery
- **High Performance**: Optimized for handling large traffic with lazy loading and video preloading
- **Mobile-First Design**: Responsive design with touch-friendly interactions
- **Real-time Analytics**: Track views, likes, and shares
- **SEO Optimized**: Server-side rendering with proper meta tags

## 🛠 Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: AWS S3, CloudFront CDN
- **AI Services**: OpenAI GPT-4, Amazon Polly
- **Video Processing**: FFmpeg, Sharp
- **State Management**: SWR for data fetching
- **Testing**: Jest, React Testing Library, Playwright
- **Deployment**: Vercel

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── reels/            # Reel-specific components
│   └── layout/           # Layout components
├── lib/                  # Core libraries and utilities
├── hooks/                # Custom React hooks
├── services/             # External service integrations
├── types/                # TypeScript type definitions
├── utils/                # Utility functions
├── config/               # Configuration files
├── constants/            # Application constants
├── store/                # State management
└── styles/               # Global styles
```

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ and npm 8+
- PostgreSQL database
- AWS account with S3 and Polly access
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sports-celebrity-reels
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your environment variables:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/sports_reels_db"
   AWS_ACCESS_KEY_ID="your_aws_access_key"
   AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
   AWS_S3_BUCKET_NAME="sports-celebrity-reels"
   OPENAI_API_KEY="your_openai_api_key"
   ```

4. **Set up the database**
   ```bash
   npm run db:generate
   npm run db:push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🧪 Testing

### Unit Tests
```bash
npm run test
npm run test:watch
npm run test:coverage
```

### End-to-End Tests
```bash
npm run test:e2e
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## 📦 Deployment

### Vercel (Recommended)

1. **Connect your repository to Vercel**
2. **Set environment variables in Vercel dashboard**
3. **Deploy automatically on push to main branch**

### Manual Deployment

```bash
npm run build
npm run start
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `AWS_ACCESS_KEY_ID` | AWS access key | ✅ |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | ✅ |
| `AWS_S3_BUCKET_NAME` | S3 bucket name | ✅ |
| `OPENAI_API_KEY` | OpenAI API key | ✅ |
| `AWS_CLOUDFRONT_DOMAIN` | CloudFront domain | ❌ |
| `REDIS_URL` | Redis connection string | ❌ |

### Performance Optimization

- **Image Optimization**: Next.js Image component with AVIF/WebP support
- **Video Preloading**: Intelligent preloading of next videos
- **Lazy Loading**: Components and images load on demand
- **Bundle Splitting**: Automatic code splitting for optimal loading
- **CDN Integration**: CloudFront for global content delivery

## 📊 API Documentation

### Endpoints

- `GET /api/reels` - Fetch reels with pagination
- `POST /api/reels` - Create new reel
- `GET /api/celebrities` - Fetch celebrities
- `POST /api/generate` - Generate AI content
- `POST /api/upload` - Upload video files

### Example Usage

```javascript
// Fetch reels
const response = await fetch('/api/reels?page=1&limit=10');
const { data, pagination } = await response.json();

// Generate new reel
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    celebrityId: 'celebrity-id',
    duration: 60,
    voiceType: 'SPORTS_COMMENTATOR'
  })
});
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- AWS for S3 and Polly services
- Vercel for hosting platform
- Next.js team for the amazing framework

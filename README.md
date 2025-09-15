# TaskManager - Minimalist Task Management

A beautifully simple task management system with SMS reminders and email integration.

## ✨ Features

- **One Smart List** - AI-powered task ordering based on relevance
- **Email to Task** - Forward emails to create tasks automatically  
- **Daily SMS Digest** - One morning SMS with all today's tasks
- **Quick Actions** - Reply to SMS with a number to complete tasks
- **Minimalist UI** - Clean, distraction-free interface
- **Smart Search** - Natural language task filtering

## 🚀 Quick Start

1. Clone and install:
```bash
git clone https://github.com/yourusername/taskmanager
cd taskmanager
npm install
```

2. Set up environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Set up database:
```bash
npx prisma db push
```

4. Run development:
```bash
npm run dev
```

## 📱 SMS Setup (Twilio)

1. Get a Twilio account at twilio.com
2. Buy an SMS-enabled phone number ($1/month)
3. Add credentials to `.env`:
```env
SMS_MODE=production
TWILIO_ACCOUNT_SID=ACxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

## 🚂 Deploy to Railway

See [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) for detailed deployment instructions.

## 📧 Email Integration

Forward emails to your unique TaskManager address to automatically create tasks.

## 🎯 Philosophy

- **Minimal** - Do one thing well
- **Frictionless** - Least amount of actions
- **Smart** - AI-powered relevance
- **Predictable** - One daily touchpoint

## 📝 License

MIT
# Deployment to Render Progress

## Backend Service Config (Node.js):
- **Repo:** sumitnegii/Hirebuddy-AI-Multi-Agent-Enterprise-AT
- **Branch:** main  
- **Root Directory:** backend
- **Build Command:** `npm ci`
- **Start Command:** `npm start` (runs `node server.js`)
- **Instance:** Starter ($7/mo) recommended (AI heavy)

## Required Environment Variables:
(Add to Render dashboard)

```
MONGO_URI=mongodb+srv://[user]:[pass]@[cluster].mongodb.net/atsdb?retryWrites=true&w=majority
JWT_SECRET=your-super-long-random-secret-key-here-at-least-32-chars
ANTHROPIC_API_KEY=your-anthropic-api-key

import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import processRoutes from './routes/processes'
import adminRoutes from './routes/admin'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

// Ensure data directories exist
const DATA_DIR = path.resolve(__dirname, '../../data')
fs.mkdirSync(path.join(DATA_DIR, 'processes'), { recursive: true })

app.use('/api/processes', processRoutes)
app.use('/api/admin', adminRoutes)

// Serve built frontend in production
const frontendDist = path.resolve(__dirname, '../../frontend/dist')
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get('*', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`Process Hub API running on http://localhost:${PORT}`)
})

export default app

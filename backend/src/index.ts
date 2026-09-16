import { createApp } from './app.js'
import { resolvePort } from './port.js'

const port = resolvePort(process.env.PORT)

createApp().listen(port, () => {
  console.info(`Backend listening on http://localhost:${port}`)
})

import dotenv from 'dotenv'
import express from 'express'
import { GoogleGenAI } from '@google/genai'
import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(serverDirectory, '.env')
dotenv.config({ path: envPath })

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
const PORT = Number(process.env.PORT) || 3001

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey || apiKey === 'your_gemini_api_key_here') return ''
  return apiKey
}

const app = express()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 1,
    parts: 2,
    fieldSize: 20 * 1024,
  },
  fileFilter(_request, file, callback) {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      callback(new UploadError('აირჩიეთ JPEG, PNG ან WebP ფორმატის სურათი.', 400))
      return
    }

    callback(null, true)
  },
})

class UploadError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
  }
}

function matchesImageType(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }

  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  }

  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    )
  }

  return false
}

function getGeminiError(error) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.code)
  const message = String(error?.message || '').toLowerCase()

  if (
    status === 401 ||
    message.includes('api key not valid') ||
    message.includes('invalid api key') ||
    message.includes('api_key_invalid')
  ) {
    return { status: 401, error: 'Gemini API გასაღები არასწორია. შეამოწმეთ GEMINI_API_KEY server/.env ფაილში.' }
  }

  if (status === 404 || message.includes('model not found') || message.includes('not found')) {
    return { status: 503, error: `Gemini მოდელი „${MODEL}“ მიუწვდომელია. შეამოწმეთ GEMINI_MODEL-ის მნიშვნელობა.` }
  }

  if (
    status === 429 ||
    message.includes('resource_exhausted') ||
    message.includes('quota') ||
    message.includes('rate limit')
  ) {
    return { status: 429, error: 'Gemini-ის მოთხოვნების ლიმიტი ამოიწურა. ცოტა ხანში სცადეთ ხელახლა.' }
  }

  if (status === 403 || message.includes('permission_denied') || message.includes('permission denied')) {
    return { status: 403, error: 'Gemini API-ზე წვდომა აკრძალულია. შეამოწმეთ API გასაღები და პროექტის წვდომები.' }
  }

  return { status: 502, error: 'ფოტოს Gemini-თან გაანალიზება ვერ მოხერხდა. მოგვიანებით სცადეთ.' }
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.post('/api/analyze', (request, response) => {
  upload.single('image')(request, response, async (uploadError) => {
    if (uploadError) {
      if (uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE') {
        response.status(413).json({ error: 'სურათის ზომა 5 მბ-ს არ უნდა აღემატებოდეს.' })
        return
      }

      if (uploadError instanceof multer.MulterError) {
        response.status(400).json({ error: 'გამოიყენეთ ერთი image ფაილი და სურვილისამებრ ერთი question ტექსტური ველი.' })
        return
      }

      const statusCode = uploadError.statusCode || 400
      response.status(statusCode).json({ error: uploadError.message })
      return
    }

    if (!request.file) {
      response.status(400).json({ error: 'ატვირთეთ JPEG, PNG ან WebP ფორმატის სურათი.' })
      return
    }

    if (!matchesImageType(request.file.buffer, request.file.mimetype)) {
      response.status(400).json({ error: 'ფაილის შიგთავსი მითითებულ სურათის ფორმატს არ ემთხვევა.' })
      return
    }

    if (typeof request.body.question !== 'undefined' && typeof request.body.question !== 'string') {
      response.status(400).json({ error: 'კითხვის ველი ტექსტური უნდა იყოს.' })
      return
    }

    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      response.status(503).json({
        error: 'Gemini API გასაღები ვერ მოიძებნა. server/.env ფაილში GEMINI_API_KEY-ის ნაცვლად ჩასვით თქვენი მოქმედი გასაღები და backend ხელახლა გაუშვით.',
      })
      return
    }

    const question = request.body.question?.trim()
    const prompt = [
      'გააანალიზე მოცემული სურათი და უპასუხე მხოლოდ ქართულ ენაზე.',
      question
        ? `მომხმარებლის კითხვა: ${question}`
        : 'აღწერე სურათის მთავარი შინაარსი მოკლედ და ზუსტად.',
      'თუ სურათზე არსებული ინფორმაცია გაურკვეველია, ეს პირდაპირ აღნიშნე და ნუ გამოიგონებ დეტალებს.',
    ].join('\n')

    try {
      const ai = new GoogleGenAI({ apiKey })
      const interaction = await ai.interactions.create({
        model: MODEL,
        input: [
          { type: 'text', text: prompt },
          {
            type: 'image',
            data: request.file.buffer.toString('base64'),
            mime_type: request.file.mimetype,
          },
        ],
      })

      const result = interaction.output_text
      if (typeof result !== 'string' || !result.trim()) {
        response.status(502).json({ error: 'Gemini-მ ცარიელი პასუხი დააბრუნა. სცადეთ ხელახლა.' })
        return
      }

      response.json({ result: result.trim() })
    } catch (error) {
      console.error('Gemini image analysis failed:', error)
      const geminiError = getGeminiError(error)
      response.status(geminiError.status).json({ error: geminiError.error })
    }
  })
})

app.listen(PORT, () => {
  console.log(`Photo analyzer API listening on http://localhost:${PORT}`)
  if (!getGeminiApiKey()) {
    console.warn('GEMINI_API_KEY is not configured. Set it in server/.env and restart the backend.')
  }
})

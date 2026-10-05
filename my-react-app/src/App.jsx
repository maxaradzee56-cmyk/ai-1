import { useEffect, useRef, useState } from 'react'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ANALYSIS_ENDPOINT = '/api/analyze'
const QUESTION_SUGGESTIONS = [
  'რა ჩანს ამ ფოტოზე?',
  'რა მცენარე ან ცხოველია?',
  'რა წერია სურათზე?',
]

function App() {
  const [image, setImage] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const requestInProgress = useRef(false)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function selectImage(file) {
    setError('')
    setResult('')
    setCopyStatus('')

    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setImage(null)
      setPreviewUrl('')
      setError('აირჩიეთ JPEG, PNG ან WebP ფორმატის სურათი.')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setImage(null)
      setPreviewUrl('')
      setError('სურათის ზომა 5 მბ-ს არ უნდა აღემატებოდეს.')
      return
    }

    setImage(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function handleFileChange(event) {
    selectImage(event.target.files?.[0])
    event.target.value = ''
  }

  function handleDragOver(event) {
    event.preventDefault()
    if (event.dataTransfer.types.includes('Files')) setIsDragging(true)
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragging(false)
    }
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    selectImage(event.dataTransfer.files?.[0])
  }

  function chooseSuggestion(suggestion) {
    setQuestion(suggestion)
    setError('')
    setResult('')
    setCopyStatus('')
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(result)
      setCopyStatus('კოპირებულია')
    } catch {
      setCopyStatus('კოპირება ვერ მოხერხდა')
    }
  }

  async function handleSubmit() {
    if (requestInProgress.current) return

    setError('')
    setResult('')
    setCopyStatus('')

    if (!image) {
      setError('ანალიზისთვის ჯერ ატვირთეთ სურათი.')
      return
    }

    const formData = new FormData()
    formData.append('image', image)
    formData.append('question', question.trim())

    requestInProgress.current = true
    setIsLoading(true)

    try {
      const response = await fetch(ANALYSIS_ENDPOINT, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : `სერვერმა შეცდომა დააბრუნა (${response.status}). სცადეთ მოგვიანებით.`,
        )
      }

      if (!data || typeof data.result !== 'string' || !data.result.trim()) {
        throw new Error('სერვერის პასუხში ანალიზის შედეგი ვერ მოიძებნა.')
      }

      setResult(data.result)
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? 'სერვერთან დაკავშირება ვერ მოხერხდა. შეამოწმეთ, რომ backend გაშვებულია და სცადეთ ხელახლა.'
          : requestError instanceof Error
            ? requestError.message
            : 'ანალიზისას შეცდომა მოხდა. სცადეთ ხელახლა.',
      )
    } finally {
      requestInProgress.current = false
      setIsLoading(false)
    }
  }

  function removeImage() {
    setImage(null)
    setPreviewUrl('')
    setError('')
    setResult('')
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#f7f7fb] px-4 py-6 text-slate-900 sm:px-6 sm:py-9">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-44 left-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-200/35 blur-3xl" />
        <div className="absolute right-[-10rem] top-[35%] h-96 w-96 rounded-full bg-fuchsia-100/50 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-[-8rem] h-96 w-96 rounded-full bg-indigo-100/60 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between">
          <a href="/" className="group inline-flex items-center gap-3 rounded-xl focus:outline-none focus:ring-4 focus:ring-violet-200">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-200/70 transition group-hover:-translate-y-0.5">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" stroke="currentColor" strokeWidth="1.7" />
                <circle cx="9" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.7" />
                <path d="m5 17 4.5-4 3 2.5 2.5-2 4 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>
              <span className="block text-sm font-bold tracking-tight text-slate-900">ხედვა</span>
              <span className="block text-xs text-slate-500">ფოტოს ანალიზი</span>
            </span>
          </a>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-3 py-2 text-xs font-semibold text-violet-700 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
            AI ასისტენტი
          </span>
        </header>

        <section className="mb-8 max-w-3xl sm:mb-10">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-100/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-violet-700">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="m10 1.5 1.9 5.1L17 8.5l-5.1 1.9L10 15.5l-1.9-5.1L3 8.5l5.1-1.9L10 1.5ZM16 13l1.1 2.9L20 17l-2.9 1.1L16 21l-1.1-2.9L12 17l2.9-1.1L16 13Z" />
            </svg>
            შენი ფოტო, ახალი პერსპექტივით
          </p>
          <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
            აღმოაჩინე, <span className="bg-gradient-to-r from-violet-700 to-indigo-600 bg-clip-text text-transparent">რას გვიყვება</span> ფოტო
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            ატვირთე სურათი, დასვი კითხვა და მიიღე ნათელი პასუხი წამებში.
          </p>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)] lg:gap-6">
          <section className="rounded-[1.75rem] border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_-36px_rgba(54,43,99,0.28)] backdrop-blur sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-sm font-bold text-violet-700 ring-1 ring-violet-100">01</span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">ატვირთე ფოტო</h2>
                  <p className="mt-1 text-sm text-slate-500">აირჩიე სურათი შენი მოწყობილობიდან</p>
                </div>
              </div>
              {image && (
                <button
                  type="button"
                  onClick={removeImage}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-4 focus:ring-red-100"
                >
                  წაშლა
                </button>
              )}
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-2xl transition ${isDragging ? 'ring-4 ring-violet-300 ring-offset-2' : ''}`}
            >
              {image && previewUrl ? (
                <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
                  <img
                    src={previewUrl}
                    alt="ატვირთული ფოტოს წინასწარი ნახვა"
                    draggable="false"
                    className="max-h-[380px] min-h-56 w-full object-contain"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-slate-950/80 to-transparent px-4 pb-4 pt-10">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur">
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" stroke="currentColor" strokeWidth="1.7" />
                        <circle cx="9" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.7" />
                        <path d="m5 17 4.5-4 3 2.5 2.5-2 4 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{image.name}</span>
                      <span className="block text-xs text-white/70">{(image.size / (1024 * 1024)).toFixed(2)} მბ · მზად არის</span>
                    </span>
                    <span className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-white">
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                        <path d="m5 10 3.2 3.2L15 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>
                  {isDragging && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-violet-950/55 text-lg font-bold text-white backdrop-blur-sm">
                      ჩააგდე ახალი ფოტო
                    </div>
                  )}
                </div>
              ) : (
                <label className={`group flex min-h-60 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-100/80 focus-within:ring-4 focus-within:ring-violet-100 ${isDragging ? 'border-violet-500 bg-violet-100' : 'border-violet-200 bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/70 hover:border-violet-400'}`}>
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-md shadow-violet-100 ring-1 ring-violet-100 transition group-hover:scale-105">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-7 w-7">
                    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="font-bold text-slate-800">{isDragging ? 'ჩააგდე ფოტო აქ' : 'დააჭირე ფოტოს ასარჩევად'}</span>
                <span className="mt-1 text-sm text-slate-500">ან გადაათრიე აქ · PNG, JPG ან WebP</span>
                <span className="mt-4 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-100">მაქსიმალური ზომა — 5 მბ</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                </label>
              )}
            </div>

            <div className="mt-6">
              <label htmlFor="question" className="mb-2.5 flex items-center gap-2 text-sm font-bold text-slate-800">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                    <path d="M10 14v-.5c0-1.2 2-1.8 2-3.5a2 2 0 1 0-4 0M10 17.5h.01M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                რა გაინტერესებს?
                <span className="font-normal text-slate-400">(არასავალდებულო)</span>
              </label>
              <textarea
                id="question"
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value)
                  setError('')
                  setResult('')
                }}
                placeholder="მაგალითად: რა მცენარეა ფოტოზე?"
                rows="3"
                className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-base text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {QUESTION_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => chooseSuggestion(suggestion)}
                    className="rounded-full border border-violet-100 bg-violet-50/70 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 focus:outline-none focus:ring-4 focus:ring-violet-100"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="mt-0.5 h-5 w-5 shrink-0">
                  <path d="M10 6.5v4m0 3h.01M8.3 3.4 1.8 14.7a1.5 1.5 0 0 0 1.3 2.3h13.8a1.5 1.5 0 0 0 1.3-2.3L11.7 3.4a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{error}</span>
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-indigo-600 px-5 py-3 font-bold text-white shadow-lg shadow-violet-200/80 transition duration-200 hover:-translate-y-0.5 hover:from-violet-800 hover:to-indigo-700 hover:shadow-xl hover:shadow-violet-200 focus:outline-none focus:ring-4 focus:ring-violet-200 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  მიმდინარეობს ანალიზი...
                </>
              ) : (
                <>
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d="m10 1.5 1.9 5.1L17 8.5l-5.1 1.9L10 15.5l-1.9-5.1L3 8.5l5.1-1.9L10 1.5ZM16 13l1.1 2.9L20 17l-2.9 1.1L16 21l-1.1-2.9L12 17l2.9-1.1L16 13Z" />
                  </svg>
                  გაანალიზე ფოტო
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="ml-1 h-4 w-4">
                    <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                <path d="M5 8V6a5 5 0 0 1 10 0v2m-11 0h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              ფოტო იგზავნება მხოლოდ ანალიზის მოთხოვნისას
            </p>
          </section>

          <aside className="space-y-5 lg:sticky lg:top-8">
            <section aria-live="polite" className={`overflow-hidden rounded-[1.75rem] border bg-white/90 shadow-[0_24px_80px_-36px_rgba(54,43,99,0.28)] backdrop-blur ${result ? 'border-emerald-200' : 'border-white/80'}`}>
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${result ? 'bg-emerald-100 text-emerald-700' : 'bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700'}`}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                    <path d="M12 3v2m0 14v2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42M3 12h2m14 0h2M5.64 18.36l1.42-1.42m9.88-9.88 1.42-1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">შედეგი</p>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">ანალიზის პასუხი</h2>
                </div>
                {result && (
                  <div className="ml-auto flex items-center gap-2">
                    <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 sm:inline">მზადაა</span>
                    <button
                      type="button"
                      onClick={copyResult}
                      aria-label="შედეგის კოპირება"
                      aria-live="polite"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100"
                    >
                      {copyStatus === 'კოპირებულია' ? (
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-emerald-600">
                          <path d="m4.5 10 3.5 3.5 7.5-7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                          <rect x="7" y="6" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M13 6V4.5A1.5 1.5 0 0 0 11.5 3h-6A1.5 1.5 0 0 0 4 4.5v8A1.5 1.5 0 0 0 5.5 14H7" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      )}
                      <span>{copyStatus || 'კოპირება'}</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="min-h-56 p-5 sm:p-6">
                {result ? (
                  <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{result}</p>
                ) : (
                  <div className="flex min-h-44 flex-col items-center justify-center text-center">
                    <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-50 to-violet-50 text-violet-300 ring-1 ring-violet-100/80">
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-8 w-8">
                        <path d="M12 3v2m0 14v2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42M3 12h2m14 0h2M5.64 18.36l1.42-1.42m9.88-9.88 1.42-1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    <p className="font-semibold text-slate-700">პასუხი აქ გამოჩნდება</p>
                    <p className="mt-1 max-w-56 text-sm leading-6 text-slate-400">ატვირთე ფოტო და დაიწყე ანალიზი</p>
                  </div>
                )}
              </div>
              {result && (
                <div className="border-t border-emerald-100 bg-emerald-50/60 px-5 py-3 text-xs text-emerald-800 sm:px-6">
                  პასუხი მომზადებულია შენი ატვირთული ფოტოს მიხედვით.
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-violet-100/80 bg-gradient-to-br from-violet-50/90 to-indigo-50/70 p-5">
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm">
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                    <path d="M10 2.5v1.7m0 11.6v1.7M3.5 10h-1m15 0h-1M5.4 5.4l-1.2-1.2m11.6 11.6-1.2-1.2m0-9.2 1.2-1.2M4.2 15.8l1.2-1.2M13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">რჩევა უკეთესი პასუხისთვის</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">დასვი კონკრეტული კითხვა ფოტოზე არსებული საგნის, ფერის ან დეტალის შესახებ.</p>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200/70 pt-5 text-xs text-slate-400 sm:flex-row">
          <span>ხედვა · AI ფოტოს ანალიზი</span>
          <span className="inline-flex items-center gap-1.5">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
              <path d="M5 8V6a5 5 0 0 1 10 0v2m-11 0h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            შენი ფოტო იგზავნება მხოლოდ ანალიზისთვის
          </span>
        </footer>
      </div>
    </main>
  )
}

export default App
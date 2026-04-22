// @ts-nocheck — this file runs in Deno (Supabase Edge Function), not Node. TS server does not know Deno globals.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'stories@nestandquill.com'
const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://nestandquill.com'
const EXPECTED_TOKEN = Deno.env.get('EDGE_FUNCTION_SECRET') ?? SUPABASE_SERVICE_ROLE_KEY
const SKIP_IMAGES = Deno.env.get('SKIP_IMAGE_GENERATION') === 'true'

// PDF layout constants (8×8 inch square picture-book format)
const PDF_SIZE = 576
const PDF_MARGIN = 40
const PDF_BRAND_ORANGE = rgb(0.863, 0.541, 0.157)
const PDF_CREAM = rgb(0.98, 0.973, 0.96)
const PDF_NEAR_BLACK = rgb(0.11, 0.098, 0.09)
const PDF_GRAY = rgb(0.471, 0.443, 0.424)

// ── Illustration style → DALL-E style hint map ────────────────────────────────

const STYLE_HINTS: Record<string, string> = {
  watercolor: 'soft watercolor illustration, gentle washes of color, children\'s picture book style',
  cartoon: 'bright cartoon illustration, bold outlines, vibrant colors, fun and playful children\'s book style',
  storybook: 'classic storybook illustration, warm and detailed, fairy-tale aesthetic, painted children\'s book style',
  pencil_sketch: 'detailed pencil sketch illustration, hand-drawn, soft shading, charming children\'s book style',
  digital_art: 'clean digital illustration, polished artwork, colorful, modern children\'s book style',
}

// ── OpenAI helper ─────────────────────────────────────────────────────────────

async function callOpenAI(messages: object[], model = 'gpt-4o'): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.8,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }

  const json = await res.json()
  return json.choices[0].message.content
}

async function generateImage(prompt: string, illustrationStyle: string): Promise<Uint8Array> {
  const styleHint = STYLE_HINTS[illustrationStyle] ?? STYLE_HINTS.storybook
  const fullPrompt = `${styleHint}. ${prompt}. Child-safe, no text, no words in image.`

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DALL-E error ${res.status}: ${err}`)
  }

  const json = await res.json()
  const imageUrl = json.data[0].url

  // Download immediately — OpenAI signed URLs expire within ~1 hour
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) {
    throw new Error(`Failed to download image from OpenAI URL: ${imageRes.status}`)
  }

  const buffer = await imageRes.arrayBuffer()
  return new Uint8Array(buffer)
}

// ── Story prompt builder ──────────────────────────────────────────────────────

function buildStoryPrompt(request: Record<string, unknown>): object[] {
  const {
    child_name,
    child_age,
    child_description,
    story_theme,
    story_tone,
    story_moral,
    story_length,
    illustration_style,
    dedication_text,
  } = request

  const toneList = Array.isArray(story_tone) ? story_tone.join(', ') : story_tone
  const pageCount = Number(story_length) || 16

  const systemPrompt = `You are a professional children's book author. You write warm, age-appropriate stories for young children.

Your output must be valid JSON matching this exact structure:
{
  "title": "string — a short, memorable book title",
  "subtitle": "string — an optional subtitle (can be empty string)",
  "author_line": "A Nest & Quill Original",
  "dedication": "string — a short dedication (only if provided, otherwise empty string)",
  "synopsis": "string — 2-3 sentence description of the story",
  "pages": [
    {
      "page": 1,
      "text": "string — the story text for this page (2-4 sentences, age-appropriate)",
      "image_description": "string — a detailed visual description for an illustrator (what to draw on this page)"
    }
  ]
}

Rules:
- Write exactly ${pageCount} story pages
- Keep language simple and age-appropriate for a ${child_age}-year-old
- Each page should have 2-4 sentences maximum
- Image descriptions should be vivid, specific, and describe a single scene
- The illustration style is ${illustration_style} — reflect this in image description language
- Tone: ${toneList}
- Do not include page numbers or chapter headings in the text
- End the story with a satisfying, uplifting conclusion`

  const userPrompt = `Write a children's storybook with these details:

- Main character: ${child_name}, age ${child_age}
${child_description ? `- About ${child_name}: ${child_description}` : ''}
- Story theme: ${story_theme}
- Tone: ${toneList}
${story_moral ? `- Moral or lesson to include: ${story_moral}` : ''}
${dedication_text ? `- Dedication: ${dedication_text}` : ''}
- Length: exactly ${pageCount} pages

Write the full story now.`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (token !== EXPECTED_TOKEN) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let requestId: string
  try {
    const body = await req.json()
    requestId = body.requestId
    if (!requestId) throw new Error('Missing requestId')
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  // ── Supabase admin client ─────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Fetch the full story request ──────────────────────────────────────────
  const { data: storyRequest, error: fetchError } = await supabase
    .from('story_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (fetchError || !storyRequest) {
    return new Response('Story request not found', { status: 404 })
  }

  // ── Idempotency ───────────────────────────────────────────────────────────
  const retriable = ['queued', 'failed']
  if (storyRequest.worker_id !== null && !retriable.includes(storyRequest.status)) {
    return new Response(
      JSON.stringify({ requestId, skipped: true, reason: 'Already processing' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── Claim this request ────────────────────────────────────────────────────
  const workerId = crypto.randomUUID()

  await supabase
    .from('story_requests')
    .update({
      worker_id: workerId,
      status: 'generating_text',
      processing_started_at: new Date().toISOString(),
      status_message: 'Writing your story…',
      progress_pct: 10,
      last_error: null,
    })
    .eq('id', requestId)

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function setStatus(
    status: string,
    message: string,
    progress: number,
    extra: Record<string, unknown> = {}
  ) {
    await supabase
      .from('story_requests')
      .update({ status, status_message: message, progress_pct: progress, ...extra })
      .eq('id', requestId)
  }

  async function log(
    stage: string,
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    metadata: Record<string, unknown> = {}
  ) {
    await supabase.from('processing_logs').insert({
      request_id: requestId,
      level,
      stage,
      message,
      metadata: { worker_id: workerId, ...metadata },
    })
  }

  // ── Pipeline ──────────────────────────────────────────────────────────────

  try {
    await log('pipeline_start', 'Pipeline started')

    // ── Step 1: Generate story text ───────────────────────────────────────
    await log('generate_text', 'Calling OpenAI GPT-4o for story text')
    const t0 = Date.now()

    const messages = buildStoryPrompt(storyRequest)
    const rawContent = await callOpenAI(messages)
    const story = JSON.parse(rawContent)

    const generationTimeMs = Date.now() - t0

    // Validate we got pages
    if (!story.pages || !Array.isArray(story.pages) || story.pages.length === 0) {
      throw new Error('OpenAI returned invalid story structure — no pages found')
    }

    await log('generate_text', `Story generated: "${story.title}" (${story.pages.length} pages, ${generationTimeMs}ms)`, 'info', {
      title: story.title,
      page_count: story.pages.length,
      generation_time_ms: generationTimeMs,
    })

    // Save to generated_stories table
    const { data: savedStory, error: storyInsertError } = await supabase
      .from('generated_stories')
      .insert({
        request_id: requestId,
        title: story.title,
        subtitle: story.subtitle || null,
        author_line: story.author_line || 'A Nest & Quill Original',
        dedication: story.dedication || null,
        synopsis: story.synopsis || null,
        full_text_json: story.pages,
        model_used: 'gpt-4o',
        generation_time_ms: generationTimeMs,
      })
      .select('id')
      .single()

    if (storyInsertError || !savedStory) {
      throw new Error(`Failed to save story: ${storyInsertError?.message}`)
    }

    // Save each page as a story_scene row (image generation will fill in image_url later)
    const sceneRows = story.pages.map((page: Record<string, unknown>) => ({
      story_id: savedStory.id,
      request_id: requestId,
      page_number: page.page,
      page_text: page.text,
      image_prompt: page.image_description,
      image_status: 'pending',
    }))

    const { error: scenesInsertError } = await supabase
      .from('story_scenes')
      .insert(sceneRows)

    if (scenesInsertError) {
      throw new Error(`Failed to save story scenes: ${scenesInsertError.message}`)
    }

    await setStatus('generating_text', 'Story written!', 40)

    // ── Step 2: Generate illustrations via DALL-E 3 ───────────────────────
    await setStatus('generating_images', 'Creating illustrations…', 45)

    let imagesGenerated = 0
    let imagesFailed = 0

    // imageData keeps bytes in memory so PDF generation doesn't need to re-download
    const imageData = new Map() // page_number → Uint8Array

    if (SKIP_IMAGES) {
      await log('generate_images', 'Image generation skipped (SKIP_IMAGE_GENERATION=true)')
    } else {
      const { data: scenes, error: sceneFetchError } = await supabase
        .from('story_scenes')
        .select('id, page_number, image_prompt')
        .eq('request_id', requestId)
        .order('page_number', { ascending: true })

      if (sceneFetchError || !scenes) {
        throw new Error(`Failed to fetch story scenes: ${sceneFetchError?.message}`)
      }

      for (const scene of scenes) {
        try {
          const imageBytes = await generateImage(scene.image_prompt, storyRequest.illustration_style)

          const storagePath = `${requestId}/${scene.page_number}.png`
          const { error: uploadError } = await supabase.storage
            .from('story-images')
            .upload(storagePath, imageBytes, { contentType: 'image/png', upsert: true })

          if (uploadError) {
            throw new Error(`Storage upload failed for page ${scene.page_number}: ${uploadError.message}`)
          }

          await supabase
            .from('story_scenes')
            .update({ storage_path: storagePath, image_status: 'complete' })
            .eq('id', scene.id)

          imageData.set(scene.page_number, imageBytes)
          imagesGenerated++

          const progress = Math.round(45 + (imagesGenerated / scenes.length) * 30)
          await setStatus('generating_images', `Illustrating page ${scene.page_number} of ${scenes.length}…`, progress)

          await log('generate_images', `Page ${scene.page_number} illustrated`, 'info', {
            page_number: scene.page_number,
            storage_path: storagePath,
          })
        } catch (imgErr) {
          imagesFailed++
          const imgMsg = imgErr instanceof Error ? imgErr.message : String(imgErr)
          console.error(`[process-story] Image failed page ${scene.page_number}:`, imgMsg)
          await supabase.from('story_scenes').update({ image_status: 'failed' }).eq('id', scene.id)
          await log('generate_images', `Page ${scene.page_number} image failed: ${imgMsg}`, 'warning', {
            page_number: scene.page_number,
          })
        }
      }

      await log('generate_images', `Illustrations complete: ${imagesGenerated} generated, ${imagesFailed} failed`, 'info', {
        images_generated: imagesGenerated,
        images_failed: imagesFailed,
      })
    }

    // ── Step 3: Assemble PDF ──────────────────────────────────────────────
    await setStatus('assembling_pdf', 'Assembling your book…', 80)

    let pdfStoragePath: string | null = null
    try {
      const { data: allScenes } = await supabase
        .from('story_scenes')
        .select('page_number, page_text')
        .eq('request_id', requestId)
        .order('page_number', { ascending: true })

      const { data: savedStoryForPdf } = await supabase
        .from('generated_stories')
        .select('title, subtitle, author_line, dedication')
        .eq('request_id', requestId)
        .single()

      const pdfDoc = await PDFDocument.create()
      const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRoman)
      const fontSerifItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)
      const fontSerifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)

      // Embed images from in-memory map
      const embeddedImages = new Map()
      for (const [pageNum, bytes] of imageData) {
        try {
          const img = await pdfDoc.embedPng(bytes)
          embeddedImages.set(pageNum, img)
        } catch { /* skip corrupted images */ }
      }

      const storyTitle = savedStoryForPdf?.title ?? story.title
      const authorLine = savedStoryForPdf?.author_line ?? 'A Nest & Quill Original'
      const dedication = savedStoryForPdf?.dedication ?? story.dedication

      // Cover page
      const cover = pdfDoc.addPage([PDF_SIZE, PDF_SIZE])
      cover.drawRectangle({ x: 0, y: 0, width: PDF_SIZE, height: PDF_SIZE, color: PDF_CREAM })
      cover.drawRectangle({ x: 0, y: PDF_SIZE - 8, width: PDF_SIZE, height: 8, color: PDF_BRAND_ORANGE })
      cover.drawRectangle({ x: 0, y: 0, width: PDF_SIZE, height: 8, color: PDF_BRAND_ORANGE })

      const titleSize = storyTitle.length > 24 ? 28 : 34
      const titleLines = pdfWrapText(storyTitle, fontSerifBold, titleSize, PDF_SIZE - PDF_MARGIN * 2)
      let coverY = PDF_SIZE * 0.62
      for (const line of titleLines) {
        const w = fontSerifBold.widthOfTextAtSize(line, titleSize)
        cover.drawText(line, { x: (PDF_SIZE - w) / 2, y: coverY, size: titleSize, font: fontSerifBold, color: PDF_NEAR_BLACK })
        coverY -= titleSize * 1.3
      }

      const authorW = fontSerif.widthOfTextAtSize(authorLine, 11)
      cover.drawText(authorLine, { x: (PDF_SIZE - authorW) / 2, y: PDF_MARGIN + 10, size: 11, font: fontSerif, color: PDF_GRAY })

      // Dedication page
      if (dedication) {
        const dedPage = pdfDoc.addPage([PDF_SIZE, PDF_SIZE])
        dedPage.drawRectangle({ x: 0, y: 0, width: PDF_SIZE, height: PDF_SIZE, color: PDF_CREAM })
        const dedLines = pdfWrapText(dedication, fontSerifItalic, 14, PDF_SIZE - PDF_MARGIN * 4)
        const dedBlockH = dedLines.length * 14 * 1.6
        let dedY = PDF_SIZE / 2 + dedBlockH / 2
        for (const line of dedLines) {
          const w = fontSerifItalic.widthOfTextAtSize(line, 14)
          dedPage.drawText(line, { x: (PDF_SIZE - w) / 2, y: dedY, size: 14, font: fontSerifItalic, color: PDF_GRAY })
          dedY -= 14 * 1.6
        }
      }

      // Story pages
      const pageScenes = allScenes ?? []
      for (const scene of pageScenes) {
        const pg = pdfDoc.addPage([PDF_SIZE, PDF_SIZE])
        pg.drawRectangle({ x: 0, y: 0, width: PDF_SIZE, height: PDF_SIZE, color: PDF_CREAM })

        const img = embeddedImages.get(scene.page_number)
        if (img) {
          const imgH = Math.round(PDF_SIZE * 0.58)
          const imgY = PDF_SIZE - imgH
          const dims = img.scaleToFit(PDF_SIZE - PDF_MARGIN * 2, imgH - PDF_MARGIN / 2)
          pg.drawImage(img, {
            x: (PDF_SIZE - dims.width) / 2,
            y: imgY + (imgH - dims.height) / 2,
            width: dims.width,
            height: dims.height,
          })
          pdfDrawPageText(pg, scene.page_text, fontSerif, imgY - 10, scene.page_number, pageScenes.length)
        } else {
          pdfDrawPageText(pg, scene.page_text, fontSerif, Math.round(PDF_SIZE * 0.72), scene.page_number, pageScenes.length)
        }
      }

      // Back page
      const back = pdfDoc.addPage([PDF_SIZE, PDF_SIZE])
      back.drawRectangle({ x: 0, y: 0, width: PDF_SIZE, height: PDF_SIZE, color: PDF_CREAM })
      back.drawRectangle({ x: 0, y: PDF_SIZE - 8, width: PDF_SIZE, height: 8, color: PDF_BRAND_ORANGE })
      back.drawRectangle({ x: 0, y: 0, width: PDF_SIZE, height: 8, color: PDF_BRAND_ORANGE })
      const endText = 'The End'
      const endW = fontSerifItalic.widthOfTextAtSize(endText, 22)
      back.drawText(endText, { x: (PDF_SIZE - endW) / 2, y: PDF_SIZE / 2 + 10, size: 22, font: fontSerifItalic, color: PDF_BRAND_ORANGE })
      const brandW = fontSerif.widthOfTextAtSize(authorLine, 11)
      back.drawText(authorLine, { x: (PDF_SIZE - brandW) / 2, y: PDF_SIZE / 2 - 24, size: 11, font: fontSerif, color: PDF_GRAY })

      const pdfBytes = await pdfDoc.save()
      pdfStoragePath = `${requestId}/storybook.pdf`

      const { error: pdfUploadError } = await supabase.storage
        .from('book-exports')
        .upload(pdfStoragePath, pdfBytes, { contentType: 'application/pdf', upsert: true })

      if (pdfUploadError) throw new Error(`PDF upload failed: ${pdfUploadError.message}`)

      const { error: exportInsertError } = await supabase
        .from('book_exports')
        .insert({
          request_id: requestId,
          format: 'pdf',
          storage_path: pdfStoragePath,
          storage_bucket: 'book-exports',
          file_size_bytes: pdfBytes.length,
          page_count: pdfDoc.getPageCount(),
          is_latest: true,
        })

      if (exportInsertError) {
        await log('assemble_pdf', `book_exports insert warning: ${exportInsertError.message}`, 'warning')
      }

      await log('assemble_pdf', `PDF assembled and uploaded (${pdfBytes.length} bytes, ${pdfDoc.getPageCount()} pages)`, 'info', {
        storage_path: pdfStoragePath,
        file_size_bytes: pdfBytes.length,
        page_count: pdfDoc.getPageCount(),
      })
    } catch (pdfErr) {
      const pdfMsg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr)
      await log('assemble_pdf', `PDF assembly failed: ${pdfMsg}`, 'error')
      // Non-fatal — story is still readable in the ebook reader
    }

    // ── Step 4: Send delivery email ───────────────────────────────────────
    await setStatus('assembling_pdf', 'Almost done…', 95)
    try {
      if (storyRequest.user_email) {
        const storyUrl = `${APP_URL}/story/${requestId}`
        const childName = storyRequest.child_name

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: storyRequest.user_email,
            subject: `${childName}'s story is ready! 📖`,
            html: `
              <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1c1917">
                <h1 style="font-size:24px;margin-bottom:8px">${childName}'s story is ready!</h1>
                <p style="color:#78716c;margin-top:0">Your personalized storybook has been created.</p>
                <a href="${storyUrl}" style="display:inline-block;margin:24px 0;background:#dc8a28;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:15px">
                  Read the story →
                </a>
                <p style="font-size:12px;color:#a8a29e;margin-top:32px">Nest &amp; Quill · Personalized stories for curious kids</p>
              </div>`,
          }),
        })

        if (emailRes.ok) {
          const emailJson = await emailRes.json()
          await supabase.from('delivery_logs').insert({
            request_id: requestId,
            channel: 'email',
            status: 'sent',
            recipient_email: storyRequest.user_email,
            resend_message_id: emailJson.id ?? null,
          })
          await log('deliver', `Delivery email sent to ${storyRequest.user_email}`)
        } else {
          throw new Error(`Resend error ${emailRes.status}`)
        }
      }
    } catch (emailErr) {
      const emailMsg = emailErr instanceof Error ? emailErr.message : String(emailErr)
      await log('deliver', `Email delivery failed: ${emailMsg}`, 'warning')
      await supabase.from('delivery_logs').insert({
        request_id: requestId,
        channel: 'email',
        status: 'failed',
        recipient_email: storyRequest.user_email,
        failure_reason: emailMsg,
      })
      // Non-fatal — story is still accessible
    }

    // ── Complete ──────────────────────────────────────────────────────────
    await supabase
      .from('story_requests')
      .update({
        status: 'complete',
        status_message: 'Your story is ready!',
        progress_pct: 100,
        completed_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    await log('pipeline_complete', `Pipeline finished — story + ${imagesGenerated} illustrations + PDF + email`)

    return new Response(
      JSON.stringify({ requestId, status: 'complete', title: story.title }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {

    const message = err instanceof Error ? err.message : String(err)
    console.error(`[process-story] requestId=${requestId} error:`, message)

    await supabase
      .from('story_requests')
      .update({
        status: 'failed',
        last_error: message,
        status_message: 'Something went wrong — we\'ll look into it.',
      })
      .eq('id', requestId)

    await log('pipeline_error', message, 'error')

    return new Response(
      JSON.stringify({ requestId, status: 'failed', error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ── PDF helpers (inline — edge functions can't import from lib/) ──────────────

function pdfWrapText(text, font, size, maxWidth) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test
    } else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function pdfDrawPageText(page, text, font, topY, pageNum, totalPages) {
  const textSize = 13
  const maxW = PDF_SIZE - PDF_MARGIN * 3
  const lines = pdfWrapText(text, font, textSize, maxW)
  let y = topY
  for (const line of lines) {
    if (y < PDF_MARGIN + 20) break
    page.drawText(line, { x: PDF_MARGIN * 1.5, y, size: textSize, font, color: PDF_NEAR_BLACK })
    y -= textSize * 1.75
  }
  const label = `${pageNum} / ${totalPages}`
  const labelW = font.widthOfTextAtSize(label, 9)
  page.drawText(label, {
    x: (PDF_SIZE - labelW) / 2,
    y: PDF_MARGIN / 2,
    size: 9,
    font,
    color: rgb(0.7, 0.68, 0.66),
  })
}

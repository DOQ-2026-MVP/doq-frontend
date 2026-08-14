import type { SourceType, RawRecordInput } from "../model/inspection"

const ACCEPTED_EXTENSIONS = ["xlsx", "csv", "pdf", "png", "jpg", "jpeg"]

const RESIZED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg"]

export const ACCEPT_ATTRIBUTE = ".xlsx,.csv,.pdf,.png,.jpg,.jpeg"

export function fileExtension(fileName: string): string {
    const parts = fileName.toLowerCase().split(".")
    return parts.length > 1 ? parts[parts.length - 1] : ""
}

export function isAcceptedFile(fileName: string): boolean {
    return ACCEPTED_EXTENSIONS.includes(fileExtension(fileName))
}

export function needsResize(fileName: string): boolean {
    return RESIZED_EXTENSIONS.includes(fileExtension(fileName))
}

function sourceTypeOf(fileName: string): SourceType {
    const extension = fileExtension(fileName)
    if (extension === "csv") return "CSV"
    if (extension === "pdf") return "PDF"
    if (extension === "png" || extension === "jpg" || extension === "jpeg") {
        return "IMAGE"
    }
    return "XLSX"
}

export function buildRowsFromFile(file: File): RawRecordInput[] {
    const sourceType = sourceTypeOf(file.name)
    const docId = file.name.replace(/\.[^.]+$/, "")

    return [
        {
            uploadMethod: "FILE",
            uploadRowNo: 2,
            fileName: file.name,
            sourceType,
            docId,
            supplier: "업로드 공급사",
            rawItemName: "업로드 품목 A",
            spec: "4kg/PK",
            unit: "PK",
            priceBefore: "12000",
            priceAfter: "12600",
            effectiveDate: "2026-09-01",
        },
        {
            uploadMethod: "FILE",
            uploadRowNo: 3,
            fileName: file.name,
            sourceType,
            docId,
            supplier: "업로드 공급사",
            rawItemName: "업로드 품목 B",
            spec: "",
            unit: "BOX",
            priceBefore: "",
            priceAfter: "31500",
            effectiveDate: "2026-09-01",
        },
    ]
}

export async function resizeFileIfNeeded(file: File, maxSizeBytes = 10 * 1024 * 1024): Promise<File> {
    if (file.size <= maxSizeBytes) return file
    if (!needsResize(file.name)) return file

    const ext = fileExtension(file.name)

    if (ext === "png" || ext === "jpg" || ext === "jpeg") {
        try {
            const imgBitmap = await createImageBitmap(file as Blob)
            const canvas = document.createElement("canvas")
            const ctx = canvas.getContext("2d")
            if (!ctx) return file

            let scale = 1
            let quality = 0.92
            let blob: Blob | null = null

            for (let i = 0; i < 8; i++) {
                const w = Math.max(1, Math.round(imgBitmap.width * scale))
                const h = Math.max(1, Math.round(imgBitmap.height * scale))
                canvas.width = w
                canvas.height = h
                ctx.clearRect(0, 0, w, h)
                ctx.drawImage(imgBitmap, 0, 0, w, h)

                blob = await new Promise<Blob | null>((resolve) =>
                    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
                )

                if (!blob) break
                if (blob.size <= maxSizeBytes) break

                scale *= 0.8
                quality = Math.max(0.35, quality * 0.85)
            }

            if (blob && blob.size <= maxSizeBytes) {
                const newName = file.name.replace(/\.[^.]+$/, ".jpg")
                return new File([blob], newName, { type: "image/jpeg" })
            }
        } catch (e) {
            return file
        }
        return file
    }

    if (ext === "pdf") {
        try {
            const data = await file.arrayBuffer()
            let pdfjsLib: any
            try {
                pdfjsLib = await import("pdfjs-dist/legacy/build/pdf")
            } catch (e) {
                pdfjsLib = await import("pdfjs-dist")
            }

            const { jsPDF } = await import("jspdf")

            let attempt = 0
            let outBlob: Blob | null = null
            let renderScale = 1
            let quality = 0.85
            while (attempt < 4) {
                const loadingTask = pdfjsLib.getDocument({ data })
                const pdf = await loadingTask.promise
                const pageCount = pdf.numPages
                const images: { blob: Blob; w: number; h: number }[] = []

                for (let p = 1; p <= pageCount; p++) {
                    const page = await pdf.getPage(p)
                    const viewport = page.getViewport({ scale: renderScale })
                    const canvas = document.createElement("canvas")
                    canvas.width = Math.round(viewport.width)
                    canvas.height = Math.round(viewport.height)
                    const ctx = canvas.getContext("2d")
                    if (!ctx) throw new Error("Canvas not available")
                    const renderContext = { canvasContext: ctx, viewport }
                    await page.render(renderContext).promise

                    const blob = await new Promise<Blob | null>((resolve) =>
                        canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
                    )
                    if (!blob) throw new Error("Failed to create page image")
                    images.push({ blob, w: canvas.width, h: canvas.height })
                }

                if (images.length === 0) break
                const first = images[0]
                const pdfOut = new jsPDF({ unit: "px", format: [first.w, first.h] })
                for (let i = 0; i < images.length; i++) {
                    const im = images[i]
                    const dataUrl = await new Promise<string>((resolve) => {
                        const reader = new FileReader()
                        reader.onload = () => resolve(String(reader.result))
                        reader.readAsDataURL(im.blob)
                    })

                    if (i > 0) pdfOut.addPage([im.w, im.h])
                    pdfOut.addImage(dataUrl, "JPEG", 0, 0, im.w, im.h)
                }

                outBlob = pdfOut.output("blob")
                if (outBlob.size <= maxSizeBytes) break

                attempt++
                renderScale *= 0.75
                quality = Math.max(0.4, quality * 0.8)
            }

            if (outBlob && outBlob.size <= maxSizeBytes) {
                return new File([outBlob], file.name, { type: "application/pdf" })
            }
        } catch (e) {
            return file
        }
        return file
    }

    return file
}

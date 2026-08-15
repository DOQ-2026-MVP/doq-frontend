/**
 * pdfjs 는 파싱을 별도 워커에서 돌린다 — 번들러가 만든 워커 URL 을 알려주지 않으면
 * 기본 경로를 찾다가 실패한다. 라이브러리·워커 모두 한 번만 불러 재사용한다.
 */
let pdfjsPromise: Promise<any> | null = null

export function loadPdfjs(): Promise<any> {
    if (pdfjsPromise === null) {
        pdfjsPromise = (async () => {
            const lib: any = await import("pdfjs-dist/legacy/build/pdf")
            const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")
            lib.GlobalWorkerOptions.workerSrc = worker.default
            return lib
        })()
    }
    return pdfjsPromise
}

/** PDF 를 페이지별 이미지(dataURL)로 그린다 — 미리보기에서 확대·드래그로 다루기 쉽다. */
export async function renderPdfPages(data: ArrayBuffer, maxPages = 10): Promise<string[]> {
    const pdfjs = await loadPdfjs()
    const pdf = await pdfjs.getDocument({ data }).promise
    const pages: string[] = []
    const count = Math.min(pdf.numPages, maxPages)

    for (let pageNo = 1; pageNo <= count; pageNo++) {
        const page = await pdf.getPage(pageNo)
        const viewport = page.getViewport({ scale: 2 })
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const context = canvas.getContext("2d")
        if (!context) break
        await page.render({ canvasContext: context, viewport }).promise
        pages.push(canvas.toDataURL("image/jpeg", 0.85))
    }

    return pages
}

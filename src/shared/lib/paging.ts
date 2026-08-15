/** 한 페이지에 보여줄 행 수 — 목록이 길어도 화면이 감당하도록 프론트에서 잘라 보여준다. */
export const PAGE_SIZE = 20

export function totalPagesOf(totalCount: number, pageSize = PAGE_SIZE) {
    return Math.max(1, Math.ceil(totalCount / pageSize))
}

/** [start, end) — 현재 페이지가 보여줄 구간. 페이지가 범위를 벗어나면 부모가 먼저 보정한다. */
export function pageSliceOf(page: number, pageSize = PAGE_SIZE) {
    const start = (page - 1) * pageSize
    return { start, end: start + pageSize }
}

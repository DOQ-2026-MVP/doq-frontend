import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiHelper, type ApiEnvelope, unwrap } from "@/shared/api/api.base"
import { API_PATH } from "@/shared/api/api.path"
import { getSessions } from "@/apis/ingestion"
import type {
    ExportRow,
    InspectionBulkConfirmResult,
    InspectionChangeLogDto,
    InspectionDetailDto,
    InspectionRecordDto,
} from "./types"

export const fetchInspectionDetail = (inspectionId: number | string) =>
    unwrap(ApiHelper.get<ApiEnvelope<InspectionDetailDto>>(API_PATH.INSPECTION.DETAIL(inspectionId)))

export const fetchExportJson = (inspectionId: number | string) =>
    ApiHelper.get<ExportRow[]>(API_PATH.INSPECTION.EXPORT_JSON(inspectionId))

export const fetchExportCsvBlob = (inspectionId: number | string) =>
    ApiHelper.get<Blob>(API_PATH.INSPECTION.EXPORT_CSV(inspectionId), { responseType: "blob" as const })

/** 검수(inspectionId) 1개의 남은 NEW 레코드를 일괄 확정한다 (필수값 누락은 건너뜀). */
export const postConfirmInspection = (inspectionId: number | string) =>
    unwrap(ApiHelper.post<ApiEnvelope<InspectionBulkConfirmResult>>(API_PATH.INSPECTION.CONFIRM(inspectionId)))

/** 여러 검수 세션에 걸쳐 일괄 확정 — 세션별로 나눠 순차 집계한다. */
export const confirmAllInspections = async (inspectionIds: (number | string)[]): Promise<InspectionBulkConfirmResult[]> => {
    const results: InspectionBulkConfirmResult[] = []
    for (const id of inspectionIds) {
        results.push(await postConfirmInspection(id))
    }
    return results
}

/*
 * 아래 레코드 단위 API의 recordId는 모두 InspectionRecordDto.id(검수 레코드 PK)다.
 * InspectionRecordDto.ingestionRecordId(인입 원본 행 id)를 넘기면 엉뚱한 레코드에 붙거나 404가 난다.
 */
export const postConfirmRecord = (recordId: number | string, body: { memo?: string } = {}) =>
    unwrap(ApiHelper.post<ApiEnvelope<InspectionRecordDto>>(API_PATH.INSPECTION.RECORD_CONFIRM(recordId), body))

export const postRejectRecord = (recordId: number | string, body: { memo?: string } = {}) =>
    unwrap(ApiHelper.post<ApiEnvelope<InspectionRecordDto>>(API_PATH.INSPECTION.RECORD_REJECT(recordId), body))

/** ingestionId 1개의 검수 상세(그 세션의 레코드 전부)를 가져온다. 없으면 404. */
export const fetchInspections = (ingestionId: number | string) =>
    unwrap(
        ApiHelper.get<ApiEnvelope<InspectionDetailDto>>(API_PATH.INSPECTION.LIST(), {
            params: { ingestionId },
        })
    )

export const patchRecord = (recordId: number | string, body: unknown) =>
    unwrap(ApiHelper.patch<ApiEnvelope<InspectionRecordDto>>(API_PATH.INSPECTION.RECORD_BASE(recordId), body))

export const fetchRecordChangelog = (recordId: number | string) =>
    unwrap(ApiHelper.get<ApiEnvelope<InspectionChangeLogDto[]>>(API_PATH.INSPECTION.RECORD_CHANGELOG(recordId)))

export type MergedInspectionRecord = InspectionRecordDto & { ingestionId: number; inspectionId: number }

/**
 * 구조화 완료된 모든 세션(ingestionId)의 검수 레코드를 하나로 합친다.
 *
 * 대상 세션은 **서버 목록**에서 고른다 — 예전엔 브라우저 localStorage에 기억해 둔 id를 썼는데,
 * 그러면 새로고침·다른 브라우저에서 목록이 비고, DB가 비워지면 죽은 id를 조회해 빈 화면이 됐다.
 */
export const fetchAllInspectionRecords = async (): Promise<MergedInspectionRecord[]> => {
    const sessions = await getSessions()
    const ingestionIds = sessions.filter((s) => s.status === "STRUCTURED").map((s) => String(s.ingestionId))
    const details = await Promise.all(
        ingestionIds.map((id) =>
            fetchInspections(id).catch((e: any) => {
                if (e?.response?.status === 404) return null
                throw e
            })
        )
    )
    return details
        .filter((detail): detail is InspectionDetailDto => detail !== null)
        .flatMap((detail) =>
            detail.records.map((record) => ({
                ...record,
                ingestionId: detail.ingestionId,
                inspectionId: detail.inspectionId,
            }))
        )
}

export function useAllInspectionRecords() {
    return useQuery({
        queryKey: ["inspection", "list"],
        queryFn: fetchAllInspectionRecords,
    })
}

export function useInspectionDetail(inspectionId?: number | string) {
    return useQuery({
        queryKey: ["inspection", inspectionId],
        queryFn: () => fetchInspectionDetail(inspectionId as string),
        enabled: !!inspectionId,
    })
}

export function useInspectionsByIngestion(ingestionId?: number | string) {
    return useQuery({
        queryKey: ["inspection", "list", ingestionId],
        queryFn: () => fetchInspections(ingestionId as string),
        enabled: !!ingestionId,
    })
}

export function usePatchRecord() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: ({ recordId, body }: { recordId: number | string; body: unknown }) => patchRecord(recordId, body),
        onSettled: () => qc.invalidateQueries({ queryKey: ["inspection"] }),
    })
}

export function useRecordChangelog(recordId?: number | string) {
    return useQuery({
        queryKey: ["inspection", "changelog", recordId],
        queryFn: () => fetchRecordChangelog(recordId as string),
        enabled: !!recordId,
    })
}

export function useExportJson(inspectionId?: number | string) {
    return useQuery({
        queryKey: ["inspection", inspectionId, "exportJson"],
        queryFn: () => fetchExportJson(inspectionId as string),
        enabled: !!inspectionId,
    })
}

export function useExportCsv() {
    const queryClient = useQueryClient()
    // mutation: (inspectionId) => Promise<Blob>
    return (useMutation as any)({
        mutationFn: (inspectionId: number | string) => fetchExportCsvBlob(inspectionId),
        onSuccess: (blob: Blob) => {
            try {
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `inspection_export.csv`
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
            } catch (e) {
                // ignore
            }
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ["inspection"] }),
    })
}

export function useConfirmInspection() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: (inspectionId: number | string) => postConfirmInspection(inspectionId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["inspection"] }),
    })
}

export function useConfirmAllInspections() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: (inspectionIds: (number | string)[]) => confirmAllInspections(inspectionIds),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["inspection"] }),
    })
}

export function useConfirmRecord() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: ({ recordId, memo }: { recordId: number | string; memo?: string }) =>
            postConfirmRecord(recordId, { memo }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["inspection"] }),
    })
}

export function useRejectRecord() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: ({ recordId, memo }: { recordId: number | string; memo?: string }) =>
            postRejectRecord(recordId, { memo }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["inspection"] }),
    })
}

export default {
    fetchInspectionDetail,
    fetchExportJson,
    fetchExportCsvBlob,
    postConfirmInspection,
    postConfirmRecord,
    postRejectRecord,
    useInspectionDetail,
    useExportJson,
    useExportCsv,
    useConfirmInspection,
    confirmAllInspections,
    useConfirmAllInspections,
    useConfirmRecord,
    useRejectRecord,
    fetchInspections,
    fetchAllInspectionRecords,
    useAllInspectionRecords,
}

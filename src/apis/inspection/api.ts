import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiHelper, type ApiEnvelope, unwrap } from "@/shared/api/api.base"
import { API_PATH } from "@/shared/api/api.path"
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

/*
 * 상태 전이 3종(확정·반려·재검토)은 모두 경로 변수만 받는다 — 바디가 없다.
 * 예전엔 `{ memo }` 를 실어 보냈지만 서버가 읽지 않고 버렸다. 메모는 편집(PATCH)이 들고 간다.
 */

export const postConfirmRecord = (recordId: number | string) =>
    unwrap(ApiHelper.post<ApiEnvelope<InspectionRecordDto>>(API_PATH.INSPECTION.RECORD_CONFIRM(recordId)))

export const postRejectRecord = (recordId: number | string) =>
    unwrap(ApiHelper.post<ApiEnvelope<InspectionRecordDto>>(API_PATH.INSPECTION.RECORD_REJECT(recordId)))

/** 재검토 — 확정/반려된 레코드를 신규로 되돌린다(편집본은 관찰값으로, 메모는 서버가 지운다). */
export const postResetRecord = (recordId: number | string) =>
    unwrap(ApiHelper.post<ApiEnvelope<InspectionRecordDto>>(API_PATH.INSPECTION.RECORD_RESET(recordId)))

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

export function useConfirmRecord() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: ({ recordId }: { recordId: number | string }) => postConfirmRecord(recordId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["inspection"] }),
    })
}

export function useRejectRecord() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: ({ recordId }: { recordId: number | string }) => postRejectRecord(recordId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["inspection"] }),
    })
}

export function useResetRecord() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: ({ recordId }: { recordId: number | string }) => postResetRecord(recordId),
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
    postResetRecord,
    useInspectionDetail,
    useExportJson,
    useExportCsv,
    useConfirmInspection,
    useConfirmRecord,
    useRejectRecord,
    useResetRecord,
    fetchInspections,
}

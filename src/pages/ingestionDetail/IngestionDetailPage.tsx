import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon, RadioIcon } from "lucide-react"
import { FileDropZone } from "@/features/intake/ui/FileDropZone"
import {
    type ManualRecordInput,
    EMPTY_MANUAL_INPUT,
    isManualInputFilled,
    RawRecordForm,
} from "@/features/intake/ui/RawRecordForm"
import { IngestionStatusBadge } from "@/features/intake/ui/StatusBadge"
import { StructuringPanel } from "@/features/intake/ui/StructuringPanel"
import { useInspection } from "@/shared/context/useInspection"
import { formatDateTime } from "@/shared/utils/format"
import { buildRowsFromFile } from "@/shared/utils/uploadRows"
import { RawRecordTable } from "@/features/ingestionDetail/ui/RawRecordTable"

export function IngestionDetailPage() {
    const { ingestionId } = useParams<{ ingestionId: string }>()
    const navigate = useNavigate()
    const { getSession, appendRawRecords, subscribeRawStream } = useInspection()

    const session = ingestionId ? getSession(ingestionId) : undefined

    const [file, setFile] = useState<File | null>(null)
    const [manual, setManual] = useState<ManualRecordInput>(EMPTY_MANUAL_INPUT)
    const [streamNotice, setStreamNotice] = useState("")
    const [highlightedIds, setHighlightedIds] = useState<string[]>([])

    useEffect(() => {
        if (!ingestionId) return
        const unsubscribe = subscribeRawStream(ingestionId, (appended) => {
            if (appended.length === 0) return
            setStreamNotice("새로운 원본 데이터가 추가되었습니다. (" + appended.length + "건)")
            setHighlightedIds(appended.map((record) => record.id))
        })
        return unsubscribe
    }, [ingestionId, subscribeRawStream])

    if (!session || !ingestionId) {
        return (
            <div className="mx-auto w-full max-w-3xl rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <p className="text-sm font-medium text-gray-900">인입 세션을 찾을 수 없습니다.</p>
                <button
                    type="button"
                    onClick={() => navigate("/intake")}
                    className="mt-4 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    인입 화면으로 이동
                </button>
            </div>
        )
    }

    function handleAddFile() {
        if (!file) return
        appendRawRecords(ingestionId!, buildRowsFromFile(file))
        setFile(null)
    }

    function handleAddManual() {
        if (!isManualInputFilled(manual)) return
        appendRawRecords(ingestionId!, [
            {
                ...manual,
                docId: manual.docId.trim() === "" ? "문서ID 미입력" : manual.docId,
                supplier: manual.supplier.trim() === "" ? "공급사 미입력" : manual.supplier,
                uploadMethod: "MANUAL",
                uploadRowNo: null,
            },
        ])
        setManual(EMPTY_MANUAL_INPUT)
    }

    return (
        <div className="mx-auto w-full max-w-7xl">
            <button
                type="button"
                onClick={() => navigate("/intake")}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
            >
                <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
                인입
            </button>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-xl font-semibold text-gray-900">인입 세션 #{session.ingestionId}</h1>
                    <IngestionStatusBadge status={session.status} />
                    <span className="text-sm text-gray-500">
                        원본 행 {session.records.length}건 · 생성 {formatDateTime(session.createdAt)}
                    </span>
                </div>
                <StructuringPanel ingestionId={session.ingestionId} status={session.status} />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                    <RadioIcon className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                    원본 행 실시간 반영 중
                </span>
                {streamNotice && (
                    <span className="text-xs font-medium text-blue-700" role="status">
                        {streamNotice}
                    </span>
                )}
            </div>

            <section aria-labelledby="raw-title" className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                <h2 id="raw-title" className="border-b border-gray-200 px-5 py-4 text-sm font-semibold text-gray-900">
                    원본 행
                </h2>
                <RawRecordTable records={session.records} highlightedIds={highlightedIds} />
            </section>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-gray-900">파일로 원본 행 추가</h2>
                    <p className="mt-1 text-xs text-gray-500">현재 인입 세션에 파일을 추가로 등록합니다.</p>
                    <div className="mt-4">
                        <FileDropZone file={file} onChange={setFile} />
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={handleAddFile}
                            disabled={!file}
                            className={
                                "rounded-xl px-4 py-2 text-sm font-semibold " +
                                (file
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "cursor-not-allowed bg-gray-100 text-gray-400")
                            }
                        >
                            파일 추가
                        </button>
                    </div>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-gray-900">수기로 원본 행 추가</h2>
                    <p className="mt-1 text-xs text-gray-500">현재 인입 세션에 수기 입력 행을 추가합니다.</p>
                    <div className="mt-4">
                        <RawRecordForm idPrefix="append" value={manual} onChange={setManual} />
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={handleAddManual}
                            disabled={!isManualInputFilled(manual)}
                            className={
                                "rounded-xl px-4 py-2 text-sm font-semibold " +
                                (isManualInputFilled(manual)
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "cursor-not-allowed bg-gray-100 text-gray-400")
                            }
                        >
                            행 추가
                        </button>
                    </div>
                </section>
            </div>
        </div>
    )
}

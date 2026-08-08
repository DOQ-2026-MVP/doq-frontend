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
import type { RawRecordInput } from "@/shared/model/inspection"
import { formatDateTime } from "@/shared/utils/format"
import { buildRowsFromFile } from "@/shared/utils/uploadRows"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

export function IntakePage() {
    const navigate = useNavigate()
    const { sessions, createIngestion, getSession } = useInspection()

    const [file, setFile] = useState<File | null>(null)
    const [manual, setManual] = useState<ManualRecordInput>(EMPTY_MANUAL_INPUT)
    const [error, setError] = useState("")
    const [createdId, setCreatedId] = useState<string | null>(null)

    const createdSession = createdId ? getSession(createdId) : undefined

    function handleRegister() {
        const manualFilled = isManualInputFilled(manual)
        if (!file && !manualFilled) {
            setError("파일을 업로드하거나 수기 입력 항목을 작성해 주세요.")
            return
        }

        const rows: RawRecordInput[] = []
        if (file) rows.push(...buildRowsFromFile(file))
        if (manualFilled) {
            rows.push({
                ...manual,
                docId: manual.docId.trim() === "" ? "문서ID 미입력" : manual.docId,
                supplier: manual.supplier.trim() === "" ? "공급사 미입력" : manual.supplier,
                uploadMethod: "MANUAL",
                uploadRowNo: null,
            })
        }

        const session = createIngestion(rows)
        setCreatedId(session.ingestionId)
        setError("")
        setFile(null)
        setManual(EMPTY_MANUAL_INPUT)
    }

    return (
        <div className="mx-auto w-full max-w-5xl">
            <h1 className="text-xl font-semibold text-gray-900">구매 증빙 인입</h1>
            <p className="mt-1 text-sm text-gray-500">
                파일 업로드 또는 수기 입력으로 인입 세션을 생성합니다. 생성된 세션은 구조화 실행 후 검수 대상이 됩니다.
            </p>

            <section
                aria-labelledby="upload-title"
                className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
                <h2 id="upload-title" className="text-sm font-semibold text-gray-900">
                    파일 업로드
                </h2>
                <p className="mt-1 text-xs text-gray-500">지원 형식: XLSX, CSV (파일 1개)</p>
                <div className="mt-4">
                    <FileDropZone file={file} onChange={setFile} />
                </div>
            </section>

            <section
                aria-labelledby="manual-title"
                className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
                <h2 id="manual-title" className="text-sm font-semibold text-gray-900">
                    수기 입력
                </h2>
                <div className="mt-4">
                    <RawRecordForm idPrefix="intake" value={manual} onChange={setManual} />
                </div>

                {error && (
                    <p className="mt-4 text-sm text-red-600" role="alert">
                        {error}
                    </p>
                )}

                <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
                    <button
                        type="button"
                        onClick={handleRegister}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                        등록
                    </button>
                </div>
            </section>

            {createdSession && (
                <section
                    aria-labelledby="result-title"
                    className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                    <h2 id="result-title" className="text-sm font-semibold text-gray-900">
                        인입 결과
                    </h2>
                    <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="rounded-xl bg-gray-50 px-4 py-3">
                            <dt className="text-xs text-gray-500">인입 세션</dt>
                            <dd className="mt-1 text-sm font-semibold text-gray-900">
                                인입 세션 #{createdSession.ingestionId}
                            </dd>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-4 py-3">
                            <dt className="text-xs text-gray-500">인입 상태</dt>
                            <dd className="mt-1">
                                <IngestionStatusBadge status={createdSession.status} />
                            </dd>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-4 py-3">
                            <dt className="text-xs text-gray-500">원본 행 수</dt>
                            <dd className="mt-1 text-sm font-semibold text-gray-900">
                                원본 행 {createdSession.records.length}건
                            </dd>
                        </div>
                    </dl>

                    <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
                        <StructuringPanel
                            ingestionId={createdSession.ingestionId}
                            status={createdSession.status}
                            showRawLink
                        />
                    </div>
                </section>
            )}

            <section
                aria-labelledby="sessions-title"
                className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm"
            >
                <h2
                    id="sessions-title"
                    className="border-b border-gray-200 px-5 py-4 text-sm font-semibold text-gray-900"
                >
                    인입 세션
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-160 text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                                {["세션 ID", "인입 상태", "원본 행 수", "생성 시각"].map((column) => (
                                    <th
                                        key={column}
                                        scope="col"
                                        className="whitespace-nowrap px-5 py-3 text-xs font-semibold text-gray-500"
                                    >
                                        {column}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map((session) => (
                                <tr
                                    key={session.ingestionId}
                                    tabIndex={0}
                                    role="link"
                                    onClick={() => navigate("/ingestion/" + session.ingestionId)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault()
                                            navigate("/ingestion/" + session.ingestionId)
                                        }
                                    }}
                                    className="cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-blue-50/50 focus:bg-blue-50 focus:outline-none"
                                >
                                    <td className="whitespace-nowrap px-5 py-3 font-medium text-gray-900">
                                        인입 세션 #{session.ingestionId}
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3">
                                        <IngestionStatusBadge status={session.status} />
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3 text-gray-700">
                                        {session.records.length}건
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3 text-gray-500">
                                        {formatDateTime(session.createdAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}

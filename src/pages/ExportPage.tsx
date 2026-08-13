import { useMemo, useState } from "react"
import { CheckCircle2Icon, DownloadIcon, XCircleIcon } from "lucide-react"
import { toast } from "sonner"
import { useInspection } from "@/shared/context/InspectionContext"
import type { InspectionRecord } from "@/shared/model/inspection"
import { formatText, formatPrice } from "@/shared/utils/format"

type Format = "JSON" | "CSV"

interface FailureItem {
    docId: string
    reason: string
}

interface ExportResult {
    format: Format
    success: number
    fail: number
    failures: FailureItem[]
}

/** 내보내기 실패 사유 (필수값 누락 기준) */
function failureReason(record: InspectionRecord): string {
    const missing: string[] = []
    if (record.current.normalizedItemName.trim() === "") missing.push("정규화 품목명")
    if (record.current.unit.trim() === "") missing.push("단위")
    if (record.current.priceAfter.trim() === "") missing.push("변경 단가")
    if (record.current.effectiveDate.trim() === "") missing.push("적용일")
    return missing.length === 0 ? "" : missing.join(", ") + " 누락"
}

function download(fileName: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
}

const HEADER = [
    "문서ID",
    "원본유형",
    "공급사",
    "원문품목명",
    "정규화품목명",
    "규격",
    "단위",
    "기존단가",
    "변경단가",
    "적용일",
]

export function ExportPage() {
    const { records } = useInspection()
    const [result, setResult] = useState<ExportResult | null>(null)

    const confirmed = useMemo(() => records.filter((record) => record.status === "APPROVED"), [records])

    const exportable = confirmed.filter((record) => failureReason(record) === "")
    const failing = confirmed.filter((record) => failureReason(record) !== "")

    function handleExport(target: Format) {
        const payload = exportable.map((record) => ({
            문서ID: record.current.docId,
            원본유형: record.current.sourceType,
            공급사: record.current.supplier,
            원문품목명: record.current.rawItemName,
            정규화품목명: record.current.normalizedItemName,
            규격: record.current.spec,
            단위: record.current.unit,
            기존단가: record.current.priceBefore,
            변경단가: record.current.priceAfter,
            적용일: record.current.effectiveDate,
        }))

        if (target === "JSON") {
            download("confirmed-inspection.json", JSON.stringify(payload, null, 2), "application/json")
        } else {
            const body = payload.map((item) =>
                HEADER.map((key) => '"' + String((item as Record<string, string>)[key]) + '"').join(",")
            )
            download("confirmed-inspection.csv", [HEADER.join(","), ...body].join("\n"), "text/csv;charset=utf-8")
        }

        setResult({
            format: target,
            success: exportable.length,
            fail: failing.length,
            failures: failing.map((record) => ({
                docId: record.current.docId,
                reason: failureReason(record),
            })),
        })
        toast.success("내보내기 완료")
    }

    return (
        <div className="mx-auto w-full max-w-5xl">
            <h1 className="text-xl font-semibold text-gray-900">내보내기</h1>
            <p className="mt-1 text-sm text-gray-500">
                승인된 검수 대상의 현재 검수값만 내보냅니다. 다운로드 전에 대상 데이터를 확인할 수 있습니다.
            </p>

            <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs text-gray-500">승인 완료 건수</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">
                        {confirmed.length}
                        <span className="ml-1 text-sm font-normal text-gray-500">건</span>
                    </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs text-gray-500">내보내기 가능</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">
                        {exportable.length}
                        <span className="ml-1 text-sm font-normal text-gray-500">건</span>
                    </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs text-gray-500">내보내기 불가</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">
                        {failing.length}
                        <span className="ml-1 text-sm font-normal text-gray-500">건</span>
                    </p>
                </div>
            </section>

            <section
                aria-labelledby="preview-title"
                className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm"
            >
                <h2
                    id="preview-title"
                    className="border-b border-gray-200 px-5 py-4 text-sm font-semibold text-gray-900"
                >
                    내보내기 대상 목록
                </h2>
                {confirmed.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-gray-500">승인된 검수 대상이 없습니다.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-225 text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50">
                                    {[
                                        "문서ID",
                                        "공급사",
                                        "정규화 품목명",
                                        "규격",
                                        "단위",
                                        "변경 단가",
                                        "적용일",
                                        "결과",
                                    ].map((column) => (
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
                                {confirmed.map((record) => {
                                    const reason = failureReason(record)
                                    return (
                                        <tr key={record.recordId} className="border-b border-gray-100 last:border-b-0">
                                            <td className="whitespace-nowrap px-5 py-2.5 font-medium text-gray-900">
                                                {record.current.docId}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-2.5 text-gray-700">
                                                {record.current.supplier}
                                            </td>
                                            <td className="px-5 py-2.5 text-gray-900">
                                                {formatText(record.current.normalizedItemName)}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-2.5 text-gray-700">
                                                {formatText(record.current.spec)}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-2.5 text-gray-700">
                                                {formatText(record.current.unit)}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-2.5 text-right text-gray-900">
                                                {formatPrice(record.current.priceAfter)}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-2.5 text-gray-700">
                                                {formatText(record.current.effectiveDate)}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-2.5">
                                                {reason === "" ? (
                                                    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
                                                        내보내기 가능
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                                                        {reason}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex flex-wrap gap-2 border-t border-gray-200 px-5 py-4">
                    <button
                        type="button"
                        onClick={() => handleExport("JSON")}
                        disabled={exportable.length === 0}
                        className={
                            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold " +
                            (exportable.length === 0
                                ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
                                : "border border-primary bg-white text-primary hover:bg-primary-50")
                        }
                    >
                        <DownloadIcon className="h-4 w-4" aria-hidden="true" />
                        JSON 다운로드
                    </button>
                    <button
                        type="button"
                        onClick={() => handleExport("CSV")}
                        disabled={exportable.length === 0}
                        className={
                            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold " +
                            (exportable.length === 0
                                ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
                                : "border border-primary bg-white text-primary hover:bg-primary-50")
                        }
                    >
                        <DownloadIcon className="h-4 w-4" aria-hidden="true" />
                        CSV 다운로드
                    </button>
                </div>
            </section>

            <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900">출력 결과</h2>
                {result === null ? (
                    <p className="mt-3 text-sm text-gray-500">아직 실행된 내보내기가 없습니다.</p>
                ) : (
                    <>
                        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                                <CheckCircle2Icon className="h-5 w-5 text-green-600" aria-hidden="true" />
                                <div>
                                    <dt className="text-xs text-gray-500">성공 건수 ({result.format})</dt>
                                    <dd className="text-sm font-semibold text-gray-900">{result.success}건</dd>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                                <XCircleIcon className="h-5 w-5 text-red-600" aria-hidden="true" />
                                <div>
                                    <dt className="text-xs text-gray-500">실패 건수</dt>
                                    <dd className="text-sm font-semibold text-gray-900">{result.fail}건</dd>
                                </div>
                            </div>
                        </dl>

                        {result.failures.length > 0 && (
                            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 bg-gray-50">
                                            <th scope="col" className="px-4 py-2.5 text-xs font-semibold text-gray-500">
                                                문서ID
                                            </th>
                                            <th scope="col" className="px-4 py-2.5 text-xs font-semibold text-gray-500">
                                                실패 사유
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.failures.map((failure) => (
                                            <tr
                                                key={failure.docId + failure.reason}
                                                className="border-b border-gray-100 last:border-b-0"
                                            >
                                                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900">
                                                    {failure.docId}
                                                </td>
                                                <td className="px-4 py-2.5 text-red-700">{failure.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    )
}

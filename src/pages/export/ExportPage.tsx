import { useMemo, useState } from "react"
import { CheckCircle2Icon, DownloadIcon, XCircleIcon } from "lucide-react"
import { toast } from "sonner"
import { useInspection } from "@/shared/context/useInspection"
import type { InspectionRecord } from "@/shared/model/inspection"

type Format = "JSON" | "CSV"

interface ExportResult {
    format: Format
    success: number
    fail: number
}

function isExportable(record: InspectionRecord): boolean {
    const { normalizedItemName, unit, priceAfter, effectiveDate } = record.current
    return (
        normalizedItemName.trim() !== "" &&
        unit.trim() !== "" &&
        priceAfter.trim() !== "" &&
        effectiveDate.trim() !== ""
    )
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

export function ExportPage() {
    const { records } = useInspection()
    const [format, setFormat] = useState<Format>("JSON")
    const [result, setResult] = useState<ExportResult | null>(null)

    const confirmed = useMemo(() => records.filter((record) => record.status === "CONFIRMED"), [records])

    function handleExport(target: Format) {
        const success = confirmed.filter(isExportable)
        const fail = confirmed.length - success.length

        const payload = success.map((record) => ({
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
            const header = [
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
            const body = payload.map((item) =>
                header.map((key) => '"' + String((item as Record<string, string>)[key]) + '"').join(",")
            )
            download("confirmed-inspection.csv", [header.join(","), ...body].join("\n"), "text/csv;charset=utf-8")
        }

        setFormat(target)
        setResult({ format: target, success: success.length, fail })
        toast.success("Export 완료")
    }

    return (
        <div className="mx-auto w-full max-w-4xl">
            <h1 className="text-xl font-semibold text-gray-900">Export</h1>
            <p className="mt-1 text-sm text-gray-500">확정된 검수 레코드의 현재 검수값만 내보냅니다.</p>

            <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-500">확정 완료 건수</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {confirmed.length}
                    <span className="ml-1 text-sm font-normal text-gray-500">건</span>
                </p>
            </section>

            <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900">출력 형식</h2>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="출력 형식">
                    {(["JSON", "CSV"] as Format[]).map((item) => (
                        <button
                            key={item}
                            type="button"
                            onClick={() => setFormat(item)}
                            aria-pressed={format === item}
                            className={
                                "rounded-xl px-4 py-2 text-sm font-medium transition-colors " +
                                (format === item
                                    ? "bg-blue-600 text-white"
                                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50")
                            }
                        >
                            {item}
                        </button>
                    ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                    <button
                        type="button"
                        onClick={() => handleExport("JSON")}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        <DownloadIcon className="h-4 w-4" aria-hidden="true" />
                        JSON 다운로드
                    </button>
                    <button
                        type="button"
                        onClick={() => handleExport("CSV")}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        <DownloadIcon className="h-4 w-4" aria-hidden="true" />
                        CSV 다운로드
                    </button>
                </div>
            </section>

            <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900">출력 결과</h2>
                {result === null ? (
                    <p className="mt-3 text-sm text-gray-500">아직 실행된 Export가 없습니다.</p>
                ) : (
                    <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                            <CheckCircle2Icon className="h-5 w-5 text-green-600" aria-hidden="true" />
                            <div>
                                <dt className="text-xs text-gray-500">성공 건수</dt>
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
                )}
            </section>
        </div>
    )
}

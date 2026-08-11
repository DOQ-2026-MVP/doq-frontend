import { initialSessions, initialRecords } from "@/data"
import { createContext, useState, useRef, useEffect, useCallback, useMemo } from "react"
import type {
    BulkConfirmResult,
    IngestionSession,
    InspectionRecord,
    InspectionValues,
    RawRecord,
    RawRecordInput,
    RecordStatus,
} from "../model/inspection"
import { buildInspectionRecords, detectFlags, diffValues, toRawRecords } from "../utils/structuring"

type LoadState = "loading" | "error" | "ready"

type StreamListener = (records: RawRecord[]) => void

interface InspectionContextValue {
    sessions: IngestionSession[]
    records: InspectionRecord[]
    loadState: LoadState
    reload: () => void

    createIngestion: (rows: RawRecordInput[]) => IngestionSession
    appendRawRecords: (ingestionId: string, rows: RawRecordInput[]) => void
    runStructuring: (ingestionId: string) => Promise<string>
    subscribeRawStream: (ingestionId: string, listener: StreamListener) => () => void
    getSession: (ingestionId: string) => IngestionSession | undefined
    getRecord: (recordId: string) => InspectionRecord | undefined
    updateRecord: (recordId: string, values: InspectionValues) => void
    resolveRecord: (recordId: string, status: Extract<RecordStatus, "CONFIRMED" | "REJECTED">, memo: string) => void
    bulkConfirm: (inspectionId: string) => BulkConfirmResult
}

export const InspectionContext = createContext<InspectionContextValue | null>(null)

let sessionSequence = 1025

export function InspectionProvider({ children }: { children: React.ReactNode }) {
    const [sessions, setSessions] = useState<IngestionSession[]>(initialSessions)
    const [records, setRecords] = useState<InspectionRecord[]>(initialRecords)
    const [loadState, setLoadState] = useState<LoadState>("loading")
    const [reloadKey, setReloadKey] = useState(0)
    const listeners = useRef<Map<string, Set<StreamListener>>>(new Map())
    const sessionsRef = useRef<IngestionSession[]>(initialSessions)

    useEffect(() => {
        sessionsRef.current = sessions
    }, [sessions])

    useEffect(() => {
        let cancelled = false
        setLoadState("loading")
        const timer = window.setTimeout(() => {
            if (!cancelled) setLoadState("ready")
        }, 600)
        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [reloadKey])

    const reload = useCallback(() => setReloadKey((key) => key + 1), [])

    const emit = useCallback((ingestionId: string, appended: RawRecord[]) => {
        const set = listeners.current.get(ingestionId)
        if (!set) return
        set.forEach((listener) => listener(appended))
    }, [])

    const subscribeRawStream = useCallback((ingestionId: string, listener: StreamListener) => {
        const set = listeners.current.get(ingestionId) ?? new Set<StreamListener>()
        set.add(listener)
        listeners.current.set(ingestionId, set)
        return () => {
            set.delete(listener)
        }
    }, [])

    const createIngestion = useCallback((rows: RawRecordInput[]) => {
        sessionSequence += 1
        const ingestionId = String(sessionSequence)
        const session: IngestionSession = {
            ingestionId,
            status: "DRAFT",
            createdAt: new Date().toISOString(),
            records: toRawRecords(rows, 1, "raw-" + ingestionId),
            inspectionId: null,
        }
        setSessions((prev) => [session, ...prev])
        return session
    }, [])

    const appendRawRecords = useCallback(
        (ingestionId: string, rows: RawRecordInput[]) => {
            let appended: RawRecord[] = []
            setSessions((prev) =>
                prev.map((session) => {
                    if (session.ingestionId !== ingestionId) return session
                    appended = toRawRecords(rows, session.records.length + 1, "raw-" + ingestionId + "-" + Date.now())
                    return { ...session, records: [...session.records, ...appended] }
                })
            )
            window.setTimeout(() => emit(ingestionId, appended), 0)
        },
        [emit]
    )

    const runStructuring = useCallback((ingestionId: string) => {
        setSessions((prev) =>
            prev.map((session) =>
                session.ingestionId === ingestionId ? { ...session, status: "STRUCTURING" } : session
            )
        )

        return new Promise<string>((resolve) => {
            window.setTimeout(() => {
                const inspectionId = "INS-" + ingestionId
                const target = sessionsRef.current.find((item) => item.ingestionId === ingestionId)
                setSessions((prev) =>
                    prev.map((session) =>
                        session.ingestionId === ingestionId
                            ? { ...session, status: "STRUCTURED", inspectionId }
                            : session
                    )
                )
                if (target) {
                    const built = buildInspectionRecords(ingestionId, inspectionId, target.records)
                    setRecords((prevRecords) => [
                        ...prevRecords.filter((record) => record.inspectionId !== inspectionId),
                        ...built,
                    ])
                }
                resolve(inspectionId)
            }, 1400)
        })
    }, [])

    const getSession = useCallback(
        (ingestionId: string) => sessions.find((session) => session.ingestionId === ingestionId),
        [sessions]
    )

    const getRecord = useCallback(
        (recordId: string) => records.find((record) => record.recordId === recordId),
        [records]
    )

    const updateRecord = useCallback((recordId: string, values: InspectionValues) => {
        setRecords((prev) =>
            prev.map((record) => {
                if (record.recordId !== recordId) return record
                const changes = diffValues(record.current, values)
                const flags = detectFlags(
                    {
                        id: record.recordId,
                        rowNo: record.rowNo,
                        uploadMethod: record.uploadMethod,
                        uploadRowNo: record.uploadRowNo,
                        docId: values.docId,
                        sourceType: values.sourceType,
                        supplier: values.supplier,
                        rawItemName: values.rawItemName,
                        spec: values.spec,
                        unit: values.unit,
                        priceBefore: values.priceBefore,
                        priceAfter: values.priceAfter,
                        effectiveDate: values.effectiveDate,
                    },
                    []
                )
                const keptDuplicate = record.flags.includes("DUPLICATE_SUSPECT")
                    ? (["DUPLICATE_SUSPECT"] as const)
                    : ([] as const)
                return {
                    ...record,
                    current: values,
                    flags: [...flags, ...keptDuplicate].filter((flag, index, all) => all.indexOf(flag) === index),
                    changelog:
                        changes.length === 0
                            ? record.changelog
                            : [
                                  ...record.changelog,
                                  {
                                      id: record.recordId + "-CL" + (record.changelog.length + 1),
                                      type: "UPDATE" as const,
                                      fromStatus: record.status,
                                      toStatus: record.status,
                                      changes,
                                      createdAt: new Date().toISOString(),
                                  },
                              ],
                }
            })
        )
    }, [])

    const resolveRecord = useCallback(
        // TODO: memo 를 changelog 에 기록 — ChangelogEntry 에 필드 추가 후 밑줄 제거
        (recordId: string, status: Extract<RecordStatus, "CONFIRMED" | "REJECTED">, _memo: string) => {
            setRecords((prev) =>
                prev.map((record) => {
                    if (record.recordId !== recordId) return record
                    return {
                        ...record,
                        status,
                        changelog: [
                            ...record.changelog,
                            {
                                id: record.recordId + "-CL" + (record.changelog.length + 1),
                                type: status === "CONFIRMED" ? ("CONFIRM" as const) : ("REJECT" as const),
                                fromStatus: record.status,
                                toStatus: status,
                                changes: [],
                                createdAt: new Date().toISOString(),
                            },
                        ],
                    }
                })
            )
        },
        []
    )

    const bulkConfirm = useCallback(
        (inspectionId: string): BulkConfirmResult => {
            const targets = records.filter((record) => record.inspectionId === inspectionId && record.status === "NEW")
            const excludedIds = new Set(
                targets.filter((record) => record.flags.includes("MISSING_REQUIRED")).map((record) => record.recordId)
            )
            const confirmable = targets.filter((record) => !excludedIds.has(record.recordId))
            const confirmableIds = new Set(confirmable.map((record) => record.recordId))

            setRecords((prev) =>
                prev.map((record) => {
                    if (!confirmableIds.has(record.recordId)) return record
                    return {
                        ...record,
                        status: "CONFIRMED" as const,
                        changelog: [
                            ...record.changelog,
                            {
                                id: record.recordId + "-CL" + (record.changelog.length + 1),
                                type: "CONFIRM" as const,
                                fromStatus: record.status,
                                toStatus: "CONFIRMED" as const,
                                changes: [],
                                createdAt: new Date().toISOString(),
                            },
                        ],
                    }
                })
            )

            return { confirmed: confirmable.length, excluded: excludedIds.size }
        },
        [records]
    )

    const value = useMemo(
        () => ({
            sessions,
            records,
            loadState,
            reload,
            createIngestion,
            appendRawRecords,
            runStructuring,
            subscribeRawStream,
            getSession,
            getRecord,
            updateRecord,
            resolveRecord,
            bulkConfirm,
        }),
        [
            sessions,
            records,
            loadState,
            reload,
            createIngestion,
            appendRawRecords,
            runStructuring,
            subscribeRawStream,
            getSession,
            getRecord,
            updateRecord,
            resolveRecord,
            bulkConfirm,
        ]
    )

    return <InspectionContext.Provider value={value}>{children}</InspectionContext.Provider>
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { buildInspectionRecords, detectFlags, diffValues, toRawRecords } from "../utils/structuring"
import { initialSessions, initialRecords } from "@/data"
import type {
    UploadMethod,
    RawRecordInput,
    IngestionSession,
    InspectionRecord,
    InspectionValues,
    RecordStatus,
    IngestionEntry,
} from "../model/inspection"

type LoadState = "loading" | "error" | "ready"

interface NewEntry {
    kind: UploadMethod
    label: string
    needsResize?: boolean
    rows: RawRecordInput[]
}

interface InspectionContextValue {
    sessions: IngestionSession[]
    records: InspectionRecord[]
    loadState: LoadState
    reload: () => void
    createSession: () => IngestionSession
    addEntry: (ingestionId: string, entry: NewEntry) => void
    removeEntry: (ingestionId: string, entryId: string) => void
    startInspection: (ingestionId: string) => Promise<string>
    getSession: (ingestionId: string) => IngestionSession | undefined
    getRecord: (recordId: string) => InspectionRecord | undefined
    updateRecord: (recordId: string, values: InspectionValues) => void
    resolveRecord: (recordId: string, status: Extract<RecordStatus, "APPROVED" | "REJECTED">, memo: string) => void
}

const InspectionContext = createContext<InspectionContextValue | null>(null)

let sessionSequence = 1025
let entrySequence = 0

export function InspectionProvider({ children }: { children: React.ReactNode }) {
    const [sessions, setSessions] = useState<IngestionSession[]>(initialSessions)
    const [records, setRecords] = useState<InspectionRecord[]>(initialRecords)
    const [loadState, setLoadState] = useState<LoadState>("loading")
    const [reloadKey, setReloadKey] = useState(0)
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

    const createSession = useCallback(() => {
        sessionSequence += 1
        const session: IngestionSession = {
            ingestionId: String(sessionSequence),
            status: "DRAFT",
            createdAt: new Date().toISOString(),
            entries: [],
            records: [],
            inspectionId: null,
        }
        setSessions((prev) => [session, ...prev])
        return session
    }, [])

    const addEntry = useCallback((ingestionId: string, entry: NewEntry) => {
        entrySequence += 1
        const entryId = "ENT-" + ingestionId + "-" + entrySequence
        const newEntry: IngestionEntry = {
            entryId,
            kind: entry.kind,
            label: entry.label,
            createdAt: new Date().toISOString(),
            resizeStatus: entry.needsResize ? "PROCESSING" : "NONE",
            rows: entry.rows,
        }
        setSessions((prev) =>
            prev.map((session) =>
                session.ingestionId === ingestionId && session.status === "DRAFT"
                    ? { ...session, entries: [...session.entries, newEntry] }
                    : session
            )
        )

        if (!entry.needsResize) return
        window.setTimeout(() => {
            setSessions((prev) =>
                prev.map((session) =>
                    session.ingestionId === ingestionId
                        ? {
                              ...session,
                              entries: session.entries.map((item) =>
                                  item.entryId === entryId ? { ...item, resizeStatus: "DONE" as const } : item
                              ),
                          }
                        : session
                )
            )
        }, 1600)
    }, [])

    const removeEntry = useCallback((ingestionId: string, entryId: string) => {
        setSessions((prev) =>
            prev.map((session) =>
                session.ingestionId === ingestionId && session.status === "DRAFT"
                    ? {
                          ...session,
                          entries: session.entries.filter((entry) => entry.entryId !== entryId),
                      }
                    : session
            )
        )
    }, [])

    const startInspection = useCallback((ingestionId: string) => {
        setSessions((prev) =>
            prev.map((session) =>
                session.ingestionId === ingestionId ? { ...session, status: "STRUCTURING" } : session
            )
        )

        return new Promise<string>((resolve) => {
            window.setTimeout(() => {
                const inspectionId = "INS-" + ingestionId
                const target = sessionsRef.current.find((item) => item.ingestionId === ingestionId)
                const rawRows = target
                    ? toRawRecords(
                          target.entries.flatMap((entry) => entry.rows),
                          1,
                          "raw-" + ingestionId
                      )
                    : []

                setSessions((prev) =>
                    prev.map((session) =>
                        session.ingestionId === ingestionId
                            ? {
                                  ...session,
                                  status: "STRUCTURED",
                                  inspectionId,
                                  records: rawRows,
                              }
                            : session
                    )
                )

                const built = buildInspectionRecords(ingestionId, inspectionId, rawRows)
                setRecords((prevRecords) => [
                    ...prevRecords.filter((record) => record.inspectionId !== inspectionId),
                    ...built,
                ])
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
                        fileName: record.fileName,
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
        (recordId: string, status: Extract<RecordStatus, "APPROVED" | "REJECTED">, memo: string) => {
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
                                type: status === "APPROVED" ? ("CONFIRM" as const) : ("REJECT" as const),
                                fromStatus: record.status,
                                toStatus: status,
                                changes: [],
                                createdAt: new Date().toISOString(),
                            },
                        ],
                    }
                })
            )
            void memo
        },
        []
    )

    const value = useMemo(
        () => ({
            sessions,
            records,
            loadState,
            reload,
            createSession,
            addEntry,
            removeEntry,
            startInspection,
            getSession,
            getRecord,
            updateRecord,
            resolveRecord,
        }),
        [
            sessions,
            records,
            loadState,
            reload,
            createSession,
            addEntry,
            removeEntry,
            startInspection,
            getSession,
            getRecord,
            updateRecord,
            resolveRecord,
        ]
    )

    return <InspectionContext.Provider value={value}>{children}</InspectionContext.Provider>
}

export function useInspection(): InspectionContextValue {
    const context = useContext(InspectionContext)
    if (!context) {
        throw new Error("useInspection must be used within InspectionProvider")
    }
    return context
}

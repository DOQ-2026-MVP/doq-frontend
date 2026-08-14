import React, { createContext, useCallback, useContext, useMemo, useState } from "react"
import type { UploadMethod, RawRecordInput, IngestionSession, IngestionEntry, IngestionStatus } from "../model/inspection"

interface NewEntry {
    kind: UploadMethod
    label: string
    needsResize?: boolean
    rows: RawRecordInput[]
}

interface InspectionContextValue {
    sessions: IngestionSession[]
    createSession: () => IngestionSession
    addEntry: (ingestionId: string, entry: NewEntry) => void
    removeEntry: (ingestionId: string, entryId: string) => void
    getSession: (ingestionId: string) => IngestionSession | undefined
    /** 로컬 임시 세션(local-N)을 첫 업로드/수기입력 응답으로 받은 실제 서버 ingestionId로 교체한다. */
    linkSession: (localId: string, realIngestionId: string) => void
    setSessionStatus: (ingestionId: string, status: IngestionStatus) => void
    /** 실제 구조화(POST /api/structuring) 성공 후 호출 — 세션을 STRUCTURED로, 실제 inspectionId를 기록한다. */
    markStructured: (ingestionId: string, inspectionId: string) => void
}

const InspectionContext = createContext<InspectionContextValue | null>(null)

let sessionSequence = 1025
let entrySequence = 0

export function InspectionProvider({ children }: { children: React.ReactNode }) {
    const [sessions, setSessions] = useState<IngestionSession[]>([])

    const createSession = useCallback(() => {
        sessionSequence += 1
        const session: IngestionSession = {
            ingestionId: `local-${sessionSequence}`,
            status: "DRAFT",
            createdAt: new Date().toISOString(),
            entries: [],
            records: [],
            inspectionId: null,
            isLocal: true,
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

    const getSession = useCallback(
        (ingestionId: string) => sessions.find((session) => session.ingestionId === ingestionId),
        [sessions]
    )

    const linkSession = useCallback((localId: string, realIngestionId: string) => {
        setSessions((prev) =>
            prev.map((session) =>
                session.ingestionId === localId
                    ? { ...session, ingestionId: realIngestionId, isLocal: false }
                    : session
            )
        )
    }, [])

    const setSessionStatus = useCallback((ingestionId: string, status: IngestionStatus) => {
        setSessions((prev) =>
            prev.map((session) => (session.ingestionId === ingestionId ? { ...session, status } : session))
        )
    }, [])

    const markStructured = useCallback((ingestionId: string, inspectionId: string) => {
        setSessions((prev) =>
            prev.map((session) =>
                session.ingestionId === ingestionId
                    ? { ...session, status: "STRUCTURED", inspectionId }
                    : session
            )
        )
    }, [])

    const value = useMemo(
        () => ({
            sessions,
            createSession,
            addEntry,
            removeEntry,
            getSession,
            linkSession,
            setSessionStatus,
            markStructured,
        }),
        [sessions, createSession, addEntry, removeEntry, getSession, linkSession, setSessionStatus, markStructured]
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

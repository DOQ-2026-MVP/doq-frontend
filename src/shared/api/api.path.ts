export const API_PATH = {
    INSPECTION: {
        LIST: () => `/inspection`,
        DETAIL: (inspectionId: number | string) => `/inspection/${inspectionId}`,
        EXPORT_JSON: (inspectionId: number | string) => `/inspection/${inspectionId}/export.json`,
        EXPORT_CSV: (inspectionId: number | string) => `/inspection/${inspectionId}/export.csv`,
        CONFIRM: (inspectionId: number | string) => `/inspection/${inspectionId}/confirm`,
        RECORD_CONFIRM: (recordId: number | string) => `/inspection/records/${recordId}/confirm`,
        RECORD_REJECT: (recordId: number | string) => `/inspection/records/${recordId}/reject`,
        RECORD_BASE: (recordId: number | string) => `/inspection/records/${recordId}`,
        RECORD_CHANGELOG: (recordId: number | string) => `/inspection/records/${recordId}/changelog`,
    },
    STRUCTURING: {
        RUN: (ingestionId: number | string) => `/structuring/${ingestionId}`,
    },
    INGESTION: {
        UPLOADS: () => `/ingestion/uploads`,
        UPLOADS_FOR: (ingestionId: number | string) => `/ingestion/${ingestionId}/uploads`,
        UPLOAD_CONTENT: (ingestionId: number | string, uploadId: number | string) =>
            `/ingestion/${ingestionId}/uploads/${uploadId}/content`,
        UPLOAD_DELETE: (ingestionId: number | string, uploadId: number | string) =>
            `/ingestion/${ingestionId}/uploads/${uploadId}`,
        RECORDS_FOR: (ingestionId: number | string) => `/ingestion/${ingestionId}/records`,
        RECORD_PUT: (ingestionId: number | string, recordId: number | string) =>
            `/ingestion/${ingestionId}/records/${recordId}`,
        RECORD_DELETE: (ingestionId: number | string, recordId: number | string) =>
            `/ingestion/${ingestionId}/records/${recordId}`,
        RECORDS_DELETE_ALL: (ingestionId: number | string) => `/ingestion/${ingestionId}/records`,
        RECORDS_GLOBAL: () => `/ingestion/records`,
        INGESTION_DETAIL: (ingestionId: number | string) => `/ingestion/${ingestionId}`,
        INGESTION_EVENTS: (ingestionId: number | string) => `/ingestion/${ingestionId}/events`,
    },
}

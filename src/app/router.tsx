import RootRedirect from "../shared/lib/RootRedirect"
import { createBrowserRouter } from "react-router-dom"
import { ExportPage } from "@/pages/export/ExportPage"
import { InboxPage } from "@/pages/inbox/InboxPage"
import { IngestionDetailPage } from "@/pages/ingestionDetail/IngestionDetailPage"
import { InspectionDetailPage } from "@/pages/inspectionDetail/InspectionDetailPage"
import { IntakePage } from "@/pages/intake/IntakePage"
import { Layout } from "@/widget/Layout"

export const router = createBrowserRouter(
    [
        {
            element: <Layout />,
            children: [
                {
                    path: "/",
                    element: <RootRedirect />,
                },
                {
                    path: "/intake",
                    element: <IntakePage />,
                },
                {
                    path: "/ingestion/:ingestionId",
                    element: <IngestionDetailPage />,
                },
                {
                    path: "/inbox",
                    element: <InboxPage />,
                },
                {
                    path: "/inspection/:recordId",
                    element: <InspectionDetailPage />,
                },
                {
                    path: "/export",
                    element: <ExportPage />,
                },
                {
                    path: "*",
                    element: <RootRedirect />,
                },
            ],
        },
    ],
    {
        basename: "/",
    }
)

import { Navigate } from "react-router"

const RootRedirect = () => {
    return <Navigate to={"/intake"} replace />
}

export default RootRedirect

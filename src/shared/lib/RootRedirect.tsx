import { Navigate } from "react-router";

/**
 * @description 토큰 유무에 따른 리다이렉트 처리 (추후 refresh처리에 따라 api 기능 추가)
 */
const RootRedirect = () => {
  const token = localStorage.getItem("accessToken");

  // 지금은 무조건 home
  return <Navigate to={token ? "/home" : "/home"} replace />;
};

export default RootRedirect;

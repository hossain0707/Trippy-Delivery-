import {proxyAuth} from "../../../../lib/auth-bridge.mjs";
export const onRequest = ({request}: {request: Request}) => proxyAuth(request);

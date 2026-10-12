// 주소 /api/verify 로 오는 사전 확인 부탁을 처리해요
import { handleVerify } from "../../lib/core.js";

export const onRequestPost = ({ request, env }) => handleVerify(request, env);

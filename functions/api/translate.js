// 주소 /api/translate 로 오는 번역 부탁을 처리해요
import { handleTranslate } from "../../lib/core.js";

export const onRequestPost = ({ request, env }) => handleTranslate(request, env);

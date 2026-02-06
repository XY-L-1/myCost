import * as Crypto from "expo-crypto";

/**
 * generateUUID
 *
 * 使用 expo-crypto 生成随机 UUID v4
 * 原因：
 * - Expo / Hermes 不支持 Web Crypto
 * - uuid 库依赖 crypto.getRandomValues()
 * - expo-crypto 是官方、安全、跨平台方案
 */
export async function generateUUID(): Promise<string> {
   return Crypto.randomUUID();
}
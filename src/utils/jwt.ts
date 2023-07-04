import jwt, { SignOptions } from "jsonwebtoken";
import configVars from "../../config/custom-env-vars";

export const signJwt = (
  payload: Object,
  keyName: "accessTokenPrivateKey" | "refreshTokenPrivateKey",
  options?: SignOptions
) => {
  const privateKey = Buffer.from(
    // config.get<string>(keyName),
    configVars[keyName] as string,
    "base64"
  ).toString("ascii");

  return jwt.sign(payload, privateKey, {
    ...(options && options),
    algorithm: "RS256",
  });
};

export const verifyJwt = <T>(
  token: string,
  keyName: "accessTokenPublicKey" | "refreshTokenPublicKey"
): T | null => {
  const publicKey = Buffer.from(
    configVars[keyName] as string,
    "base64"
  ).toString("ascii");

  try {
    return jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    }) as T;
  } catch (error) {
    return null;
  }
};

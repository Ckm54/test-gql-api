import { Request } from "express";
import { GraphQLError } from "graphql";
import { verifyJwt } from "../utils/jwt";
import redisClient from "../utils/connectRedis";
import UserModel from "../models/user.model";
import errorHandler from "../controllers/error.controller";

const deserializer = async (req: Request) => {
  try {
    // get the access token
    let access_token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      access_token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.access_token) {
      const { access_token: token } = req.cookies;
      access_token = token;
    }

    if (!access_token) throw new GraphQLError("No access token found");

    // validate the access token
    const decoded = verifyJwt<{ userId: string }>(
      access_token,
      "accessTokenPublicKey"
    );

    if (!decoded) throw new GraphQLError("Invalid access token");

    // check if session is valid
    const session = await redisClient.get(decoded.userId);

    if (!session) throw new GraphQLError("Session has expired.");

    // check if user exists
    const user = await UserModel.findById(JSON.parse(session)._id).select(
      "+verified"
    );

    if (!user || !user.verified) {
      throw new GraphQLError(
        "The user belonging to this token no longer exists"
      );
    }

    return user;
  } catch (error: any) {
    errorHandler(error);
  }
};

export default deserializer;

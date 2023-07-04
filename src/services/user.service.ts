import config from "../../config/default";
import { CookieOptions } from "express";
import { GraphQLError } from "graphql";
import errorHandler from "../controllers/error.controller";
import UserModel, { User } from "../models/user.model";
import { LoginInput } from "../schemas/user.schema";
import { Context } from "../types/context";
import redisClient from "../utils/connectRedis";
import { signJwt, verifyJwt } from "../utils/jwt";
import deserializeUser from "../middleware/deserializeUser";

const accessTokenExpiresIn = config.accessTokenExpiresIn;
// config.get<number>("accessTokenExpiresIn");
const refreshTokenExpiresIn = config.refreshTokenExpiresIn;
// config.get<number>("refreshTokenExpiresIn");

// COOKIE OPTIONS
const cookieOptions: CookieOptions = {
  httpOnly: true,
  // domain: 'localhost',
  sameSite: "none",
  secure: true,
};

const accessTokenCookieOptions = {
  ...cookieOptions,
  maxAge: accessTokenExpiresIn * 60 * 1000,
  expires: new Date(Date.now() + accessTokenExpiresIn * 60 * 1000),
};

const refreshTokenCookieOptions = {
  ...cookieOptions,
  maxAge: refreshTokenExpiresIn * 60 * 1000,
  expires: new Date(Date.now() + refreshTokenExpiresIn * 60 * 1000),
};

if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

async function findByEmail(email: string): Promise<User | null> {
  return UserModel.findOne({ email }).select("+password");
}

// SIGN JWT TOKENS
function signTokens(user: User) {
  const userId: string = user._id.toString();
  const access_token = signJwt({ userId }, "accessTokenPrivateKey", {
    expiresIn: `${accessTokenExpiresIn}m`,
  });

  const refresh_token = signJwt({ userId }, "refreshTokenPrivateKey", {
    expiresIn: `${refreshTokenExpiresIn}m`,
  });

  redisClient.set(userId, JSON.stringify(user), {
    EX: refreshTokenExpiresIn * 60,
  });

  return { access_token, refresh_token };
}

export default class UserService {
  // Register a user
  async signUpUser(input: Partial<User>) {
    try {
      const user = await UserModel.create(input);

      return {
        status: "success",
        user,
      };
    } catch (error: any) {
      if (error.code === 11000) {
        return new GraphQLError("Email already exists");
      }
      errorHandler(error);
    }
  }

  // Login a user
  async loginUser(input: LoginInput, { res }: Context) {
    try {
      const message = "Invalid email or password";
      // 1. Find user by email
      const user = await findByEmail(input.email);

      if (!user) {
        return new GraphQLError(message);
      }

      // 2. Compare passwords
      if (!(await UserModel.comparePasswords(user.password, input.password))) {
        return new GraphQLError(message);
      }

      // 3. Sign jwt tokens
      const { access_token, refresh_token } = signTokens(user);

      // 4. Add tokens to context
      res.cookie("access_token", access_token, accessTokenCookieOptions);
      res.cookie("refresh_token", refresh_token, refreshTokenCookieOptions);
      res.cookie("logged_in", "true", {
        ...accessTokenCookieOptions,
        httpOnly: false,
      });

      return {
        status: "success",
        access_token,
      };
    } catch (error: any) {
      errorHandler(error);
    }
  }

  // Get currently logged in user
  async getMe({ req, res, deserializer }: Context) {
    try {
      const user = await deserializeUser(req);

      return {
        status: "success",
        user,
      };
    } catch (error: any) {
      errorHandler(error);
    }
  }

  // refresh access token
  async refreshAccessToken({ req, res }: Context) {
    try {
      // get the refresh token
      const { refresh_token } = req.cookies;

      // validate refresh token
      const decoded = verifyJwt<{ userId: string }>(
        refresh_token,
        "refreshTokenPublicKey"
      );

      if (!decoded) {
        throw new GraphQLError("Could not refresh access token");
      }

      // Check if user session is valid
      const session = await redisClient.get(decoded.userId);

      if (!session) {
        throw new GraphQLError("User session has expired");
      }

      // Check if user exists and is verified
      const user = await UserModel.findById(JSON.parse(session)._id).select(
        "+verified"
      );

      if (!user || !user.verified) {
        throw new GraphQLError("Could not refresh access token");
      }

      // sign a new access token
      const access_token = signJwt(
        { userId: user.id },
        "accessTokenPrivateKey",
        {
          expiresIn: `${accessTokenExpiresIn}m`,
        }
      );

      // send access_token cookie
      res.cookie("access_token", access_token, accessTokenCookieOptions);
      res.cookie("logged_in", "true", {
        ...accessTokenCookieOptions,
        httpOnly: false,
      });

      return {
        status: "success",
        access_token,
      };
    } catch (error) {
      errorHandler(error);
    }
  }

  // logout a user
  async logoutUser({ req, res }: Context) {
    try {
      const user = await deserializeUser(req);

      // Delete the user session
      await redisClient.del(String(user?._id));

      // Logout a user
      res.cookie("access_token", "", { maxAge: -1 });
      res.cookie("refresh_token", "", { maxAge: -1 });
      res.cookie("logged_in", "", { maxAge: -1 });

      return true;
    } catch (error) {
      errorHandler(error);
    }
  }
}

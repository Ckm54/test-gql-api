import { Request, Response } from "express";
import { User } from "../models/user.model";

export type Context = {
  req: Request;
  res: Response;
  deserializer: (req: Request) => Promise<User | undefined>;
};

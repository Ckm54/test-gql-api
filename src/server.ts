import dotenv from "dotenv";
import app from "./app";
dotenv.config();
import "reflect-metadata";
import http from "http";
import config from "../config/custom-env-vars";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { buildSchema } from "type-graphql";
import { expressMiddleware } from "@apollo/server/express4";
import { resolvers } from "./resolvers";
import { ApolloServer } from "@apollo/server";
import deserializeUser from "./middleware/deserializeUser";
import cors from "cors";
import connectDB from "./utils/connectDB";
import bodyParser from "body-parser";

async function bootstrap() {
  const httpServer = http.createServer(app);

  const schema = await buildSchema({
    resolvers,
    dateScalarMode: "isoDate",
  });

  const server = new ApolloServer({
    schema,
    csrfPrevention: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  // start server
  await server.start();

  app.use(
    "/",
    cors<cors.CorsRequest>(),
    bodyParser.json(),
    expressMiddleware(server, {
      context: async ({ req, res }) => ({ req, res, deserializeUser }),
    })
  );

  // const port = config.get<number>("PORT") || 4000;
  const port = config.PORT;

  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));
  console.log(`🚀 Server ready at http://localhost:${port}/`);

  // CONNECT MONGODB
  connectDB();

  process.on("unhandledRejection", (err: any) => {
    console.log("UNHANDLED REJECTION ?? Shutting down...");
    console.log(err);
    console.error("Error?: ", err.message);

    httpServer.close(async () => {
      process.exit(1);
    });
  });
}

bootstrap();

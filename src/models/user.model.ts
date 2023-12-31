import {
  ModelOptions,
  Severity,
  getModelForClass,
  index,
  pre,
  prop,
} from "@typegoose/typegoose";
import bcrypt from "bcryptjs";
import config from "../../config/default";

@pre<User>("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(
    this.password,
    // config.get<number>("costFactor")
    config.costFactor
  );
  this.passwordConfirm = undefined;
  return next();
})
@ModelOptions({
  schemaOptions: {
    timestamps: true,
  },
  options: {
    allowMixed: Severity.ALLOW,
  },
})
@index({ email: 1 })
export class User {
  readonly _id: string;

  @prop({ required: true })
  name: string;

  @prop({ required: true, unique: true, lowercase: true })
  email: string;

  @prop({ default: "user" })
  role: string;

  @prop({ required: true, select: false })
  password: string;

  @prop({ required: true })
  passwordConfirm: string | undefined;

  @prop({ default: "default.jpg" })
  photo: string;

  @prop({ default: true, select: false })
  verified: boolean;

  static async comparePasswords(
    hashedPassword: string,
    candidatePassword: string
  ) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }
}

const UserModel = getModelForClass<typeof User>(User);
export default UserModel;

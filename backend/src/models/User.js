import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true },
);

userSchema.set("toJSON", {
  transform(_document, returned) {
    delete returned.passwordHash;
    delete returned.__v;
    return returned;
  },
});

export default mongoose.models.User || mongoose.model("User", userSchema);

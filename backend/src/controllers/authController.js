import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/User.js";

const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(8)
    .refine((password) => Buffer.byteLength(password, "utf8") <= 72, {
      message: "Password must not exceed 72 UTF-8 bytes",
    }),
});

const registrationSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(100),
});

const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
  })
  .strict();

function validateBody(schema, body, res) {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  res.status(400).json({
    message: "Validation failed",
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
  return null;
}

function createToken(userId, config) {
  return jwt.sign({}, config.jwtSecret, {
    subject: userId.toString(),
    expiresIn: config.jwtExpiresIn,
    algorithm: "HS256",
  });
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export function createAuthController(config) {
  return {
    async register(req, res) {
      const input = validateBody(registrationSchema, req.body, res);
      if (!input) return;

      try {
        const passwordHash = await bcrypt.hash(input.password, 12);
        const user = await User.create({
          name: input.name,
          email: input.email,
          passwordHash,
        });

        return res.status(201).json({
          message: "Registration successful",
          user: safeUser(user),
          token: createToken(user._id, config),
        });
      } catch (error) {
        if (error?.code === 11000) {
          return res.status(409).json({ message: "An account with this email already exists" });
        }
        throw error;
      }
    },

    async login(req, res) {
      const input = validateBody(credentialsSchema, req.body, res);
      if (!input) return;

      const user = await User.findOne({ email: input.email }).select("+passwordHash");
      if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      return res.status(200).json({
        message: "Login successful",
        user: safeUser(user),
        token: createToken(user._id, config),
      });
    },

    async getCurrentUser(req, res) {
      const user = await User.findById(req.auth.userId);
      if (!user) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }

      return res.status(200).json({ message: "Authenticated user", user: safeUser(user) });
    },

    async updateCurrentUser(req, res) {
      const input = validateBody(profileUpdateSchema, req.body, res);
      if (!input) return;

      const user = await User.findById(req.auth.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.name = input.name;
      await user.save();

      return res.status(200).json({
        message: "Profile updated",
        user: safeUser(user),
      });
    },
  };
}

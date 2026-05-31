import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { createLogger } from "../utils/logger";

const logger = createLogger("http");

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} was not found`
    }
  });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request payload failed validation",
        details: error.flatten()
      }
    });
    return;
  }

  const statusCode = Number(error.statusCode ?? 500);
  if (statusCode >= 500) {
    logger.error(error.message ?? "Unhandled server error", { stack: error.stack });
  }

  res.status(statusCode).json({
    error: {
      code: typeof error.code === "string" ? error.code : statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
      message: error.message ?? "Unexpected error"
    }
  });
};

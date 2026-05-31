"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFoundHandler = void 0;
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)("http");
const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: {
            code: "NOT_FOUND",
            message: `Route ${req.method} ${req.path} was not found`
        }
    });
};
exports.notFoundHandler = notFoundHandler;
const errorHandler = (error, _req, res, _next) => {
    if (error instanceof zod_1.ZodError) {
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
exports.errorHandler = errorHandler;

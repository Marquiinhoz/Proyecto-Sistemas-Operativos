export type ErrorCode = "E001" | "E002" | "E003" | "E004" | "E005";

export interface SystemError {
    code: ErrorCode;
    message: string;
    timestamp: number;
    pid?: number;
}

export class ErrorManager {
    private errors: SystemError[] = [];

    public logError(code: ErrorCode, message: string, pid?: number) {
        this.errors.push({
            code,
            message,
            timestamp: Date.now(),
            pid
        });
    }

    public getErrors() {
        return this.errors;
    }

    public clearErrors() {
        this.errors = [];
    }
}

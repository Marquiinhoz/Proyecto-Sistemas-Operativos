export type ErrorCode = "E001" | "E002" | "E003" | "E004" | "E005";

export interface SystemError {
    code: ErrorCode;
    message: string;
    timestamp: number;
    pid?: number;
}

export class ErrorManager {
    public clearErrors() {
        this.errors = [];
    }
}

import type { HarApiEntry, OperationType } from "./types.js";

const VIDYANO_ENDPOINTS = [
    "GetApplication",
    "GetPersistentObject",
    "GetQuery",
    "ExecuteQuery",
    "ExecuteAction",
] as const;

function classifyUrl(url: string): { operationType: OperationType } {
    const urlObj = new URL(url);
    const path = urlObj.pathname.replace(/^\//, "");

    for (const endpoint of VIDYANO_ENDPOINTS) {
        if (path.startsWith(endpoint))
            return { operationType: endpoint };
    }

    return { operationType: "Other" };
}

function tryParseJson(text: string | undefined): Record<string, any> | null {
    if (!text)
        return null;

    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}

export function parseHarFile(harContent: string): HarApiEntry[] {
    const har = JSON.parse(harContent);
    const entries: any[] = har.log?.entries ?? [];
    const result: HarApiEntry[] = [];
    let index = 0;

    for (const entry of entries) {
        const request = entry.request;
        if (!request || request.method !== "POST")
            continue;

        const { operationType } = classifyUrl(request.url);
        if (operationType === "Other")
            continue;

        const requestBody = tryParseJson(request.postData?.text);
        const responseBody = tryParseJson(entry.response?.content?.text);

        if (!requestBody || !responseBody)
            continue;

        result.push({
            index: index++,
            timestamp: entry.startedDateTime ?? "",
            url: request.url,
            operationType,
            requestBody,
            responseBody,
        });
    }

    return result;
}

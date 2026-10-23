import { Service, ServiceHooks } from "@vidyano/core";

/**
 * Simulates continuation paging on the People query, which the dev backend pages with skip and top.
 * The client sees the first `limit` rows (in the query's own sort) as a query with an unknown total:
 * - a page that is not the last one answers totalItems -1 and the token "offset:<n>" of the next row,
 * - a request with the token "offset:<n>" is sent to the backend as skip n (without the token),
 * - the page that reaches `limit` answers the real total (`limit`, or less for a search) and no token.
 * Only GetQuery and ExecuteQuery of People are changed; it never sends actions or saves settings.
 */

export const PEOPLE = "People";
export const LIMIT = 1234;

export interface PageRequest {
    continuation: string | null;
    top: number | null;
}

interface Hold {
    continuation: string | null;
    requested: () => void;
    released: Promise<void>;
}

export class ContinuationHooks extends ServiceHooks {
    /** Every ExecuteQuery the client sent for People, with the token and top it asked for */
    readonly pages: PageRequest[] = [];
    /** False sends the requests unchanged (used to read the reference rows) */
    simulate = true;
    /** Optionally changes a simulated ExecuteQuery result, given the request's continuation */
    rewrite: ((continuation: string | null, result: any) => void) | null = null;

    #queryId: string = null;
    #holds: Hold[] = [];

    /**
     * Holds the response of the next People page request with the given continuation until released.
     * @returns requested resolves once that request was answered by the backend, release returns the response to the client.
     */
    hold(continuation: string | null): { requested: Promise<void>; release: () => void } {
        let requested: () => void, release: () => void;
        const requestedPromise = new Promise<void>(resolve => requested = resolve);
        const released = new Promise<void>(resolve => release = resolve);
        this.#holds.push({ continuation, requested, released });

        return { requested: requestedPromise, release };
    }

    override async onFetch(request: Request): Promise<Response> {
        if (!this.simulate)
            return super.onFetch(request);

        if (request.url.endsWith("/GetQuery"))
            return this.#getQuery(request);

        if (request.url.endsWith("/ExecuteQuery"))
            return this.#executeQuery(request);

        return super.onFetch(request);
    }

    async #getQuery(request: Request): Promise<Response> {
        const body = await request.clone().json();
        const response = await super.onFetch(request);
        if (body.id !== PEOPLE)
            return response;

        const json = await response.json();
        if (json.query?.result) {
            this.#queryId = json.query.id;
            this.#page(0, json.query.result);
        }

        return this.#respond(json, response);
    }

    async #executeQuery(request: Request): Promise<Response> {
        const body = await request.clone().json();
        if (body.query == null || body.query.id !== this.#queryId)
            return super.onFetch(request);

        const continuation: string | null = body.query.continuation ?? null;
        this.pages.push({ continuation, top: body.query.top ?? null });

        const skip = continuation != null ? parseInt(continuation.substring("offset:".length), 10) : body.query.skip ?? 0;
        body.query.continuation = null;
        body.query.skip = skip;

        const response = await super.onFetch(new Request(request.url, { method: request.method, headers: request.headers, body: JSON.stringify(body) }));
        const json = await response.json();
        if (json.result) {
            this.#page(skip, json.result);
            this.rewrite?.(continuation, json.result);
        }

        const hold = this.#holds.find(h => h.continuation === continuation);
        if (hold) {
            this.#holds.splice(this.#holds.indexOf(hold), 1);
            hold.requested();
            await hold.released;
        }

        return this.#respond(json, response);
    }

    /** Turns the backend's rows at skip into a continuation page over the first LIMIT rows */
    #page(skip: number, result: any) {
        const total = Math.min(result.totalItems, LIMIT);
        result.items = result.items.slice(0, Math.max(0, total - skip));

        const next = skip + result.items.length;
        if (next < total) {
            result.totalItems = -1;
            result.continuation = `offset:${next}`;
        }
        else {
            result.totalItems = total;
            result.continuation = null;
        }
    }

    #respond(json: any, response: Response): Response {
        const headers = new Headers(response.headers);
        headers.delete("content-length");
        headers.delete("content-encoding");

        return new Response(JSON.stringify(json), { status: response.status, headers });
    }
}

/**
 * Reads the ids of the first LIMIT rows the backend returns for People in its default sort, optionally for a text search.
 */
export async function referenceIds(service: Service, hooks: ContinuationHooks, textSearch: string = ""): Promise<string[]> {
    hooks.simulate = false;
    try {
        const query = await service.getQuery(PEOPLE);
        query.textSearch = textSearch;
        query.skip = 0;
        query.top = LIMIT;

        const result = await service.executeQuery(query.parent, query);
        return result.items.map(item => item.id);
    } finally {
        hooks.simulate = true;
    }
}

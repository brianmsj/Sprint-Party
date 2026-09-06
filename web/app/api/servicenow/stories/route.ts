import { NextResponse } from "next/server";
import { fetchServiceNowStories } from "@/app/lib/servicenow/client";
import { ServiceNowError } from "@/app/lib/servicenow/errors";
import type {
  ServiceNowStoriesError,
  ServiceNowStoriesSuccess,
} from "@/app/lib/servicenow/types";

// Credentials-backed data — always run at request time, never cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/servicenow/stories
 *
 * Server-side proxy to the ServiceNow `rm_story` Table API. Reads credentials
 * only from server env, returns a normalized `{ stories }` payload, and maps
 * every failure mode to a `{ error: { code, message, detail? } }` body with an
 * appropriate status. The ServiceNow password never leaves the server.
 */
export async function GET() {
  try {
    const stories = await fetchServiceNowStories();
    const body: ServiceNowStoriesSuccess = { stories };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ServiceNowError) {
      const body: ServiceNowStoriesError = {
        error: {
          code: error.code,
          message: error.message,
          detail: error.detail,
        },
      };
      return NextResponse.json(body, {
        status: error.status,
        headers: { "Cache-Control": "no-store" },
      });
    }

    console.error("Unexpected error in GET /api/servicenow/stories:", error);
    const body: ServiceNowStoriesError = {
      error: {
        code: "SERVICENOW_UNKNOWN",
        message: "An unexpected error occurred while contacting ServiceNow.",
      },
    };
    return NextResponse.json(body, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

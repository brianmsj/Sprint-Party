/**
 * ServiceNow → SprintParty adapter (client-safe).
 *
 * The Planning Queue and the Planning Poker engine are source-agnostic. This is
 * the boundary that turns a ServiceNow `rm_story` record into a generic
 * `QueuedStory`. A Jira or Azure DevOps adapter would live beside this file and
 * produce the same `QueuedStory` shape.
 *
 * No credentials or server-only modules are imported here.
 */

import type { QueuedStory } from "@/app/lib/planningQueue";
import type { ServiceNowStory } from "./types";

export function serviceNowStoryToQueued(story: ServiceNowStory): QueuedStory {
  return {
    key: `servicenow:${story.sysId}`,
    source: "servicenow",
    externalId: story.sysId,
    externalNumber: story.number,
    title: story.shortDescription,
    description: story.description,
    acceptanceCriteria: story.acceptanceCriteria,
    storyPoints: story.storyPoints,
    addedAt: Date.now(),
  };
}

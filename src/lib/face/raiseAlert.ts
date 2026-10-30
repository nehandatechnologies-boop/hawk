import { alertService } from "@/services/resources";
import { queueAlert } from "@/lib/offline/outbox";

import type { Camera, Personnel } from "@/types";
import type { Match } from "@/lib/face/api";

function priorityFor(person: Personnel | undefined): "Critical" | "High" | "Medium" | "Low" {
  const cat = person?.category;
  if (cat === "Wanted") return person?.dangerLevel === "Armed & Dangerous" ? "Critical" : "High";
  if (cat === "Missing") return "High";
  if (cat === "Cleared") return "Low";
  return "Medium";
}

function formatCameraLocation(camera: Camera | null): string {
  if (!camera) return "Unknown location";
  return [camera.location, camera.building].filter(Boolean).join(", ") || "Unknown location";
}

export async function raiseSightingAlert(
  match: Match,
  opts: { sourceLabel: string; camera: Camera | null; personnel: Personnel[]; user: string },
) {
  const person = opts.personnel.find((p) => p.id === match.candidate.personnelId);
  const displayName = person ? `${person.firstName} ${person.lastName}` : match.candidate.personnelName;
  const idLabel = person?.employeeNumber ?? match.candidate.personnelId;
  const cameraLabel = opts.camera ? opts.camera.name : opts.sourceLabel;
  const location = formatCameraLocation(opts.camera);
  const confidencePct = (match.confidence * 100).toFixed(1);
  const categoryTag = person?.category ? `[${person.category.toUpperCase()}] ` : "";
  const dangerNote = person?.dangerLevel && person.dangerLevel !== "Unknown" ? ` Threat: ${person.dangerLevel}.` : "";
  const title = `${categoryTag}${displayName} (Case ${idLabel}) detected on ${cameraLabel} at ${location}`;
  const priority = priorityFor(person);

  const payload = {
    title, priority, status: "Open" as const,
    source: opts.camera ? `${cameraLabel} — ${location}` : opts.sourceLabel,
    timestamp: new Date().toISOString(),
    description:
      `Facial recognition match: ${displayName} (Case ${idLabel})` +
      `${person?.department ? `, issued by ${person.department}` : ""} ` +
      `detected on ${cameraLabel} at ${location}. ` +
      `Confidence ${confidencePct}%.${dangerNote} Captured by ${opts.user}.` +
      (person?.notes ? ` Intel notes: ${person.notes}` : ""),
    assignedOfficer: opts.user,
    subjectId: person?.id,
    subjectCategory: person?.category,
    cameraId: opts.camera?.id,
    confidence: match.confidence,
    latitude: opts.camera?.latitude ?? null,
    longitude: opts.camera?.longitude ?? null,
  };

  try {
    return await alertService.create(payload as any);
  } catch (err) {
    // Off-network capture: queue the sighting locally and replay it on
    // reconnect so no detection is ever lost in the field.
    queueAlert({
      title,
      description: payload.description,
      priority,
      status: "Open",
      source: payload.source,
      camera_id: opts.camera?.id ?? null,
      camera_name: cameraLabel,
      location,
      subject_id: person?.id ?? null,
      subject_name: displayName,
      subject_category: person?.category ?? null,
      match_confidence: match.confidence,
      latitude: opts.camera?.latitude ?? null,
      longitude: opts.camera?.longitude ?? null,
      created_at: payload.timestamp,
      metadata: { offline_capture: true, captured_by: opts.user },
    });
    throw err;
  }
}


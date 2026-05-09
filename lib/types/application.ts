// Mirror of adler-website/lib/types/application.ts. Source of truth: the
// `match /gigApplications/{applicationId}` block in
// adler-app/firestore.rules. Status state machine:
//   pending → shortlisted | awarded | rejected (brand-driven, no revert).

export type ApplicationStatus =
  | "pending"
  | "shortlisted"
  | "awarded"
  | "rejected";

export interface GigApplication {
  /** Deterministic doc id: `${gigId}_${creatorId}`. */
  id: string;
  gigId: string;
  creatorId: string;
  status: ApplicationStatus;
  message: string;
  sampleUrls: string[];
  // Denormalized snapshots, populated at create time. Older docs may have
  // null — render with fallbacks.
  gigTitle: string | null;
  brandId: string | null;
  brandHandle: string | null;
  brandDisplayName: string | null;
  creatorHandle: string | null;
  creatorDisplayName: string | null;
  creatorAvatarUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "Pending",
  shortlisted: "Shortlisted",
  awarded: "Awarded",
  rejected: "Not selected",
};

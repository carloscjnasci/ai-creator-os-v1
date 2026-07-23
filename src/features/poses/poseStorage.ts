import type { Pose } from '@/features/poses/types';

export const POSE_STORAGE_KEY = 'ai-creator-os.poses.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isPose(value: unknown): value is Pose {
  if (!isRecord(value)) {
    return false;
  }

  const { id, name, description, createdAt } = value;

  return (
    typeof id === 'string' &&
    id.length > 0 &&
    typeof name === 'string' &&
    name.length > 0 &&
    typeof description === 'string' &&
    typeof createdAt === 'string' &&
    createdAt.length > 0
  );
}

export function parseStoredPoses(
  serializedPoses: string | null,
): Pose[] {
  if (!serializedPoses) {
    return [];
  }

  try {
    const parsedPoses: unknown = JSON.parse(serializedPoses);

    if (!Array.isArray(parsedPoses)) {
      return [];
    }

    return parsedPoses.filter(isPose);
  } catch {
    return [];
  }
}

export function loadPosesFromStorage(): Pose[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storedPoses = window.localStorage.getItem(
      POSE_STORAGE_KEY,
    );

    return parseStoredPoses(storedPoses);
  } catch {
    return [];
  }
}

export function savePosesToStorage(
  poses: Pose[],
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    window.localStorage.setItem(
      POSE_STORAGE_KEY,
      JSON.stringify(poses),
    );

    return true;
  } catch {
    return false;
  }
}

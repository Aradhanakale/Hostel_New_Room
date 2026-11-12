import { DesiredRoomType, Gender, RoomStatus, RoomType } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface PolicyConfigInput {
  sameGenderOnly: boolean;
  sameYearOnly: boolean;
  allowAcNonAcSwap: boolean;
  requireAcEligibility: boolean;
  requireSameBedCount: boolean;
  maxSwapsPerSemester: number;
  cooldownDays: number;
  maxCycleLength: number;
  acceptanceTimeoutHours: number;
  blockedWindowStart: Date | null;
  blockedWindowEnd: Date | null;
  exchangeDeadline: Date | null;
}

export interface StudentContext {
  id: string;
  gender: Gender;
  year: number;
  acEligible: boolean;
  isRestricted: boolean;
  swapsThisSemester: number;
  lastSwapAt: Date | null;
  hasActiveRequest: boolean;
}

export interface RoomContext {
  id: string;
  roomNumber: string;
  hostelId: string;
  blockId: string;
  floor: number;
  type: RoomType;
  bedCount: number;
  capacity: number;
  gender: Gender;
  status: RoomStatus;
  occupantYears?: number[];
}

export interface RequestCriteria {
  desiredRoomId?: string | null;
  desiredRoomType: DesiredRoomType;
  desiredBedCount?: number | null;
  expiresAt: Date;
}

export interface PolicyCheckResult {
  code: string;
  title: string;
  passed: boolean;
  message: string;
}

export interface PolicyValidationOutput {
  passed: boolean;
  checks: PolicyCheckResult[];
}

export function evaluateExchangeRequestPolicy(params: {
  student: StudentContext;
  currentRoom: RoomContext | null;
  targetRoom: RoomContext | null;
  criteria: RequestCriteria;
  policy: PolicyConfigInput;
  now?: Date;
}): PolicyValidationOutput {
  const { student, currentRoom, targetRoom, criteria, policy } = params;
  const now = params.now ?? new Date();
  const checks: PolicyCheckResult[] = [];

  // 1. Active allocation check
  checks.push({
    code: 'ALLOCATION_ACTIVE',
    title: 'Active Room Allocation',
    passed: currentRoom !== null,
    message: currentRoom
      ? `Currently assigned to Room ${currentRoom.roomNumber} (${currentRoom.type}, ${currentRoom.bedCount}-bed).`
      : 'Student does not hold an active room and bed allocation.',
  });

  // 2. Student restriction check
  checks.push({
    code: 'STUDENT_NOT_RESTRICTED',
    title: 'Student Standing',
    passed: !student.isRestricted,
    message: !student.isRestricted
      ? 'Account is in good standing with no administrative holds.'
      : 'Your account has a disciplinary/fee restriction preventing room swaps.',
  });

  // 3. No pending duplicate requests
  checks.push({
    code: 'NO_PENDING_DUPLICATE',
    title: 'No Duplicate Active Request',
    passed: !student.hasActiveRequest,
    message: !student.hasActiveRequest
      ? 'No conflicting active exchange requests found.'
      : 'You already have an active exchange request in progress.',
  });

  // 4. Max swaps per semester
  const underMaxSwaps = student.swapsThisSemester < policy.maxSwapsPerSemester;
  checks.push({
    code: 'MAX_SWAPS_SEMESTER',
    title: 'Semester Swap Quota',
    passed: underMaxSwaps,
    message: underMaxSwaps
      ? `Used ${student.swapsThisSemester} of ${policy.maxSwapsPerSemester} allowed swaps this semester.`
      : `Semester swap limit reached (${student.swapsThisSemester}/${policy.maxSwapsPerSemester}).`,
  });

  // 5. Cooldown period
  let cooldownPassed = true;
  let cooldownMsg = 'No cooldown period active.';
  if (student.lastSwapAt && policy.cooldownDays > 0) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysSinceLast = (now.getTime() - student.lastSwapAt.getTime()) / msPerDay;
    if (daysSinceLast < policy.cooldownDays) {
      cooldownPassed = false;
      const remaining = Math.ceil(policy.cooldownDays - daysSinceLast);
      cooldownMsg = `Cooldown period active. ${remaining} day(s) remaining before next swap.`;
    } else {
      cooldownMsg = `Cooldown period cleared (${Math.floor(daysSinceLast)} days since last swap).`;
    }
  }
  checks.push({
    code: 'COOLDOWN_PERIOD',
    title: 'Cooldown Period',
    passed: cooldownPassed,
    message: cooldownMsg,
  });

  // 6. Blocked windows & deadline
  let windowPassed = true;
  let windowMsg = 'Exchange window is currently open.';
  if (policy.blockedWindowStart && policy.blockedWindowEnd) {
    if (now >= policy.blockedWindowStart && now <= policy.blockedWindowEnd) {
      windowPassed = false;
      windowMsg = `Room exchanges are currently frozen until ${policy.blockedWindowEnd.toISOString().slice(0, 10)}.`;
    }
  }
  if (windowPassed && policy.exchangeDeadline && now > policy.exchangeDeadline) {
    windowPassed = false;
    windowMsg = `Semester exchange deadline passed on ${policy.exchangeDeadline.toISOString().slice(0, 10)}.`;
  }
  checks.push({
    code: 'EXCHANGE_WINDOW_OPEN',
    title: 'Exchange Window & Deadline',
    passed: windowPassed,
    message: windowMsg,
  });

  // 7. Request expiry date valid
  const expiryPassed = criteria.expiresAt > now;
  checks.push({
    code: 'VALID_EXPIRY_DATE',
    title: 'Request Expiry Date',
    passed: expiryPassed,
    message: expiryPassed
      ? `Request valid until ${criteria.expiresAt.toISOString().slice(0, 10)}.`
      : 'Expiry date must be in the future.',
  });

  // 8. Target room validity (if specific room selected)
  if (criteria.desiredRoomId) {
    const targetExists = targetRoom !== null;
    const notSameRoom = targetRoom && currentRoom ? targetRoom.id !== currentRoom.id : true;
    const notMaintenance = targetRoom ? targetRoom.status !== 'MAINTENANCE' : false;
    const passed = targetExists && notSameRoom && notMaintenance;
    let message = 'Target room is eligible for exchange.';
    if (!targetExists) message = 'Requested target room does not exist.';
    else if (!notSameRoom) message = 'Cannot request an exchange to your current room.';
    else if (!notMaintenance) message = `Room ${targetRoom!.roomNumber} is currently under maintenance.`;

    checks.push({
      code: 'TARGET_ROOM_VALID',
      title: 'Target Room Availability',
      passed,
      message,
    });
  }

  // 9. Same gender block check (if target room specified)
  if (policy.sameGenderOnly && targetRoom) {
    const genderMatch = targetRoom.gender === 'COED' || targetRoom.gender === student.gender;
    checks.push({
      code: 'SAME_GENDER_BLOCK',
      title: 'Gender Block Policy',
      passed: genderMatch,
      message: genderMatch
        ? `Target room matches student gender (${student.gender}).`
        : `Room ${targetRoom.roomNumber} is designated ${targetRoom.gender}; student is ${student.gender}.`,
    });
  }

  // 10. Same year / batch rule (optional)
  if (policy.sameYearOnly && targetRoom && targetRoom.occupantYears && targetRoom.occupantYears.length > 0) {
    const yearMatch = targetRoom.occupantYears.every((y) => y === student.year);
    checks.push({
      code: 'SAME_YEAR_RULE',
      title: 'Year / Batch Compatibility',
      passed: yearMatch,
      message: yearMatch
        ? `Target room occupants match Year ${student.year}.`
        : `Hostel policy enforces same-year roommates (target room has Year ${targetRoom.occupantYears.join(', ')}).`,
    });
  }

  // 11. AC / Non-AC & AC eligibility check
  const desiredType = targetRoom ? targetRoom.type : criteria.desiredRoomType;
  let acPassed = true;
  let acMsg = 'Room type and AC eligibility satisfied.';
  if (currentRoom && desiredType !== 'ANY') {
    const isCrossType = currentRoom.type !== desiredType;
    if (isCrossType && !policy.allowAcNonAcSwap) {
      acPassed = false;
      acMsg = `Hostel policy prohibits ${currentRoom.type} ↔ ${desiredType} swaps.`;
    } else if (desiredType === 'AC' && policy.requireAcEligibility && !student.acEligible) {
      acPassed = false;
      acMsg = `AC room requested, but student has not met AC fee/eligibility requirements.`;
    }
  } else if (desiredType === 'AC' && policy.requireAcEligibility && !student.acEligible) {
    acPassed = false;
    acMsg = `AC room requested, but student has not met AC fee/eligibility requirements.`;
  }
  checks.push({
    code: 'AC_ELIGIBILITY_AND_TYPE',
    title: 'AC / Non-AC Eligibility',
    passed: acPassed,
    message: acMsg,
  });

  // 12. Bed-count / capacity compatibility
  if (currentRoom) {
    let bedPassed = true;
    let bedMsg = `Bed-count rules satisfied (${currentRoom.bedCount}-bed).`;
    if (policy.requireSameBedCount) {
      if (targetRoom && targetRoom.bedCount !== currentRoom.bedCount) {
        bedPassed = false;
        bedMsg = `Policy requires matching bed count (${currentRoom.bedCount}-bed vs ${targetRoom.bedCount}-bed).`;
      } else if (
        criteria.desiredBedCount &&
        criteria.desiredBedCount !== currentRoom.bedCount
      ) {
        bedPassed = false;
        bedMsg = `Policy requires matching bed count (${currentRoom.bedCount}-bed).`;
      }
    }
    checks.push({
      code: 'BED_COUNT_COMPATIBILITY',
      title: 'Bed Count & Capacity',
      passed: bedPassed,
      message: bedMsg,
    });
  }

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}

/**
 * Checks whether Student A (currently in roomA) can legally move into roomB occupied by Student B
 * during graph edge construction.
 */
export function canStudentMoveIntoRoom(params: {
  student: StudentContext;
  currentRoom: RoomContext;
  targetRoom: RoomContext;
  policy: PolicyConfigInput;
}): { allowed: boolean; reason?: string } {
  const { student, currentRoom, targetRoom, policy } = params;

  if (targetRoom.id === currentRoom.id) {
    return { allowed: false, reason: 'Same room' };
  }
  if (targetRoom.status === 'MAINTENANCE') {
    return { allowed: false, reason: `Room ${targetRoom.roomNumber} is under maintenance` };
  }
  if (policy.sameGenderOnly && targetRoom.gender !== 'COED' && targetRoom.gender !== student.gender) {
    return { allowed: false, reason: 'Gender mismatch' };
  }
  if (
    policy.sameYearOnly &&
    targetRoom.occupantYears &&
    targetRoom.occupantYears.length > 0 &&
    !targetRoom.occupantYears.every((y) => y === student.year)
  ) {
    return { allowed: false, reason: 'Year/batch mismatch' };
  }
  if (currentRoom.type !== targetRoom.type && !policy.allowAcNonAcSwap) {
    return { allowed: false, reason: `Policy prohibits ${currentRoom.type} to ${targetRoom.type} swap` };
  }
  if (targetRoom.type === 'AC' && policy.requireAcEligibility && !student.acEligible) {
    return { allowed: false, reason: 'Student is not AC-eligible' };
  }
  if (policy.requireSameBedCount && targetRoom.bedCount !== currentRoom.bedCount) {
    return { allowed: false, reason: 'Bed count mismatch' };
  }

  return { allowed: true };
}

export async function getActivePolicy(hostelId?: string | null): Promise<PolicyConfigInput> {
  if (hostelId) {
    const hostelPolicy = await prisma.policy.findUnique({ where: { hostelId } });
    if (hostelPolicy) return hostelPolicy;
  }
  const globalPolicy = await prisma.policy.findFirst({ where: { hostelId: null } });
  if (globalPolicy) return globalPolicy;

  return {
    sameGenderOnly: true,
    sameYearOnly: false,
    allowAcNonAcSwap: false,
    requireAcEligibility: true,
    requireSameBedCount: false,
    maxSwapsPerSemester: 2,
    cooldownDays: 14,
    maxCycleLength: 5,
    acceptanceTimeoutHours: 48,
    blockedWindowStart: null,
    blockedWindowEnd: null,
    exchangeDeadline: null,
  };
}

import bcrypt from 'bcryptjs';
import { Gender, PrismaClient, RoomType } from '@prisma/client';

const prisma = new PrismaClient();

const BRANCHES = ['CSE', 'ECE', 'ME', 'CE', 'EE', 'IT'];
const FIRST_NAMES_MALE = [
  'Aditya', 'Siddharth', 'Karan', 'Nikhil', 'Pranav', 'Ishaan', 'Varun', 'Harsh',
  'Gaurav', 'Manish', 'Vivek', 'Saurabh', 'Tushar', 'Ayush', 'Rajat', 'Abhishek',
  'Mohit', 'Yash', 'Kunal', 'Shubham', 'Ritvik', 'Devansh', 'Aryan', 'Rishabh',
  'Nitin', 'Piyush', 'Mayank', 'Ankit', 'Akash', 'Sumit', 'Chirag', 'Tarun',
];
const FIRST_NAMES_FEMALE = [
  'Priya', 'Sneha', 'Riya', 'Kavya', 'Neha', 'Pooja', 'Shreya', 'Aditi',
  'Nandini', 'Simran', 'Kritika', 'Swati', 'Muskan', 'Sakshi', 'Tanya', 'Aishwarya',
  'Divya', 'Nikita', 'Komal', 'Bhavna', 'Pallavi', 'Garima', 'Ishita', 'Sonal',
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Patel', 'Reddy', 'Nair', 'Singh', 'Iyer',
  'Joshi', 'Kulkarni', 'Mishra', 'Agarwal', 'Tiwari', 'Chauhan', 'Bose', 'Das',
];

async function main() {
  console.log('🧹 Clearing existing data...');
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.swapParticipant.deleteMany();
  await prisma.exchangeRequest.deleteMany();
  await prisma.swapGroup.deleteMany();
  await prisma.bed.deleteMany();
  await prisma.student.deleteMany();
  await prisma.room.deleteMany();
  await prisma.block.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.hostel.deleteMany();
  await prisma.user.deleteMany();

  console.log('🏛️ Creating hostels, blocks, and policies...');
  const boysHostel = await prisma.hostel.create({
    data: {
      name: 'Aryabhatta Boys Hostel',
      code: 'ABH',
      gender: 'MALE',
      address: 'North Campus Sector 2',
      description: 'Primary undergraduate & postgraduate boys residence with AC & Non-AC wings.',
    },
  });

  const girlsHostel = await prisma.hostel.create({
    data: {
      name: 'Kalpana Chawla Girls Hostel',
      code: 'KCGH',
      gender: 'FEMALE',
      address: 'South Campus Sector 1',
      description: 'Modern girls residence featuring single, twin, and triple occupancy rooms.',
    },
  });

  const abhBlockA = await prisma.block.create({
    data: { hostelId: boysHostel.id, name: 'Block A (Main)', code: 'A', floors: 4, gender: 'MALE' },
  });
  const abhBlockB = await prisma.block.create({
    data: { hostelId: boysHostel.id, name: 'Block B (Annex)', code: 'B', floors: 4, gender: 'MALE' },
  });
  const kcghBlockA = await prisma.block.create({
    data: { hostelId: girlsHostel.id, name: 'Block A (Jasmine)', code: 'A', floors: 4, gender: 'FEMALE' },
  });
  const kcghBlockB = await prisma.block.create({
    data: { hostelId: girlsHostel.id, name: 'Block B (Lotus)', code: 'B', floors: 4, gender: 'FEMALE' },
  });

  // Admin & Warden Users
  const adminHash = await bcrypt.hash('Admin@123', 10);
  const wardenHash = await bcrypt.hash('Warden@123', 10);
  const studentHash = await bcrypt.hash('Student@123', 10);

  const adminUser = await prisma.user.create({
    data: {
      name: 'Dr. Rajesh Khanna',
      email: 'admin@hostel.edu',
      passwordHash: adminHash,
      role: 'ADMIN',
      phone: '+91-9876500001',
    },
  });

  const wardenUser = await prisma.user.create({
    data: {
      name: 'Prof. Vikramaditya Rao',
      email: 'warden@hostel.edu',
      passwordHash: wardenHash,
      role: 'WARDEN',
      phone: '+91-9876500002',
    },
  });

  // Global default policy
  await prisma.policy.create({
    data: {
      hostelId: null,
      name: 'Global Campus Swap Policy',
      sameGenderOnly: true,
      sameYearOnly: false,
      allowAcNonAcSwap: false,
      requireAcEligibility: true,
      requireSameBedCount: false,
      maxSwapsPerSemester: 2,
      cooldownDays: 14,
      maxCycleLength: 5,
      acceptanceTimeoutHours: 48,
      exchangeDeadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      updatedBy: adminUser.email,
    },
  });

  console.log('🚪 Creating rooms and beds...');
  type RoomSeedSpec = {
    hostelId: string;
    blockId: string;
    roomNumber: string;
    floor: number;
    bedCount: number;
    type: RoomType;
    gender: Gender;
  };

  const roomSpecs: RoomSeedSpec[] = [
    // Boys Hostel Block A (Hero demo rooms + variety)
    { hostelId: boysHostel.id, blockId: abhBlockA.id, roomNumber: 'A-101', floor: 1, bedCount: 2, type: 'AC', gender: 'MALE' },
    { hostelId: boysHostel.id, blockId: abhBlockA.id, roomNumber: 'A-102', floor: 1, bedCount: 2, type: 'NON_AC', gender: 'MALE' },
    { hostelId: boysHostel.id, blockId: abhBlockA.id, roomNumber: 'A-103', floor: 1, bedCount: 3, type: 'NON_AC', gender: 'MALE' },
    { hostelId: boysHostel.id, blockId: abhBlockA.id, roomNumber: 'A-104', floor: 1, bedCount: 4, type: 'NON_AC', gender: 'MALE' },
    { hostelId: boysHostel.id, blockId: abhBlockA.id, roomNumber: 'A-205', floor: 2, bedCount: 2, type: 'AC', gender: 'MALE' },
    { hostelId: boysHostel.id, blockId: abhBlockA.id, roomNumber: 'A-206', floor: 2, bedCount: 2, type: 'AC', gender: 'MALE' },
    { hostelId: boysHostel.id, blockId: abhBlockA.id, roomNumber: 'A-207', floor: 2, bedCount: 3, type: 'NON_AC', gender: 'MALE' },
    { hostelId: boysHostel.id, blockId: abhBlockA.id, roomNumber: 'A-310', floor: 3, bedCount: 2, type: 'AC', gender: 'MALE' },
    { hostelId: boysHostel.id, blockId: abhBlockA.id, roomNumber: 'A-311', floor: 3, bedCount: 1, type: 'AC', gender: 'MALE' },
    { hostelId: boysHostel.id, blockId: abhBlockA.id, roomNumber: 'A-312', floor: 3, bedCount: 1, type: 'AC', gender: 'MALE' },
  ];

  // Add 14 more Boys Block A & B rooms
  for (let i = 1; i <= 14; i++) {
    const floor = ((i - 1) % 4) + 1;
    const roomNum = `B-${floor}0${(i % 9) + 1}`;
    const bedCount = i <= 4 ? 2 : i <= 9 ? 3 : i <= 12 ? 4 : 6;
    const type: RoomType = i <= 6 ? 'AC' : 'NON_AC';
    roomSpecs.push({
      hostelId: boysHostel.id,
      blockId: abhBlockB.id,
      roomNumber: roomNum,
      floor,
      bedCount,
      type,
      gender: 'MALE',
    });
  }

  // Add Girls Hostel Block A & B rooms (20 rooms)
  const girlsNamedRooms: RoomSeedSpec[] = [
    { hostelId: girlsHostel.id, blockId: kcghBlockA.id, roomNumber: 'GA-101', floor: 1, bedCount: 2, type: 'AC', gender: 'FEMALE' },
    { hostelId: girlsHostel.id, blockId: kcghBlockA.id, roomNumber: 'GA-102', floor: 1, bedCount: 2, type: 'AC', gender: 'FEMALE' },
    { hostelId: girlsHostel.id, blockId: kcghBlockA.id, roomNumber: 'GA-103', floor: 1, bedCount: 2, type: 'AC', gender: 'FEMALE' },
    { hostelId: girlsHostel.id, blockId: kcghBlockA.id, roomNumber: 'GA-104', floor: 1, bedCount: 3, type: 'NON_AC', gender: 'FEMALE' },
    { hostelId: girlsHostel.id, blockId: kcghBlockA.id, roomNumber: 'GA-201', floor: 2, bedCount: 1, type: 'AC', gender: 'FEMALE' },
    { hostelId: girlsHostel.id, blockId: kcghBlockA.id, roomNumber: 'GA-202', floor: 2, bedCount: 2, type: 'NON_AC', gender: 'FEMALE' },
  ];
  roomSpecs.push(...girlsNamedRooms);

  for (let i = 1; i <= 14; i++) {
    const floor = ((i - 1) % 4) + 1;
    const roomNum = `GB-${floor}0${(i % 9) + 1}`;
    const bedCount = i <= 5 ? 2 : i <= 10 ? 3 : 4;
    const type: RoomType = i <= 7 ? 'AC' : 'NON_AC';
    roomSpecs.push({
      hostelId: girlsHostel.id,
      blockId: kcghBlockB.id,
      roomNumber: roomNum,
      floor,
      bedCount,
      type,
      gender: 'FEMALE',
    });
  }

  // Deduplicate roomNumbers per block just in case
  const seenRoomKey = new Set<string>();
  const createdRooms: Array<Awaited<ReturnType<typeof prisma.room.create>> & { beds: Array<{ id: string; bedLabel: string }> }> = [];

  for (const spec of roomSpecs) {
    const key = `${spec.blockId}:${spec.roomNumber}`;
    if (seenRoomKey.has(key)) continue;
    seenRoomKey.add(key);

    const bedLabels = Array.from({ length: spec.bedCount }, (_, i) => `B${i + 1}`);
    const room = await prisma.room.create({
      data: {
        hostelId: spec.hostelId,
        blockId: spec.blockId,
        roomNumber: spec.roomNumber,
        floor: spec.floor,
        bedCount: spec.bedCount,
        capacity: spec.bedCount,
        type: spec.type,
        gender: spec.gender,
        status: 'AVAILABLE',
        beds: {
          create: bedLabels.map((bedLabel) => ({ bedLabel })),
        },
      },
      include: { beds: { orderBy: { bedLabel: 'asc' } } },
    });
    createdRooms.push(room);
  }

  const findRoom = (roomNumber: string) => {
    const r = createdRooms.find((rm) => rm.roomNumber === roomNumber);
    if (!r) throw new Error(`Missing room ${roomNumber}`);
    return r;
  };

  console.log('👩‍🎓 Creating 110+ students and assigning beds...');
  let rollSeq = 2024001;

  async function createStudentWithBed(params: {
    name: string;
    email: string;
    year: number;
    gender: Gender;
    branch: string;
    acEligible: boolean;
    isRestricted?: boolean;
    roomNumber: string;
    bedIndex: number;
  }) {
    const room = findRoom(params.roomNumber);
    const bed = room.beds[params.bedIndex];
    if (!bed) throw new Error(`Missing bed index ${params.bedIndex} in ${params.roomNumber}`);

    const user = await prisma.user.create({
      data: {
        name: params.name,
        email: params.email,
        passwordHash: studentHash,
        role: 'STUDENT',
        phone: `+91-98${String(rollSeq).slice(-8)}`,
      },
    });

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        rollNumber: `CS${rollSeq++}`,
        year: params.year,
        gender: params.gender,
        branch: params.branch,
        acEligible: params.acEligible,
        isRestricted: params.isRestricted ?? false,
      },
    });

    await prisma.bed.update({
      where: { id: bed.id },
      data: { studentId: student.id, occupiedAt: new Date() },
    });

    return { user, student, room, bed };
  }

  // Hero Viva Demo Students
  const aarav = await createStudentWithBed({
    name: 'Aarav Sharma',
    email: 'aarav@hostel.edu',
    year: 3,
    gender: 'MALE',
    branch: 'CSE',
    acEligible: true,
    roomNumber: 'A-101',
    bedIndex: 0,
  });

  const rohan = await createStudentWithBed({
    name: 'Rohan Verma',
    email: 'rohan@hostel.edu',
    year: 3,
    gender: 'MALE',
    branch: 'ECE',
    acEligible: true,
    roomNumber: 'A-205',
    bedIndex: 1,
  });

  const kabir = await createStudentWithBed({
    name: 'Kabir Mehta',
    email: 'kabir@hostel.edu',
    year: 3,
    gender: 'MALE',
    branch: 'CSE',
    acEligible: true,
    roomNumber: 'A-310',
    bedIndex: 0,
  });

  // Non-AC not eligible student
  const deepak = await createStudentWithBed({
    name: 'Deepak Kumar',
    email: 'deepak@hostel.edu',
    year: 2,
    gender: 'MALE',
    branch: 'ME',
    acEligible: false,
    roomNumber: 'A-102',
    bedIndex: 0,
  });

  // Non-AC eligible student
  const tanmay = await createStudentWithBed({
    name: 'Tanmay Joshi',
    email: 'tanmay@hostel.edu',
    year: 2,
    gender: 'MALE',
    branch: 'IT',
    acEligible: true,
    roomNumber: 'A-103',
    bedIndex: 1,
  });

  // Direct swap pair awaiting Warden Approval
  const vikram = await createStudentWithBed({
    name: 'Vikram Malhotra',
    email: 'vikram@hostel.edu',
    year: 4,
    gender: 'MALE',
    branch: 'CSE',
    acEligible: true,
    roomNumber: 'B-101',
    bedIndex: 0,
  });

  const arjun = await createStudentWithBed({
    name: 'Arjun Nair',
    email: 'arjun@hostel.edu',
    year: 4,
    gender: 'MALE',
    branch: 'EE',
    acEligible: true,
    roomNumber: 'B-202',
    bedIndex: 0,
  });

  // Restricted student for negative testing
  await createStudentWithBed({
    name: 'Siddharth Rao',
    email: 'siddharth@hostel.edu',
    year: 2,
    gender: 'MALE',
    branch: 'CE',
    acEligible: false,
    isRestricted: true,
    roomNumber: 'A-104',
    bedIndex: 0,
  });

  // Girls Hostel Hero 3-Cycle
  const ananya = await createStudentWithBed({
    name: 'Ananya Iyer',
    email: 'ananya@hostel.edu',
    year: 3,
    gender: 'FEMALE',
    branch: 'CSE',
    acEligible: true,
    roomNumber: 'GA-101',
    bedIndex: 0,
  });

  const diya = await createStudentWithBed({
    name: 'Diya Patel',
    email: 'diya@hostel.edu',
    year: 3,
    gender: 'FEMALE',
    branch: 'ECE',
    acEligible: true,
    roomNumber: 'GA-102',
    bedIndex: 0,
  });

  const meera = await createStudentWithBed({
    name: 'Meera Krishnan',
    email: 'meera@hostel.edu',
    year: 3,
    gender: 'FEMALE',
    branch: 'IT',
    acEligible: true,
    roomNumber: 'GA-103',
    bedIndex: 0,
  });

  // Fill remaining beds across rooms up to ~115 total students (leaving some beds free for occupancy variety)
  const occupiedBedIds = new Set<string>([
    aarav.bed.id,
    rohan.bed.id,
    kabir.bed.id,
    deepak.bed.id,
    tanmay.bed.id,
    vikram.bed.id,
    arjun.bed.id,
    ananya.bed.id,
    diya.bed.id,
    meera.bed.id,
  ]);
  const allOccupied = await prisma.bed.findMany({ where: { studentId: { not: null } } });
  allOccupied.forEach((b) => occupiedBedIds.add(b.id));

  let maleIdx = 0;
  let femaleIdx = 0;
  let totalCreatedStudents = allOccupied.length;

  for (const room of createdRooms) {
    // Leave ~15% beds vacant across campus so available rooms exist
    for (let bIdx = 0; bIdx < room.beds.length; bIdx++) {
      const bed = room.beds[bIdx];
      if (occupiedBedIds.has(bed.id)) continue;
      if (totalCreatedStudents >= 115) break;
      // Leave last bed empty in every 5th room
      if (bIdx === room.beds.length - 1 && totalCreatedStudents % 5 === 0) continue;

      const isFemale = room.gender === 'FEMALE';
      const firstName = isFemale
        ? FIRST_NAMES_FEMALE[femaleIdx % FIRST_NAMES_FEMALE.length]
        : FIRST_NAMES_MALE[maleIdx % FIRST_NAMES_MALE.length];
      const lastName = LAST_NAMES[(maleIdx + femaleIdx) % LAST_NAMES.length];
      if (isFemale) femaleIdx++;
      else maleIdx++;

      const seq = totalCreatedStudents + 1;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${seq}@hostel.edu`;

      const user = await prisma.user.create({
        data: {
          name: `${firstName} ${lastName}`,
          email,
          passwordHash: studentHash,
          role: 'STUDENT',
        },
      });

      const student = await prisma.student.create({
        data: {
          userId: user.id,
          rollNumber: `CS${rollSeq++}`,
          year: ((seq - 1) % 4) + 1,
          gender: room.gender,
          branch: BRANCHES[seq % BRANCHES.length],
          acEligible: room.type === 'AC' || seq % 3 === 0,
        },
      });

      await prisma.bed.update({
        where: { id: bed.id },
        data: { studentId: student.id, occupiedAt: new Date() },
      });

      occupiedBedIds.add(bed.id);
      totalCreatedStudents++;
    }
  }

  console.log(`✅ Created ${totalCreatedStudents} students across ${createdRooms.length} rooms.`);

  console.log('🔄 Seeding realistic swap cycles, requests, approvals, and audit logs...');
  const futureExpiry = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
  const acceptanceDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

  // 1. Hero 3-Way Cycle (CYC-101) - AWAITING_ACCEPTANCE (Aarav accepted, Rohan & Kabir pending)
  const reqA = await prisma.exchangeRequest.create({
    data: {
      requestCode: 'EX-1001',
      studentId: aarav.student.id,
      currentRoomId: aarav.room.id,
      currentBedId: aarav.bed.id,
      desiredRoomId: rohan.room.id,
      desiredRoomType: 'AC',
      reason: 'Want to stay closer to project teammates in Room A-205.',
      expiresAt: futureExpiry,
      status: 'IN_CYCLE',
    },
  });
  const reqB = await prisma.exchangeRequest.create({
    data: {
      requestCode: 'EX-1002',
      studentId: rohan.student.id,
      currentRoomId: rohan.room.id,
      currentBedId: rohan.bed.id,
      desiredRoomId: kabir.room.id,
      desiredRoomType: 'AC',
      reason: 'Prefer higher floor quieter wing in Room A-310 for GATE prep.',
      expiresAt: futureExpiry,
      status: 'IN_CYCLE',
    },
  });
  const reqC = await prisma.exchangeRequest.create({
    data: {
      requestCode: 'EX-1003',
      studentId: kabir.student.id,
      currentRoomId: kabir.room.id,
      currentBedId: kabir.bed.id,
      desiredRoomId: aarav.room.id,
      desiredRoomType: 'AC',
      reason: 'Looking for ground/first floor room A-101 due to ankle recovery.',
      expiresAt: futureExpiry,
      status: 'IN_CYCLE',
    },
  });

  const heroCycle = await prisma.swapGroup.create({
    data: {
      cycleCode: 'CYC-101',
      type: 'CHAIN',
      length: 3,
      status: 'AWAITING_ACCEPTANCE',
      acceptanceDeadline,
    },
  });

  await prisma.exchangeRequest.updateMany({
    where: { id: { in: [reqA.id, reqB.id, reqC.id] } },
    data: { lockedCycleId: heroCycle.id },
  });

  await prisma.swapParticipant.createMany({
    data: [
      {
        swapGroupId: heroCycle.id,
        exchangeRequestId: reqA.id,
        studentId: aarav.student.id,
        fromRoomId: aarav.room.id,
        fromBedId: aarav.bed.id,
        toRoomId: rohan.room.id,
        toBedId: rohan.bed.id,
        stepOrder: 0,
        decision: 'ACCEPTED',
        respondedAt: new Date(),
      },
      {
        swapGroupId: heroCycle.id,
        exchangeRequestId: reqB.id,
        studentId: rohan.student.id,
        fromRoomId: rohan.room.id,
        fromBedId: rohan.bed.id,
        toRoomId: kabir.room.id,
        toBedId: kabir.bed.id,
        stepOrder: 1,
        decision: 'PENDING',
      },
      {
        swapGroupId: heroCycle.id,
        exchangeRequestId: reqC.id,
        studentId: kabir.student.id,
        fromRoomId: kabir.room.id,
        fromBedId: kabir.bed.id,
        toRoomId: aarav.room.id,
        toBedId: aarav.bed.id,
        stepOrder: 2,
        decision: 'PENDING',
      },
    ],
  });

  // 2. Direct 2-Way Swap (CYC-102) - AWAITING_WARDEN (Ready in Warden Queue!)
  const reqV = await prisma.exchangeRequest.create({
    data: {
      requestCode: 'EX-1004',
      studentId: vikram.student.id,
      currentRoomId: vikram.room.id,
      currentBedId: vikram.bed.id,
      desiredRoomId: arjun.room.id,
      desiredRoomType: 'AC',
      reason: 'Swapping to second floor with lab partner.',
      expiresAt: futureExpiry,
      status: 'AWAITING_WARDEN',
    },
  });
  const reqAr = await prisma.exchangeRequest.create({
    data: {
      requestCode: 'EX-1005',
      studentId: arjun.student.id,
      currentRoomId: arjun.room.id,
      currentBedId: arjun.bed.id,
      desiredRoomId: vikram.room.id,
      desiredRoomType: 'AC',
      reason: 'Prefer first floor room B-101.',
      expiresAt: futureExpiry,
      status: 'AWAITING_WARDEN',
    },
  });

  const directCycle = await prisma.swapGroup.create({
    data: {
      cycleCode: 'CYC-102',
      type: 'DIRECT',
      length: 2,
      status: 'AWAITING_WARDEN',
      acceptanceDeadline,
    },
  });

  await prisma.exchangeRequest.updateMany({
    where: { id: { in: [reqV.id, reqAr.id] } },
    data: { lockedCycleId: directCycle.id },
  });

  await prisma.swapParticipant.createMany({
    data: [
      {
        swapGroupId: directCycle.id,
        exchangeRequestId: reqV.id,
        studentId: vikram.student.id,
        fromRoomId: vikram.room.id,
        fromBedId: vikram.bed.id,
        toRoomId: arjun.room.id,
        toBedId: arjun.bed.id,
        stepOrder: 0,
        decision: 'ACCEPTED',
        respondedAt: new Date(),
      },
      {
        swapGroupId: directCycle.id,
        exchangeRequestId: reqAr.id,
        studentId: arjun.student.id,
        fromRoomId: arjun.room.id,
        fromBedId: arjun.bed.id,
        toRoomId: vikram.room.id,
        toBedId: vikram.bed.id,
        stepOrder: 1,
        decision: 'ACCEPTED',
        respondedAt: new Date(),
      },
    ],
  });

  // 3. Girls Hostel 3-Way Cycle (CYC-103) - AWAITING_ACCEPTANCE
  const reqAn = await prisma.exchangeRequest.create({
    data: {
      requestCode: 'EX-1006',
      studentId: ananya.student.id,
      currentRoomId: ananya.room.id,
      currentBedId: ananya.bed.id,
      desiredRoomId: diya.room.id,
      desiredRoomType: 'AC',
      reason: 'Want GA-102 near study hall.',
      expiresAt: futureExpiry,
      status: 'IN_CYCLE',
    },
  });
  const reqDi = await prisma.exchangeRequest.create({
    data: {
      requestCode: 'EX-1007',
      studentId: diya.student.id,
      currentRoomId: diya.room.id,
      currentBedId: diya.bed.id,
      desiredRoomId: meera.room.id,
      desiredRoomType: 'AC',
      reason: 'Want corner room GA-103.',
      expiresAt: futureExpiry,
      status: 'IN_CYCLE',
    },
  });
  const reqMe = await prisma.exchangeRequest.create({
    data: {
      requestCode: 'EX-1008',
      studentId: meera.student.id,
      currentRoomId: meera.room.id,
      currentBedId: meera.bed.id,
      desiredRoomId: ananya.room.id,
      desiredRoomType: 'AC',
      reason: 'Want GA-101 closer to entrance.',
      expiresAt: futureExpiry,
      status: 'IN_CYCLE',
    },
  });

  const girlsCycle = await prisma.swapGroup.create({
    data: {
      cycleCode: 'CYC-103',
      type: 'CHAIN',
      length: 3,
      status: 'AWAITING_ACCEPTANCE',
      acceptanceDeadline,
    },
  });

  await prisma.exchangeRequest.updateMany({
    where: { id: { in: [reqAn.id, reqDi.id, reqMe.id] } },
    data: { lockedCycleId: girlsCycle.id },
  });

  await prisma.swapParticipant.createMany({
    data: [
      {
        swapGroupId: girlsCycle.id,
        exchangeRequestId: reqAn.id,
        studentId: ananya.student.id,
        fromRoomId: ananya.room.id,
        fromBedId: ananya.bed.id,
        toRoomId: diya.room.id,
        toBedId: diya.bed.id,
        stepOrder: 0,
        decision: 'PENDING',
      },
      {
        swapGroupId: girlsCycle.id,
        exchangeRequestId: reqDi.id,
        studentId: diya.student.id,
        fromRoomId: diya.room.id,
        fromBedId: diya.bed.id,
        toRoomId: meera.room.id,
        toBedId: meera.bed.id,
        stepOrder: 1,
        decision: 'PENDING',
      },
      {
        swapGroupId: girlsCycle.id,
        exchangeRequestId: reqMe.id,
        studentId: meera.student.id,
        fromRoomId: meera.room.id,
        fromBedId: meera.bed.id,
        toRoomId: ananya.room.id,
        toBedId: ananya.bed.id,
        stepOrder: 2,
        decision: 'PENDING',
      },
    ],
  });

  // 4. Standalone Pending Request (Tanmay looking for any 2-Bed Non-AC room)
  await prisma.exchangeRequest.create({
    data: {
      requestCode: 'EX-1009',
      studentId: tanmay.student.id,
      currentRoomId: tanmay.room.id,
      currentBedId: tanmay.bed.id,
      desiredRoomType: 'NON_AC',
      desiredBedCount: 2,
      reason: 'Prefer a 2-bed Non-AC room for quieter study environment.',
      expiresAt: futureExpiry,
      status: 'PENDING',
    },
  });

  // Audit Logs & Notifications
  await prisma.auditLog.createMany({
    data: [
      {
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorRole: 'ADMIN',
        action: 'SYSTEM_SEEDED',
        entityType: 'POLICY',
        entityId: 'GLOBAL',
        newValue: { hostels: 2, rooms: createdRooms.length, students: totalCreatedStudents },
        remarks: 'Initial semester hostel allocation and swap policy initialized.',
      },
      {
        actorId: null,
        actorEmail: 'system@hostelswap.edu',
        actorRole: 'SYSTEM',
        action: 'SWAP_CYCLE_DETECTED',
        entityType: 'SWAP_GROUP',
        entityId: 'CYC-101',
        newValue: { chain: ['A-101 -> A-205', 'A-205 -> A-310', 'A-310 -> A-101'] },
        remarks: '3-way circular swap detected via bounded DFS.',
      },
      {
        actorId: null,
        actorEmail: 'system@hostelswap.edu',
        actorRole: 'SYSTEM',
        action: 'SWAP_CYCLE_DETECTED',
        entityType: 'SWAP_GROUP',
        entityId: 'CYC-102',
        newValue: { chain: ['B-101 -> B-202', 'B-202 -> B-101'] },
        remarks: 'Direct 2-way swap ready for Warden approval.',
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: rohan.user.id,
        title: '3-Way Swap Cycle Found (CYC-101)',
        message: 'Aarav -> Rohan -> Kabir -> Aarav detected! Please review and accept within 48 hours.',
        type: 'ACCEPT_REQUIRED',
        relatedEntityId: heroCycle.id,
        emailStubRecipient: rohan.user.email,
      },
      {
        userId: kabir.user.id,
        title: '3-Way Swap Cycle Found (CYC-101)',
        message: 'Aarav -> Rohan -> Kabir -> Aarav detected! Please review and accept within 48 hours.',
        type: 'ACCEPT_REQUIRED',
        relatedEntityId: heroCycle.id,
        emailStubRecipient: kabir.user.email,
      },
      {
        userId: wardenUser.id,
        title: 'Warden Approval Needed: CYC-102',
        message: 'Vikram Malhotra and Arjun Nair have both accepted direct swap CYC-102. Ready for approval.',
        type: 'ACCEPT_REQUIRED',
        relatedEntityId: directCycle.id,
        emailStubRecipient: wardenUser.email,
      },
    ],
  });

  console.log('🎉 Seed completed successfully!');
  console.log('--- Demo Credentials ---');
  console.log('Admin:   admin@hostel.edu   / Admin@123');
  console.log('Warden:  warden@hostel.edu  / Warden@123');
  console.log('Student: aarav@hostel.edu   / Student@123 (In CYC-101, Accepted)');
  console.log('Student: rohan@hostel.edu   / Student@123 (In CYC-101, Pending Acceptance)');
  console.log('Student: kabir@hostel.edu   / Student@123 (In CYC-101, Pending Acceptance)');
  console.log('Student: deepak@hostel.edu  / Student@123 (Non-AC, NOT AC-eligible)');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

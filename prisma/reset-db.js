const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
require('dotenv').config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    if (process.env.ALLOW_DB_RESET !== 'true') {
        throw new Error('Refusing to reset database unless ALLOW_DB_RESET=true is set.')
    }

    const seedUserPassword = process.env.RESET_SEED_USER_PASSWORD
    const seedAdminPassword = process.env.RESET_SEED_ADMIN_PASSWORD

    if (
        !seedUserPassword ||
        !seedAdminPassword ||
        seedUserPassword.length < 12 ||
        seedAdminPassword.length < 12
    ) {
        throw new Error('Set RESET_SEED_USER_PASSWORD and RESET_SEED_ADMIN_PASSWORD to strong values before seeding.')
    }

    console.log('Starting database reset...')

    console.log('Cleaning GymLog...')
    await prisma.gymLog.deleteMany({})

    console.log('Cleaning Invite...')
    await prisma.invite.deleteMany({})

    console.log('Cleaning GuideApplication...')
    await prisma.guideApplication.deleteMany({})

    console.log('Cleaning Match...')
    await prisma.match.deleteMany({})

    console.log('Cleaning BookingEquipment...')
    await prisma.bookingEquipment.deleteMany({})

    console.log('Cleaning Booking...')
    await prisma.booking.deleteMany({})

    console.log('Cleaning User...')
    await prisma.user.deleteMany({})

    console.log('Cleaning Sport...')
    await prisma.sport.deleteMany({})

    console.log('Database cleared.')

    const sports = [
        {
            name: 'Badminton',
            numberOfCourts: 3,
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Court 1:0', 'Court 2:0', 'Court 3:0'],
            Equipment: {
                create: [
                    { name: 'Racket', total: 20 },
                    { name: 'Shuttle', total: 50 },
                ],
            },
        },
        {
            name: 'Squash',
            numberOfCourts: 2,
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Court 1:0', 'Court 2:0'],
            Equipment: {
                create: [
                    { name: 'Racket', total: 10 },
                    { name: 'Ball', total: 20 },
                ],
            },
        },
        {
            name: 'Table Tennis',
            numberOfCourts: 4,
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Table 1:0', 'Table 2:0', 'Table 3:0', 'Table 4:0'],
            Equipment: {
                create: [
                    { name: 'Racket', total: 20 },
                    { name: 'Ball', total: 50 },
                ],
            },
        },
        {
            name: 'Tennis',
            numberOfCourts: 2,
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Court 1:0', 'Court 2:0'],
            Equipment: {
                create: [
                    { name: 'Racket', total: 15 },
                    { name: 'Ball', total: 40 },
                ],
            },
        },
        {
            name: 'Swimming',
            numberOfCourts: 1,
            maxCapacity: 20,
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['RPool:0'],
        },
        {
            name: 'Gym',
            numberOfCourts: 1,
            maxCapacity: 50,
            courtsInUse: 0,
            numPlayers: 0,
            courtData: ['Main Gym:0'],
        },
    ]

    const users = [
        {
            name: 'Guard',
            email: 'guard@iiitd.ac.in',
            password: seedAdminPassword,
            phone: '9810593073',
            rollNumber: '2024214',
            role: 'guard'
        },
        {
            name: 'Facility Manager',
            email: 'facility.manager@iiitd.ac.in',
            password: seedAdminPassword,
            phone: '9810593074',
            rollNumber: '2024215',
            role: 'facility_manager'
        },
        {
            name: 'Kunal Budhiraja',
            email: 'kunal24313@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9810593078',
            rollNumber: '2024313',
        },
        {
            name: 'Alphx',
            email: 'alphx@iiitd.ac.in',
            password: seedUserPassword,
            phone: '8700740987',
            rollNumber: '2024333',
        },
        {
            name: 'Admin',
            email: 'admin@iiitd.ac.in',
            password: seedAdminPassword,
            phone: '9810593072',
            rollNumber: '2024213',
            role: 'Admin',
        },
        {
            name: 'Aarav Sharma',
            email: 'aarav.sharma@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9811111111',
            rollNumber: '2024301',
        },
        {
            name: 'Priya Gupta',
            email: 'priya.gupta@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9811111112',
            rollNumber: '2024302',
        },
        {
            name: 'Rohan Verma',
            email: 'rohan.verma@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9811111113',
            rollNumber: '2024303',
        },
        {
            name: 'Sneha Kapoor',
            email: 'sneha.kapoor@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9811111114',
            rollNumber: '2024304',
        },
        {
            name: 'Aditya Singh',
            email: 'aditya.singh@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9811111115',
            rollNumber: '2024305',
        },
        {
            name: 'Meera Joshi',
            email: 'meera.joshi@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9811111116',
            rollNumber: '2024306',
        },
        {
            name: 'Arjun Malhotra',
            email: 'arjun.malhotra@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9811111117',
            rollNumber: '2024307',
        },
        {
            name: 'Ananya Rao',
            email: 'ananya.rao@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9811111118',
            rollNumber: '2024308',
        },
        {
            name: 'Dev Khanna',
            email: 'dev.khanna@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9811111119',
            rollNumber: '2024309',
        },
        {
            name: 'Ishita Mehta',
            email: 'ishita.mehta@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9811111120',
            rollNumber: '2024310',
        },
        {
            name: 'Faculty Admin',
            email: 'faculty.admin@iiitd.ac.in',
            password: seedAdminPassword,
            phone: '9811111121',
            rollNumber: '2024201',
            role: 'Admin',
        },
        {
            name: 'Library Admin',
            email: 'library.admin@iiitd.ac.in',
            password: seedAdminPassword,
            phone: '9811111122',
            rollNumber: '2024202',
            role: 'Admin',
        },
        {
            name: 'Nikhil Bansal',
            email: 'nikhil.bansal@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9811111123',
            rollNumber: '2024311',
        },
        {
            name: 'Tanya Arora',
            email: 'tanya.arora@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9811111124',
            rollNumber: '2024312',
        },
        {
            name: 'Yash Jain',
            email: 'yash.jain@iiitd.ac.in',
            password: seedUserPassword,
            phone: '9811111125',
            rollNumber: '2024314',
        },
    ]

    const regularUserEmails = users
        .filter((user) => user.role !== 'Admin')
        .map((user) => user.email)

    const sportBookingTemplates = [
        {
            sportName: 'Badminton',
            courtNos: ['1', '2', '3'],
            playerCounts: [2, 4],
            equipments: [
                { name: 'Racket', count: 2 },
                { name: 'Shuttle', count: 1 },
            ],
        },
        {
            sportName: 'Squash',
            courtNos: ['1', '2'],
            playerCounts: [2],
            equipments: [
                { name: 'Racket', count: 2 },
                { name: 'Ball', count: 1 },
            ],
        },
        {
            sportName: 'Table Tennis',
            courtNos: ['1', '2', '3', '4'],
            playerCounts: [2, 4],
            equipments: [
                { name: 'Racket', count: 2 },
                { name: 'Ball', count: 2 },
            ],
        },
        {
            sportName: 'Tennis',
            courtNos: ['1', '2'],
            playerCounts: [2, 4],
            equipments: [
                { name: 'Racket', count: 2 },
                { name: 'Ball', count: 2 },
            ],
        },
        {
            sportName: 'Swimming',
            courtNos: ['RPool'],
            playerCounts: [1, 2, 3],
            equipments: [],
        },
        {
            sportName: 'Gym',
            courtNos: ['Main Gym'],
            playerCounts: [1],
            equipments: [],
        },
    ]

    function makePastCompletedBookings() {
        const bookings = []

        // These dates are inside the RTO analytics last-7-days window
        // and are still in the past relative to 2026-06-09.
        const pastDates = [
            '2026-06-03',
            '2026-06-04',
            '2026-06-05',
            '2026-06-06',
            '2026-06-07',
            '2026-06-08',
        ]

        const timeSlots = [
            ['06:00:00', '07:00:00'],
            ['07:30:00', '08:30:00'],
            ['09:00:00', '10:00:00'],
            ['10:30:00', '11:30:00'],
            ['12:00:00', '13:00:00'],
            ['14:00:00', '15:00:00'],
            ['16:00:00', '17:00:00'],
            ['18:00:00', '19:00:00'],
            ['20:00:00', '21:00:00'],
        ]

        let bookingIndex = 0

        for (const template of sportBookingTemplates) {
            // 9 bookings per sport * 6 sports = 54 completed bookings.
            for (let i = 0; i < 9; i++) {
                const bookingDate = pastDates[bookingIndex % pastDates.length]
                const [startTime, endTime] = timeSlots[i % timeSlots.length]
                const numberOfPlayers = template.playerCounts[i % template.playerCounts.length]
                const courtNo = template.courtNos[i % template.courtNos.length]

                bookings.push({
                    userEmail: regularUserEmails[bookingIndex % regularUserEmails.length],
                    sportName: template.sportName,
                    numberOfPlayers,
                    startTime,
                    endTime,
                    date: bookingDate,
                    endDate: bookingDate,
                    status: 'completed',
                    courtNo,
                    scanned: true,
                    equipments: template.equipments.map((equipment) => ({
                        name: equipment.name,
                        count: Math.min(equipment.count, numberOfPlayers),
                    })),
                })

                bookingIndex++
            }
        }

        return bookings
    }

    const seedBookings = makePastCompletedBookings()

    for (const sport of sports) {
        await prisma.sport.create({
            data: sport,
        })

        console.log(`Created sport: ${sport.name}`)
    }

    for (const user of users) {
        const password = await bcrypt.hash(user.password, 10)

        await prisma.user.create({
            data: {
                ...user,
                password,
            },
        })

        console.log(`Created user: ${user.name}`)
    }

    for (const booking of seedBookings) {
        const user = await prisma.user.findUnique({
            where: {
                email: booking.userEmail,
            },
        })

        if (!user) {
            throw new Error(`Seed booking user not found: ${booking.userEmail}`)
        }

        const bookingEquipments = []

        for (const equipment of booking.equipments) {
            const equipmentRecord = await prisma.equipment.findFirst({
                where: {
                    name: equipment.name,
                    sport: {
                        is: {
                            name: booking.sportName,
                        },
                    },
                },
            })

            if (!equipmentRecord) {
                throw new Error(`Seed equipment not found: ${booking.sportName} - ${equipment.name}`)
            }

            bookingEquipments.push({
                equipmentId: equipmentRecord.id,
                count: equipment.count,
            })
        }

        const createdBooking = await prisma.booking.create({
            data: {
                userId: user.id,
                sportName: booking.sportName,
                numberOfPlayers: booking.numberOfPlayers,
                startTime: booking.startTime,
                endTime: booking.endTime,
                date: booking.date,
                qrDetail: null,
                status: booking.status,
                endDate: booking.endDate,
                courtNo: booking.courtNo,
                scanned: booking.scanned,
                equipments: {
                    create: bookingEquipments,
                },
            },
        })

        await prisma.booking.update({
            where: {
                id: createdBooking.id,
            },
            data: {
                qrDetail: JSON.stringify({
                    name: user.name,
                    email: user.email,
                    rollNumber: user.rollNumber,
                    sportName: booking.sportName,
                    playerCount: booking.numberOfPlayers,
                    startTime: booking.startTime,
                    endTime: booking.endTime,
                    date: booking.date,
                    endDate: booking.endDate,
                    courtNo: booking.courtNo,
                    status: booking.status,
                    scanned: booking.scanned,
                    equipmentCounts: booking.equipments.reduce((acc, equipment) => {
                        acc[equipment.name] = equipment.count
                        return acc
                    }, {}),
                    bookingId: createdBooking.id,
                }),
            },
        })

        console.log(
            `Created completed booking: ${user.email} - ${booking.sportName} ${booking.date} ${booking.startTime}`
        )
    }

    console.log(`Seeded ${seedBookings.length} completed past bookings across all sports.`)
    console.log('Database reset complete!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

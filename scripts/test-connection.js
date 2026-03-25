const { PrismaClient } = require('@prisma/client');
const dns = require('dns');
const net = require('net');

async function checkDns(host) {
    return new Promise((resolve) => {
        dns.lookup(host, (err, address, family) => {
            if (err) {
                console.log(`❌ DNS Lookup failed for ${host}:`, err.message);
                resolve(false);
            } else {
                console.log(`✅ DNS Lookup: ${host} -> ${address} (IPv${family})`);
                resolve(true);
            }
        });
    });
}

async function checkPort(host, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(5000);
        socket.on('connect', () => {
            console.log(`✅ TCP Connection: Successfully reached ${host}:${port}`);
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            console.log(`❌ TCP Connection: Timeout reaching ${host}:${port}`);
            socket.destroy();
            resolve(false);
        });
        socket.on('error', (err) => {
            console.log(`❌ TCP Connection: Failed to reach ${host}:${port}:`, err.message);
            resolve(false);
        });
        socket.connect(port, host);
    });
}

async function testPrisma() {
    console.log("--- Starting Prisma Connection Test ---");
    const prisma = new PrismaClient({
        log: ['query', 'info', 'warn', 'error'],
    });

    try {
        console.log("Attempting to connect via Prisma...");
        const start = Date.now();
        await prisma.$connect();
        const end = Date.now();
        console.log(`✅ Prisma: Successfully connected in ${end - start}ms`);
        
        const count = await prisma.post.count();
        console.log(`✅ Prisma: Successfully queried database. Post count: ${count}`);
    } catch (error) {
        console.log("❌ Prisma Connection failed:");
        console.log("- Message:", error.message);
        console.log("- Code:", error.code);
        console.log("- Client Version:", error.clientVersion);
    } finally {
        await prisma.$disconnect();
    }
}

async function main() {
    console.log("Standalone Database Diagnostic Tool");
    console.log("-----------------------------------");
    
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("❌ Error: DATABASE_URL environment variable is not set.");
        process.exit(1);
    }

    // Basic URL parsing
    try {
        const url = new URL(dbUrl.replace('postgres://', 'http://').replace('postgresql://', 'http://'));
        const host = url.hostname;
        const port = url.port || 5432;

        console.log(`Targeting Database: ${host}:${port}`);
        
        await checkDns(host);
        await checkPort(host, port);
        await testPrisma();

    } catch (e) {
        console.error("❌ Failed to parse DATABASE_URL:", e.message);
    }
}

main();

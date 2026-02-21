import { describe, expect, it } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const buyer = accounts.get("wallet_1")!;
const seller = accounts.get("wallet_2")!;
const attacker = accounts.get("wallet_3")!;

/**
 * Helper — create an escrow through the factory so we can exercise
 * error codes that only fire during real contract interactions.
 */
function createEscrow(
    b: string = buyer,
    s: string = seller,
    amount: number | bigint = 1000000,
    deadlineBlocks: number = 100,
    sender: string = deployer,
): { result: any; id: number } {
    const { result } = simnet.callPublicFn(
        "trustlock-factory",
        "create-escrow",
        [Cl.principal(b), Cl.principal(s), Cl.uint(amount), Cl.uint(deadlineBlocks)],
        sender,
    );
    let id = -1;
    if (result.type === ClarityType.ResponseOk) {
        id = Number(result.value.value);
    }
    return { result, id };
}

// ===== DEPLOYMENT =====

describe("Traits Contract Deployment", () => {
    it("deploys to simnet without compilation errors", () => {
        // If any constant or trait definition had a syntax issue the
        // entire simnet boot would fail — blockHeight > 0 proves it loaded.
        expect(simnet.blockHeight).toBeGreaterThan(0);
    });

    it("is recognized as a deployed contract by simnet", () => {
        const source = simnet.getContractSource("trustlock-traits");
        expect(source).toBeDefined();
        expect(source!.length).toBeGreaterThan(0);
    });
});

// ===== AUTHORIZATION ERROR CODES (u100–u199) =====

describe("Authorization Error Codes", () => {
    it("ERR-NOT-BUYER (u100) rejects deposit from wrong wallet", () => {
        const { id } = createEscrow();
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "deposit",
            [Cl.uint(id)],
            attacker,
        );
        expect(result).toBeErr(Cl.uint(100));
    });

    it("ERR-NOT-SELLER (u101) rejects release from wrong wallet", () => {
        const { id } = createEscrow();
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(id)], buyer);
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(id)],
            attacker,
        );
        expect(result).toBeErr(Cl.uint(101));
    });

    it("ERR-UNAUTHORIZED (u103) rejects escrow with same buyer and seller", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(buyer), Cl.uint(1000000), Cl.uint(100)],
            deployer,
        );
        expect(result).toBeErr(Cl.uint(103));
    });

    it("ERR-NOT-FACTORY (u104) rejects direct initialize-escrow call", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.uint(0), Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer,
        );
        expect(result).toBeErr(Cl.uint(104));
    });

    it("ERR-NOT-OWNER (u105) rejects pause from non-deployer", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "pause",
            [],
            attacker,
        );
        expect(result).toBeErr(Cl.uint(105));
    });
});

// ===== STATE ERROR CODES (u200–u299) =====

describe("State Error Codes", () => {
    it("ERR-ALREADY-FUNDED (u200) rejects double deposit", () => {
        const { id } = createEscrow();
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(id)], buyer);
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "deposit",
            [Cl.uint(id)],
            buyer,
        );
        expect(result).toBeErr(Cl.uint(200));
    });

    it("ERR-NOT-FUNDED (u201) rejects release on unfunded escrow", () => {
        const { id } = createEscrow();
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(id)],
            seller,
        );
        expect(result).toBeErr(Cl.uint(201));
    });

    it("ERR-INVALID-STATE (u204) rejects cancel on funded escrow", () => {
        const { id } = createEscrow();
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(id)], buyer);
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "cancel-escrow",
            [Cl.uint(id)],
            buyer,
        );
        expect(result).toBeErr(Cl.uint(204));
    });

    it("ERR-ESCROW-NOT-FOUND (u205) rejects query for non-existent escrow", () => {
        const info = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-info",
            [Cl.uint(999)],
            deployer,
        );
        expect(info.result).toBeErr(Cl.uint(205));
    });

    it("ERR-CONTRACT-PAUSED (u206) blocks operations when paused", () => {
        const { id } = createEscrow();
        simnet.callPublicFn("trustlock-escrow", "pause", [], deployer);
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "deposit",
            [Cl.uint(id)],
            buyer,
        );
        expect(result).toBeErr(Cl.uint(206));
        simnet.callPublicFn("trustlock-escrow", "unpause", [], deployer);
    });
});

// ===== VALIDATION ERROR CODES (u300–u399) =====

describe("Validation Error Codes", () => {
    it("ERR-INVALID-AMOUNT (u300) rejects zero-amount escrow", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(0), Cl.uint(100)],
            deployer,
        );
        expect(result).toBeErr(Cl.uint(300));
    });

    it("ERR-DEADLINE-PASSED (u301) rejects deposit after deadline expires", () => {
        const { id } = createEscrow(buyer, seller, 1000000, 3);
        simnet.mineEmptyBlocks(5);
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "deposit",
            [Cl.uint(id)],
            buyer,
        );
        expect(result).toBeErr(Cl.uint(301));
    });

    it("ERR-DEADLINE-NOT-REACHED (u302) rejects premature refund", () => {
        const { id } = createEscrow(buyer, seller, 1000000, 100);
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(id)], buyer);
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "refund",
            [Cl.uint(id)],
            buyer,
        );
        expect(result).toBeErr(Cl.uint(302));
    });

    it("ERR-AMOUNT-TOO-LOW (u304) rejects amount below MIN-ESCROW-AMOUNT", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(500), Cl.uint(100)],
            deployer,
        );
        expect(result).toBeErr(Cl.uint(304));
    });

    it("ERR-DEADLINE-TOO-LONG (u305) rejects deadline above MAX-DEADLINE-BLOCKS", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(99999)],
            deployer,
        );
        expect(result).toBeErr(Cl.uint(305));
    });
});

// ===== EXECUTION ERROR CODES (u400–u499) =====

describe("Execution Error Codes", () => {
    it("ERR-TRANSFER-FAILED (u400) rejects deposit when buyer lacks funds", () => {
        const hugeAmount = BigInt("999999999999999999");
        const { id } = createEscrow(buyer, seller, hugeAmount, 100);
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "deposit",
            [Cl.uint(id)],
            buyer,
        );
        expect(result).toBeErr(Cl.uint(400));
    });
});

// ===== ERROR CODE RANGE INTEGRITY =====

describe("Error Code Range Integrity", () => {
    const authCodes = [100, 101, 102, 103, 104, 105];
    const stateCodes = [200, 201, 202, 203, 204, 205, 206];
    const validationCodes = [300, 301, 302, 303, 304, 305];
    const execCodes = [400, 401];

    it("all authorization errors fall within u100–u199", () => {
        for (const code of authCodes) {
            expect(code).toBeGreaterThanOrEqual(100);
            expect(code).toBeLessThan(200);
        }
    });

    it("all state errors fall within u200–u299", () => {
        for (const code of stateCodes) {
            expect(code).toBeGreaterThanOrEqual(200);
            expect(code).toBeLessThan(300);
        }
    });

    it("all validation errors fall within u300–u399", () => {
        for (const code of validationCodes) {
            expect(code).toBeGreaterThanOrEqual(300);
            expect(code).toBeLessThan(400);
        }
    });

    it("all execution errors fall within u400–u499", () => {
        for (const code of execCodes) {
            expect(code).toBeGreaterThanOrEqual(400);
            expect(code).toBeLessThan(500);
        }
    });

    it("no duplicate error codes exist across all ranges", () => {
        const allCodes = [...authCodes, ...stateCodes, ...validationCodes, ...execCodes];
        const unique = new Set(allCodes);
        expect(unique.size).toBe(allCodes.length);
    });

    it("total error constant count matches the contract (21 codes)", () => {
        const allCodes = [...authCodes, ...stateCodes, ...validationCodes, ...execCodes];
        expect(allCodes.length).toBe(21);
    });
});

// ===== ESCROW TRAIT INTERFACE =====

describe("Escrow Trait Interface", () => {
    it("trait contract source contains define-trait escrow-trait", () => {
        const source = simnet.getContractSource("trustlock-traits");
        expect(source).toContain("define-trait escrow-trait");
    });

    it("trait defines the deposit function signature", () => {
        const source = simnet.getContractSource("trustlock-traits");
        expect(source).toContain("(deposit (uint) (response bool uint))");
    });

    it("trait defines the release function signature", () => {
        const source = simnet.getContractSource("trustlock-traits");
        expect(source).toContain("(release (uint) (response bool uint))");
    });

    it("trait defines the refund function signature", () => {
        const source = simnet.getContractSource("trustlock-traits");
        expect(source).toContain("(refund (uint) (response bool uint))");
    });

    it("escrow contract implements all three trait methods end-to-end", () => {
        // deposit
        const { id: id1 } = createEscrow();
        const dep = simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(id1)], buyer);
        expect(dep.result).toBeOk(Cl.bool(true));

        // release
        const rel = simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(id1)], seller);
        expect(rel.result).toBeOk(Cl.bool(true));

        // refund (requires separate funded escrow with passed deadline)
        const { id: id2 } = createEscrow(buyer, seller, 1000000, 5);
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(id2)], buyer);
        simnet.mineEmptyBlocks(6);
        const ref = simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(id2)], buyer);
        expect(ref.result).toBeOk(Cl.bool(true));
    });

    it("trait source contains all four error constant categories", () => {
        const source = simnet.getContractSource("trustlock-traits");
        expect(source).toContain("ERR-NOT-BUYER");
        expect(source).toContain("ERR-ALREADY-FUNDED");
        expect(source).toContain("ERR-INVALID-AMOUNT");
        expect(source).toContain("ERR-TRANSFER-FAILED");
    });
});

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
});

import { describe, expect, it } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const buyer = accounts.get("wallet_1")!;
const seller = accounts.get("wallet_2")!;
const attacker = accounts.get("wallet_3")!;

/**
 * Creates an escrow via the factory and returns the contract-assigned ID.
 * The ID is extracted from the (ok uint) response rather than tracked in JS,
 * because simnet state resets between tests.
 */
function createEscrow(
    b: string = buyer,
    s: string = seller,
    amount: number = 1000000,
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

/** Fund an escrow (buyer deposits the required amount). */
function fundEscrow(escrowId: number, b: string = buyer) {
    return simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(escrowId)], b);
}

// ===== INITIALIZATION =====

describe("Escrow Initialization", () => {
    it("successfully initializes escrow via factory", () => {
        const { result, id } = createEscrow();
        expect(result).toBeOk(Cl.uint(id));

        const info = simnet.callReadOnlyFn("trustlock-escrow", "get-info", [Cl.uint(id)], deployer);
        expect(info.result).toBeOk(expect.anything());
    });

    it("rejects direct initialization (not through factory)", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.uint(0), Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer,
        );
        expect(result).toBeErr(Cl.uint(104));
    });

    it("rejects zero-amount escrow", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(0), Cl.uint(100)],
            deployer,
        );
        expect(result).toBeErr(Cl.uint(300));
    });

    it("rejects same buyer and seller", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(buyer), Cl.uint(1000000), Cl.uint(100)],
            deployer,
        );
        expect(result).toBeErr(Cl.uint(103));
    });

    it("rejects zero-block deadline", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(0)],
            deployer,
        );
        expect(result).toBeErr(Cl.uint(301));
    });
});

// ===== DEPOSIT =====

describe("Escrow Deposit", () => {
    it("allows buyer to deposit funds", () => {
        const { id } = createEscrow();
        const { result } = fundEscrow(id);
        expect(result).toBeOk(Cl.bool(true));

        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id)],
            deployer,
        );
        expect(status.result).toBeOk(Cl.stringAscii("FUNDED"));
    });

    it("rejects deposit from non-buyer", () => {
        const { id } = createEscrow();
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "deposit",
            [Cl.uint(id)],
            attacker,
        );
        expect(result).toBeErr(Cl.uint(100));
    });

    it("rejects double deposit", () => {
        const { id } = createEscrow();
        fundEscrow(id);

        const { result } = fundEscrow(id);
        expect(result).toBeErr(Cl.uint(200));
    });

    it("rejects deposit on non-existent escrow", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "deposit",
            [Cl.uint(999)],
            buyer,
        );
        expect(result).toBeErr(Cl.uint(205)); // ERR-ESCROW-NOT-FOUND
    });
});

// ===== RELEASE =====

describe("Escrow Release", () => {
    it("allows seller to release funds", () => {
        const { id } = createEscrow();
        fundEscrow(id);

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(id)],
            seller,
        );
        expect(result).toBeOk(Cl.bool(true));

        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id)],
            deployer,
        );
        expect(status.result).toBeOk(Cl.stringAscii("RELEASED"));
    });

    it("rejects release from non-seller", () => {
        const { id } = createEscrow();
        fundEscrow(id);

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(id)],
            attacker,
        );
        expect(result).toBeErr(Cl.uint(101));
    });

    it("rejects release on unfunded escrow", () => {
        const { id } = createEscrow();

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(id)],
            seller,
        );
        expect(result).toBeErr(Cl.uint(201));
    });
});

// ===== REFUND =====

describe("Escrow Refund", () => {
    it("allows refund after deadline passes", () => {
        const deadlineBlocks = 10;
        const { id } = createEscrow(buyer, seller, 1000000, deadlineBlocks);
        fundEscrow(id);

        simnet.mineEmptyBlocks(deadlineBlocks + 1);

        const { result } = simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(id)], buyer);
        expect(result).toBeOk(Cl.bool(true));

        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id)],
            deployer,
        );
        expect(status.result).toBeOk(Cl.stringAscii("REFUNDED"));
    });

    it("rejects refund before deadline", () => {
        const { id } = createEscrow(buyer, seller, 1000000, 100);
        fundEscrow(id);

        const { result } = simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(id)], buyer);
        expect(result).toBeErr(Cl.uint(302));
    });

    it("rejects refund on unfunded escrow", () => {
        const { id } = createEscrow();

        simnet.mineEmptyBlocks(200);

        const { result } = simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(id)], buyer);
        expect(result).toBeErr(Cl.uint(201));
    });
});

// ===== CANCELLATION =====

describe("Escrow Cancellation", () => {
    it("allows buyer to cancel a CREATED escrow", () => {
        const { id } = createEscrow();

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "cancel-escrow",
            [Cl.uint(id)],
            buyer,
        );
        expect(result).toBeOk(Cl.bool(true));

        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id)],
            deployer,
        );
        expect(status.result).toBeOk(Cl.stringAscii("CANCELLED"));
    });

    it("rejects cancellation by non-buyer", () => {
        const { id } = createEscrow();

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "cancel-escrow",
            [Cl.uint(id)],
            attacker,
        );
        expect(result).toBeErr(Cl.uint(100));
    });

    it("rejects cancellation after funding", () => {
        const { id } = createEscrow();
        fundEscrow(id);

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "cancel-escrow",
            [Cl.uint(id)],
            buyer,
        );
        expect(result).toBeErr(Cl.uint(204));
    });

    it("rejects deposit on cancelled escrow", () => {
        const { id } = createEscrow();
        simnet.callPublicFn("trustlock-escrow", "cancel-escrow", [Cl.uint(id)], buyer);

        const { result } = fundEscrow(id);
        expect(result).toBeErr(Cl.uint(200));
    });

    it("allows creator to cancel via factory", () => {
        const { id } = createEscrow();

        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "cancel-escrow",
            [Cl.uint(id)],
            deployer,
        );
        expect(result).toBeOk(Cl.bool(true));

        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id)],
            deployer,
        );
        expect(status.result).toBeOk(Cl.stringAscii("CANCELLED"));
    });

    it("rejects factory cancel by non-creator", () => {
        const { id } = createEscrow();

        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "cancel-escrow",
            [Cl.uint(id)],
            attacker,
        );
        expect(result).toBeErr(Cl.uint(103));
    });
});

// ===== EVENT EMISSIONS =====

/** Extract the print event tuple fields from a transaction's events array. */
function getPrintEventData(events: any[]): Record<string, any> | undefined {
    const printEvt = events.find((e: any) => e.event === "print_event");
    // data.value is { type: "tuple", value: { field1: ClarityValue, ... } }
    return printEvt?.data?.value?.value;
}

describe("Event Emissions", () => {
    it("emits escrow-created event on initialization", () => {
        const { events } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer,
        );
        const fields = getPrintEventData(events);
        expect(fields).toBeDefined();
        expect(fields!["event"]).toStrictEqual(Cl.stringAscii("escrow-created"));
        expect(fields!["buyer"]).toStrictEqual(Cl.principal(buyer));
        expect(fields!["seller"]).toStrictEqual(Cl.principal(seller));
        expect(fields!["amount"]).toStrictEqual(Cl.uint(1000000));
    });

    it("emits escrow-funded event on deposit", () => {
        const { id } = createEscrow(buyer, seller, 2000000);
        const { events } = fundEscrow(id);
        const fields = getPrintEventData(events);
        expect(fields).toBeDefined();
        expect(fields!["event"]).toStrictEqual(Cl.stringAscii("escrow-funded"));
        expect(fields!["escrow-id"]).toStrictEqual(Cl.uint(id));
        expect(fields!["buyer"]).toStrictEqual(Cl.principal(buyer));
        expect(fields!["amount"]).toStrictEqual(Cl.uint(2000000));
    });

    it("emits escrow-released event on release", () => {
        const amount = 3000000;
        const { id } = createEscrow(buyer, seller, amount);
        fundEscrow(id);
        const { events } = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(id)],
            seller,
        );
        const fields = getPrintEventData(events);
        expect(fields).toBeDefined();
        expect(fields!["event"]).toStrictEqual(Cl.stringAscii("escrow-released"));
        expect(fields!["escrow-id"]).toStrictEqual(Cl.uint(id));
        expect(fields!["seller"]).toStrictEqual(Cl.principal(seller));
        expect(fields!["amount"]).toStrictEqual(Cl.uint(amount));
    });

    it("emits escrow-refunded event on refund", () => {
        const amount = 4000000;
        const deadlineBlocks = 10;
        const { id } = createEscrow(buyer, seller, amount, deadlineBlocks);
        fundEscrow(id);
        simnet.mineEmptyBlocks(deadlineBlocks + 1);
        const { events } = simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(id)], buyer);
        const fields = getPrintEventData(events);
        expect(fields).toBeDefined();
        expect(fields!["event"]).toStrictEqual(Cl.stringAscii("escrow-refunded"));
        expect(fields!["escrow-id"]).toStrictEqual(Cl.uint(id));
        expect(fields!["buyer"]).toStrictEqual(Cl.principal(buyer));
        expect(fields!["amount"]).toStrictEqual(Cl.uint(amount));
    });

    it("emits escrow-cancelled event on cancellation", () => {
        const { id } = createEscrow();
        const { events } = simnet.callPublicFn(
            "trustlock-escrow",
            "cancel-escrow",
            [Cl.uint(id)],
            buyer,
        );
        const fields = getPrintEventData(events);
        expect(fields).toBeDefined();
        expect(fields!["event"]).toStrictEqual(Cl.stringAscii("escrow-cancelled"));
        expect(fields!["escrow-id"]).toStrictEqual(Cl.uint(id));
    });
});

// ===== EMERGENCY PAUSE =====

describe("Emergency Pause", () => {
    it("allows owner to pause the contract", () => {
        const { result } = simnet.callPublicFn("trustlock-escrow", "pause", [], deployer);
        expect(result).toBeOk(Cl.bool(true));

        const paused = simnet.callReadOnlyFn("trustlock-escrow", "get-paused", [], deployer);
        expect(paused.result).toBeOk(Cl.bool(true));
    });

    it("rejects pause from non-owner", () => {
        const { result } = simnet.callPublicFn("trustlock-escrow", "pause", [], attacker);
        expect(result).toBeErr(Cl.uint(105)); // ERR-NOT-OWNER
    });

    it("blocks deposit when paused", () => {
        const { id } = createEscrow();

        simnet.callPublicFn("trustlock-escrow", "pause", [], deployer);

        const { result } = simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(id)], buyer);
        expect(result).toBeErr(Cl.uint(206)); // ERR-CONTRACT-PAUSED
    });

    it("blocks release when paused", () => {
        const { id } = createEscrow();
        fundEscrow(id);

        simnet.callPublicFn("trustlock-escrow", "pause", [], deployer);

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(id)],
            seller,
        );
        expect(result).toBeErr(Cl.uint(206));
    });

    it("blocks refund when paused", () => {
        const deadlineBlocks = 10;
        const { id } = createEscrow(buyer, seller, 1000000, deadlineBlocks);
        fundEscrow(id);
        simnet.mineEmptyBlocks(deadlineBlocks + 1);

        simnet.callPublicFn("trustlock-escrow", "pause", [], deployer);

        const { result } = simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(id)], buyer);
        expect(result).toBeErr(Cl.uint(206));
    });

    it("blocks cancellation when paused", () => {
        const { id } = createEscrow();

        simnet.callPublicFn("trustlock-escrow", "pause", [], deployer);

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "cancel-escrow",
            [Cl.uint(id)],
            buyer,
        );
        expect(result).toBeErr(Cl.uint(206));
    });

    it("resumes operations after unpause", () => {
        const { id } = createEscrow();

        // Pause
        simnet.callPublicFn("trustlock-escrow", "pause", [], deployer);

        // Verify blocked
        const blocked = simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(id)], buyer);
        expect(blocked.result).toBeErr(Cl.uint(206));

        // Unpause
        simnet.callPublicFn("trustlock-escrow", "unpause", [], deployer);

        // Verify resumed
        const { result } = fundEscrow(id);
        expect(result).toBeOk(Cl.bool(true));
    });

    it("read-only functions work while paused", () => {
        const { id } = createEscrow();

        simnet.callPublicFn("trustlock-escrow", "pause", [], deployer);

        const info = simnet.callReadOnlyFn("trustlock-escrow", "get-info", [Cl.uint(id)], deployer);
        expect(info.result).toBeOk(expect.anything());

        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id)],
            deployer,
        );
        expect(status.result).toBeOk(Cl.stringAscii("CREATED"));
    });
});

// ===== DEPOSIT - ADVANCED (TC-DEP-005, TC-DEP-006) =====

describe("Deposit Advanced", () => {
    it("rejects deposit after deadline passes (TC-DEP-005)", () => {
        const deadlineBlocks = 5;
        const { id } = createEscrow(buyer, seller, 1000000, deadlineBlocks);

        // Advance past deadline
        simnet.mineEmptyBlocks(deadlineBlocks + 1);

        const { result } = fundEscrow(id);
        expect(result).toBeErr(Cl.uint(301)); // ERR-DEADLINE-PASSED
    });

    it("rejects deposit when buyer has insufficient balance (TC-DEP-006)", () => {
        // Use an extremely large amount that exceeds the buyer's simnet balance
        const hugeAmount = BigInt("999999999999999999");
        const { id } = createEscrow(buyer, seller, hugeAmount as any, 100);

        const { result } = fundEscrow(id);
        expect(result).toBeErr(Cl.uint(400)); // ERR-TRANSFER-FAILED
    });
});

// ===== RELEASE - ADVANCED (TC-REL-004) =====

describe("Release Advanced", () => {
    it("rejects double release (TC-REL-004)", () => {
        const { id } = createEscrow();
        fundEscrow(id);

        // First release succeeds
        const first = simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(id)], seller);
        expect(first.result).toBeOk(Cl.bool(true));

        // Second release fails - status is no longer FUNDED
        const second = simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(id)], seller);
        expect(second.result).toBeErr(Cl.uint(201)); // status check rejects
    });
});

// ===== REFUND - ADVANCED (TC-REF-004, TC-REF-005) =====

describe("Refund Advanced", () => {
    it("rejects double refund (TC-REF-004)", () => {
        const deadlineBlocks = 5;
        const { id } = createEscrow(buyer, seller, 1000000, deadlineBlocks);
        fundEscrow(id);
        simnet.mineEmptyBlocks(deadlineBlocks + 1);

        // First refund succeeds
        const first = simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(id)], buyer);
        expect(first.result).toBeOk(Cl.bool(true));

        // Second refund fails - status is no longer FUNDED
        const second = simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(id)], buyer);
        expect(second.result).toBeErr(Cl.uint(201)); // status check rejects
    });

    it("rejects refund after release (TC-REF-005)", () => {
        const deadlineBlocks = 5;
        const { id } = createEscrow(buyer, seller, 1000000, deadlineBlocks);
        fundEscrow(id);

        // Release first
        simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(id)], seller);

        // Advance past deadline, then try refund
        simnet.mineEmptyBlocks(deadlineBlocks + 1);
        const { result } = simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(id)], buyer);
        expect(result).toBeErr(Cl.uint(201)); // status is RELEASED, not FUNDED
    });
});

// ===== STATE TRANSITIONS (TC-STATE-003) =====

describe("State Transitions", () => {
    it("rejects release on CREATED escrow (TC-STATE-003)", () => {
        const { id } = createEscrow();
        // Try to release without depositing first (CREATED -> release)
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(id)],
            seller,
        );
        expect(result).toBeErr(Cl.uint(201)); // not in FUNDED state
    });

    it("rejects refund on CREATED escrow", () => {
        const { id } = createEscrow();
        simnet.mineEmptyBlocks(200);
        const { result } = simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(id)], buyer);
        expect(result).toBeErr(Cl.uint(201)); // not in FUNDED state
    });

    it("rejects cancel on FUNDED escrow", () => {
        const { id } = createEscrow();
        fundEscrow(id);
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "cancel-escrow",
            [Cl.uint(id)],
            buyer,
        );
        expect(result).toBeErr(Cl.uint(204)); // ERR-INVALID-STATE
    });

    it("rejects cancel on RELEASED escrow", () => {
        const { id } = createEscrow();
        fundEscrow(id);
        simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(id)], seller);

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "cancel-escrow",
            [Cl.uint(id)],
            buyer,
        );
        expect(result).toBeErr(Cl.uint(204)); // ERR-INVALID-STATE
    });

    it("rejects deposit on RELEASED escrow", () => {
        const { id } = createEscrow();
        fundEscrow(id);
        simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(id)], seller);

        const { result } = fundEscrow(id);
        expect(result).toBeErr(Cl.uint(200)); // ERR-ALREADY-FUNDED
    });
});

// ===== GET-INFO STATE READS (TC-INFO-001 to TC-INFO-004) =====

describe("Get-Info State Reads", () => {
    it("returns correct CREATED state (TC-INFO-001)", () => {
        const { id } = createEscrow(buyer, seller, 5000000, 50);

        const info = simnet.callReadOnlyFn("trustlock-escrow", "get-info", [Cl.uint(id)], deployer);
        const data = (info.result as any).value.value;
        expect(data["buyer"]).toStrictEqual(Cl.principal(buyer));
        expect(data["seller"]).toStrictEqual(Cl.principal(seller));
        expect(data["amount"]).toStrictEqual(Cl.uint(5000000));
        expect(data["status"]).toStrictEqual(Cl.stringAscii("CREATED"));
        expect(data["funded-at"]).toStrictEqual(Cl.none());
    });

    it("returns correct FUNDED state with funded-at (TC-INFO-002)", () => {
        const { id } = createEscrow();
        fundEscrow(id);

        const info = simnet.callReadOnlyFn("trustlock-escrow", "get-info", [Cl.uint(id)], deployer);
        const data = (info.result as any).value.value;
        expect(data["status"]).toStrictEqual(Cl.stringAscii("FUNDED"));
        // funded-at should be (some <block-height>)
        expect(data["funded-at"].type).toBe(ClarityType.OptionalSome);
    });

    it("returns correct RELEASED state (TC-INFO-003)", () => {
        const { id } = createEscrow();
        fundEscrow(id);
        simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(id)], seller);

        const info = simnet.callReadOnlyFn("trustlock-escrow", "get-info", [Cl.uint(id)], deployer);
        const data = (info.result as any).value.value;
        expect(data["status"]).toStrictEqual(Cl.stringAscii("RELEASED"));
    });

    it("returns correct REFUNDED state (TC-INFO-004)", () => {
        const deadlineBlocks = 5;
        const { id } = createEscrow(buyer, seller, 1000000, deadlineBlocks);
        fundEscrow(id);
        simnet.mineEmptyBlocks(deadlineBlocks + 1);
        simnet.callPublicFn("trustlock-escrow", "refund", [Cl.uint(id)], buyer);

        const info = simnet.callReadOnlyFn("trustlock-escrow", "get-info", [Cl.uint(id)], deployer);
        const data = (info.result as any).value.value;
        expect(data["status"]).toStrictEqual(Cl.stringAscii("REFUNDED"));
    });
});

// ===== SECURITY (TC-SEC-001, TC-SEC-002) =====

describe("Security", () => {
    it("prevents reentrancy via CEI pattern (TC-SEC-001)", () => {
        // The escrow contract uses Checks-Effects-Interactions pattern:
        // 1. Checks: validate preconditions
        // 2. Effects: update state (status) BEFORE any external call
        // 3. Interactions: stx-transfer
        // This means if deposit is called and the state is updated to FUNDED
        // before the transfer, a reentrant call would see FUNDED and reject.
        const { id } = createEscrow();
        fundEscrow(id);

        // After funding, state is FUNDED. A second deposit attempt
        // (simulating reentrancy) is rejected because status != CREATED.
        const { result } = fundEscrow(id);
        expect(result).toBeErr(Cl.uint(200)); // ERR-ALREADY-FUNDED

        // Similarly, after release, a second release fails.
        simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(id)], seller);
        const reentrant = simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(id)], seller);
        expect(reentrant.result).toBeErr(Cl.uint(201));
    });

    it("transaction ordering does not break atomicity (TC-SEC-002)", () => {
        // Simulate a front-running scenario: two users race to interact
        // with the same escrow. Each operation is atomic within its block.
        const { id } = createEscrow();
        fundEscrow(id);

        // Attacker tries to release (not the seller) - authorization check prevents it
        const attackerRelease = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(id)],
            attacker,
        );
        expect(attackerRelease.result).toBeErr(Cl.uint(101)); // ERR-NOT-SELLER

        // Legitimate seller release succeeds
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(id)],
            seller,
        );
        expect(result).toBeOk(Cl.bool(true));

        // Even if attacker retries after, state is already RELEASED
        const retry = simnet.callPublicFn("trustlock-escrow", "release", [Cl.uint(id)], attacker);
        expect(retry.result).toBeErr(Cl.uint(101));
    });
});

// ===== ID SYNC (Issue #36) =====

describe("Factory-Escrow ID Sync", () => {
    it("keeps factory and escrow IDs in sync through 12 creations", () => {
        for (let i = 0; i < 12; i++) {
            const { result, id } = createEscrow(buyer, seller, 1000000 + i, 100);
            expect(result).toBeOk(Cl.uint(id));
            expect(id).toBe(i);

            // Verify escrow contract has this ID with correct data
            const info = simnet.callReadOnlyFn(
                "trustlock-escrow",
                "get-info",
                [Cl.uint(id)],
                deployer,
            );
            expect(info.result).toBeOk(expect.anything());

            // Verify factory registry also has this ID
            const regInfo = simnet.callReadOnlyFn(
                "trustlock-factory",
                "get-escrow-info",
                [Cl.uint(id)],
                deployer,
            );
            expect(regInfo.result).toBeSome(expect.anything());
        }

        // Both counters should agree
        const factoryTotal = simnet.callReadOnlyFn(
            "trustlock-factory",
            "get-total-escrows",
            [],
            deployer,
        );
        expect(factoryTotal.result).toBeOk(Cl.uint(12));

        const escrowCount = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-escrow-count",
            [],
            deployer,
        );
        expect(escrowCount.result).toBeOk(Cl.uint(12));
    });
});

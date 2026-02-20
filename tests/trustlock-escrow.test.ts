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
    sender: string = deployer
): { result: any; id: number } {
    const { result } = simnet.callPublicFn(
        "trustlock-factory",
        "create-escrow",
        [Cl.principal(b), Cl.principal(s), Cl.uint(amount), Cl.uint(deadlineBlocks)],
        sender
    );
    let id = -1;
    if (result.type === ClarityType.ResponseOk) {
        id = Number(result.value.value);
    }
    return { result, id };
}

/** Fund an escrow (buyer deposits the required amount). */
function fundEscrow(escrowId: number, b: string = buyer) {
    return simnet.callPublicFn(
        "trustlock-escrow",
        "deposit",
        [Cl.uint(escrowId)],
        b
    );
}

// ===== INITIALIZATION =====

describe("Escrow Initialization", () => {
    it("successfully initializes escrow via factory", () => {
        const { result, id } = createEscrow();
        expect(result).toBeOk(Cl.uint(id));

        const info = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-info",
            [Cl.uint(id)],
            deployer
        );
        expect(info.result).toBeOk(expect.anything());
    });

    it("rejects direct initialization (not through factory)", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );
        expect(result).toBeErr(Cl.uint(104));
    });

    it("rejects zero-amount escrow", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(0), Cl.uint(100)],
            deployer
        );
        expect(result).toBeErr(Cl.uint(300));
    });

    it("rejects same buyer and seller", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(buyer), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );
        expect(result).toBeErr(Cl.uint(103));
    });

    it("rejects zero-block deadline", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "create-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(0)],
            deployer
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
            deployer
        );
        expect(status.result).toBeOk(Cl.stringAscii("FUNDED"));
    });

    it("rejects deposit from non-buyer", () => {
        const { id } = createEscrow();
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "deposit",
            [Cl.uint(id)],
            attacker
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
            buyer
        );
        expect(result).toBeErr(Cl.uint(201));
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
            seller
        );
        expect(result).toBeOk(Cl.bool(true));

        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id)],
            deployer
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
            attacker
        );
        expect(result).toBeErr(Cl.uint(101));
    });

    it("rejects release on unfunded escrow", () => {
        const { id } = createEscrow();

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(id)],
            seller
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

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "refund",
            [Cl.uint(id)],
            buyer
        );
        expect(result).toBeOk(Cl.bool(true));

        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id)],
            deployer
        );
        expect(status.result).toBeOk(Cl.stringAscii("REFUNDED"));
    });

    it("rejects refund before deadline", () => {
        const { id } = createEscrow(buyer, seller, 1000000, 100);
        fundEscrow(id);

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "refund",
            [Cl.uint(id)],
            buyer
        );
        expect(result).toBeErr(Cl.uint(302));
    });

    it("rejects refund on unfunded escrow", () => {
        const { id } = createEscrow();

        simnet.mineEmptyBlocks(200);

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "refund",
            [Cl.uint(id)],
            buyer
        );
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
            buyer
        );
        expect(result).toBeOk(Cl.bool(true));

        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id)],
            deployer
        );
        expect(status.result).toBeOk(Cl.stringAscii("CANCELLED"));
    });

    it("rejects cancellation by non-buyer", () => {
        const { id } = createEscrow();

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "cancel-escrow",
            [Cl.uint(id)],
            attacker
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
            buyer
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
            deployer
        );
        expect(result).toBeOk(Cl.bool(true));

        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(id)],
            deployer
        );
        expect(status.result).toBeOk(Cl.stringAscii("CANCELLED"));
    });

    it("rejects factory cancel by non-creator", () => {
        const { id } = createEscrow();

        const { result } = simnet.callPublicFn(
            "trustlock-factory",
            "cancel-escrow",
            [Cl.uint(id)],
            attacker
        );
        expect(result).toBeErr(Cl.uint(103));
    });
});

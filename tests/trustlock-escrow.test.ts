import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const buyer = accounts.get("wallet_1")!;
const seller = accounts.get("wallet_2")!;
const attacker = accounts.get("wallet_3")!;

// ========================================
// INITIALIZATION TESTS
// ========================================

describe("Escrow Initialization", () => {
    it("successfully initializes escrow", () => {
        const heightBeforeInit = simnet.blockHeight;
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );
        expect(result).toBeOk(Cl.uint(0));

        // Verify escrow was created
        const info = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-info",
            [Cl.uint(0)],
            deployer
        );
        // deadline = block-height at time of init + 100 deadline-blocks
        expect(info.result).toBeOk(
            Cl.tuple({
                buyer: Cl.principal(buyer),
                seller: Cl.principal(seller),
                amount: Cl.uint(1000000),
                deadline: Cl.uint(heightBeforeInit + 101),
                status: Cl.stringAscii("CREATED"),
                "funded-at": Cl.none(),
            })
        );
    });

    it("rejects zero amount", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(0), Cl.uint(100)],
            deployer
        );
        expect(result).toBeErr(Cl.uint(300));
    });

    it("rejects same buyer and seller", () => {
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.principal(buyer), Cl.principal(buyer), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );
        expect(result).toBeErr(Cl.uint(103));
    });
});

// ========================================
// DEPOSIT TESTS
// ========================================

describe("Escrow Deposit", () => {
    it("allows successful deposit by buyer", () => {
        // Initialize escrow
        simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );

        // Buyer deposits
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "deposit",
            [Cl.uint(0)],
            buyer
        );
        expect(result).toBeOk(Cl.bool(true));

        // Verify status changed to FUNDED
        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(0)],
            deployer
        );
        expect(status.result).toBeOk(Cl.stringAscii("FUNDED"));
    });

    it("rejects deposit from non-buyer", () => {
        simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "deposit",
            [Cl.uint(0)],
            attacker
        );
        expect(result).toBeErr(Cl.uint(100));
    });

    it("rejects double deposit", () => {
        simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );

        // First deposit
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(0)], buyer);

        // Second deposit attempt
        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "deposit",
            [Cl.uint(0)],
            buyer
        );
        expect(result).toBeErr(Cl.uint(200));
    });
});

// ========================================
// RELEASE TESTS
// ========================================

describe("Escrow Release", () => {
    it("allows successful release by seller", () => {
        simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(0)], buyer);

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(0)],
            seller
        );
        expect(result).toBeOk(Cl.bool(true));

        // Verify status is RELEASED
        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(0)],
            deployer
        );
        expect(status.result).toBeOk(Cl.stringAscii("RELEASED"));
    });

    it("rejects release from non-seller", () => {
        simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(0)], buyer);

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(0)],
            buyer
        );
        expect(result).toBeErr(Cl.uint(101));
    });

    it("rejects release before funding", () => {
        simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "release",
            [Cl.uint(0)],
            seller
        );
        expect(result).toBeErr(Cl.uint(201));
    });
});

// ========================================
// REFUND TESTS
// ========================================

describe("Escrow Refund", () => {
    it("allows refund after deadline", () => {
        const deadlineBlocks = 10;
        simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(deadlineBlocks)],
            deployer
        );
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(0)], buyer);

        // Mine blocks to pass deadline
        simnet.mineEmptyBlocks(deadlineBlocks + 1);

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "refund",
            [Cl.uint(0)],
            buyer
        );
        expect(result).toBeOk(Cl.bool(true));

        // Verify status is REFUNDED
        const status = simnet.callReadOnlyFn(
            "trustlock-escrow",
            "get-status",
            [Cl.uint(0)],
            deployer
        );
        expect(status.result).toBeOk(Cl.stringAscii("REFUNDED"));
    });

    it("rejects refund before deadline", () => {
        simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(100)],
            deployer
        );
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(0)], buyer);

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "refund",
            [Cl.uint(0)],
            buyer
        );
        expect(result).toBeErr(Cl.uint(302));
    });

    it("allows permissionless refund by third party", () => {
        const deadlineBlocks = 10;
        const thirdParty = accounts.get("wallet_4")!;

        simnet.callPublicFn(
            "trustlock-escrow",
            "initialize-escrow",
            [Cl.principal(buyer), Cl.principal(seller), Cl.uint(1000000), Cl.uint(deadlineBlocks)],
            deployer
        );
        simnet.callPublicFn("trustlock-escrow", "deposit", [Cl.uint(0)], buyer);

        // Mine blocks to pass deadline
        simnet.mineEmptyBlocks(deadlineBlocks + 1);

        const { result } = simnet.callPublicFn(
            "trustlock-escrow",
            "refund",
            [Cl.uint(0)],
            thirdParty
        );
        expect(result).toBeOk(Cl.bool(true));
    });
});
